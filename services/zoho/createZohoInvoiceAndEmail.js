import axios from "axios";
import ZohoSyncLog from "../../models/ZohoSyncLog.js";
import ZohoFailureLog from "../../models/ZohoFailureLog.js";
import { getZohoAccessToken } from "./tokens.js";
// 🔥 Import the shared customer service instead of redefining it:
import { createOrGetCustomer } from "./customer.js";

const ORG_ID = process.env.ZOHO_ORG_ID;
if (!ORG_ID) throw new Error("Missing ZOHO_ORG_ID env var");

const BASE = "https://www.zohoapis.com/books/v3";
let cachedCurrencies = null;

// Helper: fetch & cache Zoho currencies
async function fetchCurrencies(token) {
  if (!cachedCurrencies) {
    const res = await axios.get(`${BASE}/settings/currencies`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
      params: { organization_id: ORG_ID },
    });
    cachedCurrencies = res.data.currencies;
  }
  return cachedCurrencies;
}

// Helper: pick the right currency_id for the invoice
async function getCurrencyId(token, currencyCode) {
  const list = await fetchCurrencies(token);
  const found = list.find(
    (c) => c.currency_code === currencyCode.toUpperCase()
  );
  if (found) return found.currency_id;
  return list.find((c) => c.is_base_currency)?.currency_id;
}

export const createZohoInvoiceAndEmail = async (shopifyOrder) => {
  const token = await getZohoAccessToken();
  const headers = {
    Authorization: `Zoho-oauthtoken ${token}`,
    "Content-Type": "application/json",
  };

  try {
    // 1) Get or create the contact
    const customer = await createOrGetCustomer(shopifyOrder.customer);
    const customerId = customer.contact_id;

    // 2) Build line items
    const line_items = await Promise.all(
      shopifyOrder.line_items.map(async (item) => {
        const log = await ZohoSyncLog.findOne({
          shopify_variant_id: item.variant_id,
        });
        if (!log?.zoho_item_id) {
          throw new Error(`No Zoho item for variant ${item.variant_id}`);
        }
        return {
          item_id: log.zoho_item_id,
          rate: parseFloat(item.price),
          quantity: item.quantity,
        };
      })
    );

    // 3) Determine currency_id for this invoice
    const currencyId = await getCurrencyId(token, shopifyOrder.currency);
    if (!currencyId) {
      throw new Error(
        `Cannot resolve Zoho currency for ${shopifyOrder.currency}`
      );
    }

    // 4) Create invoice
    const invoicePayload = {
      customer_id: customerId,
      date: new Date().toISOString().slice(0, 10),
      reference_number: `Shopify Order #${shopifyOrder.name}`,
      line_items,
      payment_terms: 0,
      currency_id: currencyId,
    };
    const { data } = await axios.post(`${BASE}/invoices`, invoicePayload, {
      headers,
      params: { organization_id: ORG_ID },
    });
    const invoice = data.invoice;
    console.log("Zoho invoice created:", invoice.invoice_id);

    // 5) Email the invoice
    await axios.post(
      `${BASE}/invoices/${invoice.invoice_id}/email`,
      {
        to_mail_ids: [shopifyOrder.customer.email],
        subject: `Your Invoice #${invoice.invoice_number}`,
        body: `Hi ${shopifyOrder.customer.first_name},\n\nYour invoice’s attached—thanks for your order!`,
      },
      { headers, params: { organization_id: ORG_ID } }
    );
    console.log("Zoho invoice emailed.");
    return invoice;
  } catch (err) {
    const info = err.response?.data || err.message;
    console.error("Zoho Invoice Flow Error:", info);
    await ZohoFailureLog.create({
      order_id: shopifyOrder.id,
      type: "zoho_invoice",
      message: JSON.stringify(info),
      status: "failed",
      tried_at: new Date(),
      retry_count: 1,
      resolved: false,
    });
  }
};
