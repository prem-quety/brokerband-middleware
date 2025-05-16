import axios from "axios";
import { getZohoAccessToken } from "./tokens.js";

const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;

export const createOrGetCustomer = async (shopifyCustomer) => {
  const token = await getZohoAccessToken();
console.log("💥 Incoming Shopify Customer:", shopifyCustomer);

  try {
    // ✅ Validate essential fields first
    if (!shopifyCustomer || typeof shopifyCustomer !== "object") {
      throw new Error("No customer data received.");
    }

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

    // 2. Clean inputs
    const clean = (str) => String(str || "").replace(/[^\w\s\-.,@]/gi, "").trim();
    const cleanPhone = (phone) =>
      String(phone || "").replace(/[^\d]/g, "").slice(0, 20);

    const firstName = clean(shopifyCustomer.first_name);
    const lastName = clean(shopifyCustomer.last_name);
    const fullName = `${firstName} ${lastName}`.trim() || "Unnamed Customer";

    // 3. Build payload
    const payload = {
      contact_name: fullName,
      contact_type: "customer", // 🔥 required
      email: shopifyCustomer.email,
      company_name: shopifyCustomer.company || fullName,
      billing_address: {
        attention: fullName,
        address: clean(shopifyCustomer.address1),
        city: clean(shopifyCustomer.city),
        state: clean(shopifyCustomer.province),
        zip: clean(shopifyCustomer.zip),
        country: clean(shopifyCustomer.country),
        phone: cleanPhone(
          shopifyCustomer.phone || shopifyCustomer.default_address?.phone
        ),
      },
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
