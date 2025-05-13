// services/orders/handleNewOrder.js
import { buildSynnexPO } from "../../utils/synnex.js";
import { sendOrderToSynnex } from "../synnex/orders.js";

export const handleNewOrder = async (shopifyOrder) => {
console.log("[buildSynnexPO] Received line_items:", shopifyOrder.line_items);


  const xmlPayload = await buildSynnexPO(shopifyOrder);

  const response = await sendOrderToSynnex(xmlPayload);

  // Optionally log to DB / retry / alert logic
  console.log("[SYNNEX Response]", response);

  return response;
};
