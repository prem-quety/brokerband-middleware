// services/synnex/sendToSynnex.js
import axios from "axios";

export const sendOrderToSynnex = async (xmlPayload) => {
  const endpoint =
    process.env.SYNNEX_ENV === "prod"
      ? "https://ec.ca.tdsynnex.com/SynnexXML/PO"
      : "https://testec.ca.tdsynnex.com/SynnexXML/PO";

  if (!xmlPayload || typeof xmlPayload !== "string" || !xmlPayload.trim().startsWith("<?xml")) {
    console.error("[sendOrderToSynnex] ❌ Invalid XML payload:");
    console.error(xmlPayload);
    throw new Error("Invalid XML payload: not sending to SYNNEX");
  }

  const response = await axios.post(endpoint, xmlPayload, {
    headers: { "Content-Type": "application/xml" },
  });

  return response.data;
};
