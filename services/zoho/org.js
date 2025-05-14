// /services/zoho/org.js
import axios from "axios";
import { getZohoAccessToken } from "./tokens.js";

export const getOrganizationInfo = async () => {
  const accessToken = await getZohoAccessToken();

  const response = await axios.get("https://www.zohoapis.com/books/v3/organizations", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const org = response.data.organizations[0];
  console.log("🏢 Organization Info:", org);
  return org;
};
