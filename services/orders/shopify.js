import { buildSynnexPO } from "../../utils/synnex.js";
import { sendOrderToSynnex } from "../synnex/orders.js";
import { parseSynnexResponse } from "../../utils/synnex.js";
import { createZohoInvoiceAndEmail } from "../zoho/createZohoInvoiceAndEmail.js"; // adjust path if needed

export const handleNewOrder = async (shopifyOrder) => {
  console.log("[buildSynnexPO] Received line_items:", shopifyOrder.line_items);

  try {
    // Build PO XML
    const xmlPayload = await buildSynnexPO(shopifyOrder);

    // Send to SYNNEX
    const rawResponse = await sendOrderToSynnex(xmlPayload);
    console.log("[SYNNEX Raw Response XML]", rawResponse);

    // Parse the XML response to get details
    const parsed = parseSynnexResponse(rawResponse);
    console.log("[SYNNEX Parsed Response]", parsed);

    const allItemsValid = Array.isArray(parsed.items) &&
      parsed.items.every(i => i.orderType && i.orderType !== '99');

    if (parsed.statusCode === "0" && allItemsValid) {
      // SYNNEX success → create Zoho invoice
      await createZohoInvoiceAndEmail(shopifyOrder);
    } else {
      console.warn("[handleNewOrder] SYNNEX response indicates failure or manual review needed (OrderType 99). Skipping Zoho.");
    }

    return parsed;

  } catch (err) {
    console.error("[handleNewOrder] ❌ Error during order handling:", err);
    throw err;
  }
};
