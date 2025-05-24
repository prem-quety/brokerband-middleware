import { buildSynnexPO } from "../../utils/synnex.js";
import { sendOrderToSynnex } from "../synnex/orders.js";
import { parseSynnexResponse } from "../../utils/synnex.js";
import { createZohoInvoiceAndEmail } from "../zoho/createZohoInvoiceAndEmail.js"; // adjust path if needed

export const handleNewOrder = async (shopifyOrder) => {
  console.log("[handleNewOrder] 📦 New order received from Shopify");
  console.log("[handleNewOrder] Shopify Line Items:", shopifyOrder.line_items);

  try {
    // Step 1: Build PO XML
    const xmlPayload = await buildSynnexPO(shopifyOrder);
    console.log("[handleNewOrder] ✅ PO XML built successfully");

    // Step 2: Submit to SYNNEX
    const rawResponse = await sendOrderToSynnex(xmlPayload);
    console.log("[SYNNEX Raw Response XML]", rawResponse);

    // Step 3: Parse SYNNEX response
    const parsed = parseSynnexResponse(rawResponse);
    console.log("[SYNNEX Parsed Response]", parsed);

    // Step 4: Validate SYNNEX response
    const allItemsValid = Array.isArray(parsed.items) &&
      parsed.items.every(item => item.orderType?.toUpperCase() === "SO");

    const isAccepted = parsed.statusCode?.toLowerCase() === "accepted";

    if (isAccepted && allItemsValid) {
      console.log(`[handleNewOrder] ✅ SYNNEX returned valid SO. Proceeding to create Zoho invoice for PO: ${parsed.poNumber}`);
      await createZohoInvoiceAndEmail(shopifyOrder);
    } else {
      console.warn(`[handleNewOrder] ⚠️ SYNNEX response not fully valid. Skipping Zoho invoice.`);
      console.warn(`[handleNewOrder] Reason: statusCode=${parsed.statusCode}, orderTypes=[${parsed.items.map(i => i.orderType).join(", ")}]`);
    }

    return {
  rawXml: rawResponse,
  parsed,
};


  } catch (err) {
    console.error("[handleNewOrder] ❌ Error during order handling:", err);
    throw err;
  }
};
