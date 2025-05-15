import axios from "axios";
import { getZohoAccessToken } from "./tokens.js";

const ZOHO_ORG_ID = process.env.ZOHO_ORG_ID;

export const createOrGetCustomer = async (shopifyCustomer) => {
  const token = await getZohoAccessToken();

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

  // 2. Otherwise, create a new customer
  const payload = {
    contact_name: `${shopifyCustomer.first_name} ${shopifyCustomer.last_name}`.trim(),
    email: shopifyCustomer.email,
    billing_address: {
      attention: `${shopifyCustomer.first_name} ${shopifyCustomer.last_name}`,
      address: shopifyCustomer.address1 || "",
      city: shopifyCustomer.city || "",
      state: shopifyCustomer.province || "",
      zip: shopifyCustomer.zip || "",
      country: shopifyCustomer.country || "",
      phone: shopifyCustomer.phone || shopifyCustomer.default_address?.phone || "",
    },
  };

  const create = await axios.post(
    `https://www.zohoapis.com/books/v3/contacts?organization_id=${ZOHO_ORG_ID}`,
    { contact: payload },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  const newCustomer = create.data.contact;
  console.log("➕ New Zoho Customer created:", newCustomer.contact_id);
  return newCustomer;
};
