// services/synnex/sendToSynnex.js
import axios from "axios";

export const sendOrderToSynnex = async (xmlPayload) => {
  const endpoint =
    process.env.SYNNEX_ENV === "prod"
      ? "https://ec.ca.tdsynnex.com/SynnexXML/PO"
      : "https://testec.ca.tdsynnex.com/SynnexXML/PO";

  const response = await axios.post(endpoint, xmlPayload, {
    headers: { "Content-Type": "application/xml" },
  });

  return response.data;
};
