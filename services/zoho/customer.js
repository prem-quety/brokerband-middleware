// services/zoho/customer.js
import axios from "axios";
import { getZohoAccessToken } from "./tokens.js";

const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;
if (!ZOHO_ORG_ID) throw new Error("Missing ZOHO_ORG_ID env var");

/**
 * Create a new contact or fetch existing by email → name
 */
export const createOrGetCustomer = async (shopifyCustomer) => {
  const token = await getZohoAccessToken();
  if (!shopifyCustomer?.email?.includes("@")) {
    throw new Error("Missing or invalid email");
  }

  // sanitize inputs
  const clean = (s) =>
    String(s || "")
      .replace(/[^\w\s\-.,@]/g, "")
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

  // build billing_address if present
  const addr = shopifyCustomer.billing_address || {};
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
    ...(Object.keys(billing_address).length > 1 && { billing_address }),
  };

  const headers = {
    Authorization: `Zoho-oauthtoken ${token}`,
    "Content-Type": "application/json",
    "X-Unique-Identifier-Key": "email",
    "X-Unique-Identifier-Value": shopifyCustomer.email,
  };

  try {
    const res = await axios.post(`${BASE}/contacts`, payload, {
      headers,
      params: { organization_id: ZOHO_ORG_ID },
    });
    return res.data.contact;
  } catch (err) {
    const code = err.response?.data?.code;
    if (code === 3062) {
      // duplicate name → lookup by email
      const emailRes = await axios.get(`${BASE}/contacts`, {
        headers,
        params: {
          organization_id: ZOHO_ORG_ID,
          email: shopifyCustomer.email,
        },
      });
      const emailMatch = (emailRes.data.contacts || []).find(
        (c) =>
          c.email.toLowerCase().trim() ===
          shopifyCustomer.email.toLowerCase().trim()
      );
      if (emailMatch) return emailMatch;

      // fallback: lookup by name
      const nameRes = await axios.get(`${BASE}/contacts/search`, {
        headers,
        params: {
          organization_id: ZOHO_ORG_ID,
          search_text: fullName,
        },
      });
      const nameMatch = (nameRes.data.contacts || []).find(
        (c) =>
          c.contact_name.toLowerCase().trim() === fullName.toLowerCase().trim()
      );
      if (nameMatch) return nameMatch;

      throw new Error("Duplicate contact_name but no email/name match");
    }
    throw new Error(err.response?.data?.message || "Failed to sync customer");
  }
};
