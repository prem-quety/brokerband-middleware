// services/zoho/createZohoInvoiceAndEmail.js
import axios from "axios";
import ZohoSyncLog from "../../models/ZohoSyncLog.js";
import ZohoFailureLog from "../../models/ZohoFailureLog.js";
import { getZohoAccessToken } from "./tokens.js";

const ORG_ID = process.env.ZOHO_ORG_ID;
const BASE = "https://www.zohoapis.com/books/v3";

export const createOrGetCustomer = async (shopifyCustomer) => {
  const token = await getZohoAccessToken();
  if (!shopifyCustomer?.email?.includes("@")) {
    throw new Error("Missing or invalid email");
  }

  const clean = (s) =>
    String(s || "")
      .replace(/[^\w\s\-.,@]/gi, "")
      .trim();
  const cleanPhone = (p) =>
    String(p || "")
      .replace(/\D/g, "")
      .slice(0, 20);

  const fullName = (
    clean(shopifyCustomer.contact_name) ||
    clean(
      `${shopifyCustomer.first_name || ""} ${shopifyCustomer.last_name || ""}`
    )
  ).trim();

  const addr = shopifyCustomer.billing_address || shopifyCustomer;
  const billing_address = {};
  if (addr.address1) billing_address.address = clean(addr.address1);
  if (addr.city) billing_address.city = clean(addr.city);
  if (addr.province) billing_address.state = clean(addr.province);
  if (addr.zip) billing_address.zip = clean(addr.zip);
  if (addr.country) billing_address.country = clean(addr.country);
  if (addr.phone) billing_address.phone = cleanPhone(addr.phone);
  billing_address.attention = fullName;

  const payload = {
    contact_name: fullName,
    contact_type: "customer",
    email: shopifyCustomer.email,
    company_name: shopifyCustomer.company_name || fullName,
    currency_id: shopifyCustomer.currency_id || "6424293000000000101",
    ...(Object.keys(billing_address).length > 1 && { billing_address }),
  };

  const headers = {
    Authorization: `Zoho-oauthtoken ${token}`,
    "Content-Type": "application/json",
    "X-Unique-Identifier-Key": "email",
    "X-Unique-Identifier-Value": shopifyCustomer.email,
  };

  try {
    const r = await axios.post(`${BASE}/contacts`, payload, {
      headers,
      params: { organization_id: ORG_ID },
    });
    console.log(`Zoho Customer synced: ${r.data.contact.contact_id}`);
    return r.data.contact;
  } catch (err) {
    const code = err.response?.data?.code;
    if (code === 3062) {
      console.warn("Zoho: duplicate contact_name → searching existing…");

      // 1) lookup by email
      const byEmail = await axios.get(`${BASE}/contacts`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
        params: { organization_id: ORG_ID, email: shopifyCustomer.email },
      });
      const matchEmail = (byEmail.data.contacts || []).find(
        (c) =>
          c.email?.toLowerCase().trim() ===
          shopifyCustomer.email.toLowerCase().trim()
      );
      if (matchEmail) return matchEmail;

      console.warn("No match by email. Trying lookup by name…");
      // 2) lookup by name
      const byName = await axios.get(`${BASE}/contacts`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
        params: { organization_id: ORG_ID, contact_name: fullName },
      });
      const matchName = (byName.data.contacts || []).find(
        (c) =>
          c.contact_name?.toLowerCase().trim() === fullName.toLowerCase().trim()
      );
      if (matchName) return matchName;

      throw new Error("Duplicate contact_name but no email/name match");
    }

    console.error("Zoho Customer Sync Error:", err.response?.data || err);
    throw new Error(err.response?.data?.message || "Failed to sync customer");
  }
};

export const createZohoInvoiceAndEmail = async (shopifyOrder) => {
  const token = await getZohoAccessToken();
  const headers = {
    Authorization: `Zoho-oauthtoken ${token}`,
    "Content-Type": "application/json",
  };

  try {
    // get or create contact
    const customer = await createOrGetCustomer(shopifyOrder.customer);
    const customerId = customer.contact_id;

    // build line items
    const line_items = await Promise.all(
      shopifyOrder.line_items.map(async (item) => {
        const log = await ZohoSyncLog.findOne({
          shopify_variant_id: item.variant_id,
        });
        if (!log?.zoho_item_id) {
          throw new Error(`Missing Zoho item for variant ${item.variant_id}`);
        }
        return {
          item_id: log.zoho_item_id,
          rate: parseFloat(item.price),
          quantity: item.quantity,
        };
      })
    );

    const invoicePayload = {
      customer_id: customerId,
      date: new Date().toISOString().slice(0, 10),
      reference_number: `Shopify Order #${shopifyOrder.name}`,
      line_items,
      payment_terms: 0,
    };

    // create invoice
    const createRes = await axios.post(`${BASE}/invoices`, invoicePayload, {
      headers,
      params: { organization_id: ORG_ID },
    });
    const invoice = createRes.data.invoice;
    console.log("Zoho invoice created:", invoice.invoice_id);

    // email invoice
    await axios.post(
      `${BASE}/invoices/${invoice.invoice_id}/email`,
      {
        to_mail_ids: [shopifyOrder.customer.email],
        subject: `Your Invoice #${invoice.invoice_number}`,
        body: `Hi ${shopifyOrder.customer.first_name},\n\nThanks for your order. Your invoice is attached!\n\nCheers`,
      },
      {
        headers,
        params: { organization_id: ORG_ID },
      }
    );
    console.log("Zoho invoice emailed.");

    return invoice;
  } catch (err) {
    const info = err.response?.data || err.message || err;
    console.error("Zoho Invoice Flow Error:", info);
    await ZohoFailureLog.create({
      order_id: shopifyOrder.id,
      type: "zoho_invoice",
      message: err.response?.data?.message || err.message || String(err),
      status: "failed",
      tried_at: new Date(),
      retry_count: 1,
      resolved: false,
    });
    console.error("Zoho invoice failed. Logged to fallback DB.");
  }
};
