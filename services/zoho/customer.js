import axios from "axios";
import { getZohoAccessToken } from "./tokens.js";

const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;

export const createOrGetCustomer = async (shopifyCustomer) => {
  const token = await getZohoAccessToken();

  try {
    // ✅ Validate essential fields first
    if (!shopifyCustomer.email || !shopifyCustomer.email.includes("@")) {
      throw new Error("Missing or invalid email. Cannot sync to Zoho.");
    }

    // 1. Try to find existing customer by email
    const search = await axios.get("https://www.zohoapis.com/books/v3/contacts", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      params: {
        organization_id: ZOHO_ORG_ID,
        email: shopifyCustomer.email,
      },
    });

    if (search.data.contacts.length > 0) {
      const customer = search.data.contacts[0];
      console.log("✅ Customer exists:", customer.contact_id);
      return customer;
    }

    // 2. Build and sanitize contact name
    const rawName = `${shopifyCustomer.first_name || ""} ${shopifyCustomer.last_name || ""}`.trim();
    const contactName = "Prem Kumar"; // hardcoded test

const cleanPhone = (phone) =>
  String(phone || "")
    .replace(/[^\d]/g, "")      // Keep only numbers
    .slice(0, 20);              // Zoho max length is 20

    // 3. Build payload
const payload = {
  contact_name: "Prem Kumar",
  email: "prem.kumar@querytel.com"
};


console.log("📦 Zoho Payload:", JSON.stringify({ contact: payload }, null, 2));

    // 4. Send Zoho create request
    const create = await axios.post(
      `https://www.zohoapis.com/books/v3/contacts`,
      { contact: payload },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        params: {
          organization_id: ZOHO_ORG_ID,
        },
      }
    );

    const newCustomer = create.data.contact;
    console.log("➕ New Zoho Customer created:", newCustomer.contact_id);
    return newCustomer;

  } catch (err) {
    console.error("❌ Zoho Customer Sync Error:", {
      status: err.response?.status,
      data: err.response?.data,
      message: err.message,
    });

    throw new Error(
      err.response?.data?.message || "Failed to create or retrieve customer"
    );
  }
};
