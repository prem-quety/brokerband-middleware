import axios from "axios";
import { getZohoAccessToken } from "./tokens.js";

const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;

export const createOrGetCustomer = async (shopifyCustomer) => {
  const token = await getZohoAccessToken();
  console.log("Incoming Shopify Customer:", shopifyCustomer);

  try {
    if (!shopifyCustomer || typeof shopifyCustomer !== "object") {
      throw new Error("No customer data received.");
    }
    if (!shopifyCustomer.email || !shopifyCustomer.email.includes("@")) {
      throw new Error("Missing or invalid email. Cannot sync to Zoho.");
    }

    // sanitize inputs
    const clean = str => String(str || "").replace(/[^\w\s\-.,@]/gi, "").trim();
    const cleanPhone = phone =>
      String(phone || "").replace(/[^\d]/g, "").slice(0, 20);

    const fullName = clean(
      shopifyCustomer.contact_name ||
      `${shopifyCustomer.first_name || ""} ${shopifyCustomer.last_name || ""}`
    ).trim();
    if (!fullName) throw new Error("Invalid or missing contact_name.");

    // build billing address if present
    const addr = shopifyCustomer.billing_address || shopifyCustomer;
    const billing_address = {};
    if (addr.address) billing_address.address = clean(addr.address);
    if (addr.city) billing_address.city = clean(addr.city);
    if (addr.state) billing_address.state = clean(addr.state);
    if (addr.zip) billing_address.zip = clean(addr.zip);
    if (addr.country) billing_address.country = clean(addr.country);
    if (addr.phone) billing_address.phone = cleanPhone(addr.phone);
    billing_address.attention = fullName;

    // final payload (flat, no "contact" envelope)
    const payload = {
      contact_name: fullName,
      contact_type: "customer",
      email: shopifyCustomer.email,
      company_name: shopifyCustomer.company_name || fullName,
      currency_id: shopifyCustomer.currency_id || "6424293000000000101",
      ...(Object.keys(billing_address).length > 1 && { billing_address })
    };

    console.log("Zoho Payload:", JSON.stringify(payload, null, 2));

    // upsert contact in Zoho (create or update by email)
    const response = await axios.post(
      "https://www.zohoapis.com/books/v3/contacts",
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Unique-Identifier-Key": "email",
          "X-Unique-Identifier-Value": shopifyCustomer.email
        },
        params: { organization_id: ZOHO_ORG_ID }
      }
    );

    console.log(
      `Zoho Customer ${response.data.contact.contact_id} synced (created/updated).`
    );
    return response.data.contact;

  } catch (err) {
    console.error("Zoho Customer Sync Error:", {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message
    });
    throw new Error(err.response?.data?.message || "Failed to sync customer");
  }
};
