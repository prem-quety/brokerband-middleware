import express from "express";
import { handleNewOrder } from "../services/orders/shopify.js";
import { parseSynnexResponse } from "../utils/synnex.js";
import { convert } from "xmlbuilder2";

import ShopifyOrder from "../models/ShopifyOrder.js";
import SynnexResponse from "../models/SynnexResponse.js";

const router = express.Router();

router.post("/order", express.json(), async (req, res) => {
  try {
    const order = req.body;
    const orderId = order.id.toString();
    console.log("[Webhook] New order received:", orderId);

    // 1. Save Shopify order safely (avoid duplicates)
    await ShopifyOrder.findOneAndUpdate(
      { shopifyOrderId: orderId },
      {
        $set: {
          orderNumber: order.number,
          email: order.email,
          gateway: order.gateway,
          financialStatus: order.financial_status,
          currency: order.currency,
          totalPrice: order.total_price,
          subtotalPrice: order.subtotal_price,
          totalTax: order.total_tax,
          customer: order.customer,
          shippingAddress: order.shipping_address,
          billingAddress: order.billing_address,
          lineItems: order.line_items,
          shopifyCreatedAt: order.created_at,
          shopifyUpdatedAt: order.updated_at,
          rawPayload: order,
        }
      },
      { upsert: true, new: true }
    );
console.log("[Webhook] Raw Shopify line_items:", order.line_items);

    // 2. Send to SYNNEX
   const { rawXml, parsed } = await handleNewOrder(order);
const fullParsed = convert(rawXml, { format: "object" });

    const parsedResponse = parsed;


    // 4. Log full response
    console.log("[Webhook] Full SYNNEX response:\n", JSON.stringify(fullParsed, null, 2));

    // 5. Save SYNNEX response safely
    await SynnexResponse.findOneAndUpdate(
      { shopifyOrderId: orderId },
      {
        $set: {
          poNumber: parsedResponse.poNumber,
          customerNumber: parsedResponse.customerNumber,
          statusCode: parsedResponse.statusCode,
          rejectionReason: parsedResponse.reason || null,
          items: parsedResponse.items,
          rawXml: rawXml,
          parsed: JSON.parse(JSON.stringify(fullParsed)),
        }
      },
      { upsert: true, new: true }
    );

    // 6. Return clean response
    return res.status(200).json({
      status: "success",
      shopifyOrderId: orderId,
      message: "Order forwarded to SYNNEX successfully",
      synnex: parsedResponse
    });

  } catch (err) {
    console.error("[Webhook] Error handling order:", err);
    return res.status(500).json({
      status: "error",
      message: "Failed to process order",
      error: err.message
    });
  }
});

export default router;
