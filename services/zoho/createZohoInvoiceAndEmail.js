import axios from "axios";
import ZohoSyncLog from "../../models/ZohoSyncLog.js";
import { getZohoAccessToken } from "./tokens.js";
import { createOrGetCustomer } from "./customer.js";
import ZohoFailureLog from "../../models/ZohoFailureLog.js";

const ORG_ID = process.env.ZOHO_ORG_ID;

export const createZohoInvoiceAndEmail = async (shopifyOrder) => {
  const token = await getZohoAccessToken();

  try {
    // Step 1: Get or create customer
    let customer;
    try {
      customer = await createOrGetCustomer(shopifyOrder.customer);
    } catch (err) {
      if (err.message === "Duplicate contact_name") {
        console.warn(
          "Skipping invoice creation due to duplicate contact_name."
        );
        return;
      }
      throw err;
    }

    const customerId = customer.contact_id;

    // Step 2: Build line_items[]
    const line_items = await Promise.all(
      shopifyOrder.line_items.map(async (item) => {
        const log = await ZohoSyncLog.findOne({
          shopify_variant_id: item.variant_id,
        });
        if (!log?.zoho_item_id) {
          throw new Error(
            `Missing Zoho item for variant_id ${item.variant_id}`
          );
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

    // Step 3: Create invoice
    const res = await axios.post(
      `https://www.zohoapis.com/books/v3/invoices?organization_id=${ORG_ID}`,
      invoicePayload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    const invoice = res.data.invoice;
    console.log("Zoho invoice created:", invoice.invoice_id);

    // Step 4: Email invoice
    await axios.post(
      `https://www.zohoapis.com/books/v3/invoices/${invoice.invoice_id}/email?organization_id=${ORG_ID}`,
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
      }
    );

    console.log("Zoho invoice emailed.");
    return invoice;
  } catch (err) {
    console.error("Zoho Invoice Flow Error:", err.message || err);

    await ZohoFailureLog.create({
      order_id: shopifyOrder.id,
      type: "zoho_invoice",
      message: err.message || JSON.stringify(err),
      status: "failed",
      tried_at: new Date(),
      retry_count: 1,
      resolved: false,
    });

    console.error("Zoho invoice failed. Logged to fallback DB.");
  }
};
