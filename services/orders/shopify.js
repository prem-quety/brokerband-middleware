// services/orders/handleNewOrder.js
import { buildSynnexPO } from "../../utils/synnex.js";
import { sendOrderToSynnex } from "../synnex/sendToSynnex.js";

export const handleNewOrder = async (shopifyOrder) => {
  const xmlPayload = buildSynnexPO(shopifyOrder);

  const response = await sendOrderToSynnex(xmlPayload);

  // Optionally log to DB / retry / alert logic
  console.log("[SYNNEX Response]", response);

  return response;
};
