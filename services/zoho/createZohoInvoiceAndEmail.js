// services/zoho/createZohoInvoiceAndEmail.js
import axios from "axios";
import ZohoSyncLog from "../../models/ZohoSyncLog.js";
import ZohoFailureLog from "../../models/ZohoFailureLog.js";
import { getZohoAccessToken } from "./tokens.js";
import { createOrGetCustomer } from "./customer.js";

const ORG_ID = process.env.ZOHO_ORG_ID;
if (!ORG_ID) {
  throw new Error("Missing ZOHO_ORG_ID env var");
}
console.log("Using Zoho Org ID:", ORG_ID);

export const createZohoInvoiceAndEmail = async (shopifyOrder) => {
  const token = await getZohoAccessToken();

  try {
    // 1) Get or create the customer
    let customer;
    try {
      customer = await createOrGetCustomer(shopifyOrder.customer);
    } catch (err) {
      if (err.message === "Duplicate contact_name") {
        console.warn("Skipping invoice: duplicate contact.");
        return;
      }
      throw err;
    }
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

    // 3) Create invoice
    const { data } = await axios.post(
      "https://www.zohoapis.com/books/v3/invoices",
      {
        customer_id: customerId,
        date: new Date().toISOString().slice(0, 10),
        reference_number: `Shopify Order #${shopifyOrder.name}`,
        line_items,
        payment_terms: 0,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        params: { organization_id: String(ORG_ID) },
      }
    );

    const invoice = data.invoice;
    console.log("Zoho invoice created:", invoice.invoice_id);

    // 4) Email the invoice
    await axios.post(
      `https://www.zohoapis.com/books/v3/invoices/${invoice.invoice_id}/email`,
      {
        to_mail_ids: [shopifyOrder.customer.email],
        subject: "Your Brokerband Invoice",
        body: "Thank you for your order. Please find your invoice attached.",
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        params: { organization_id: String(ORG_ID) },
      }
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
