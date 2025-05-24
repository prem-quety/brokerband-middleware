// routes/shopify.js
import express from "express";
import { handleNewOrder } from "../services/orders/shopify.js";
import { convert } from "xmlbuilder2";

import ShopifyOrder from "../models/ShopifyOrder.js";
import SynnexResponse from "../models/SynnexResponse.js";

const router = express.Router();

router.post("/order", express.json(), async (req, res) => {
  const order = req.body;
  const orderId = String(order.id);
  console.log("[Webhook] New order received:", orderId);

  try {
    // 1) Prevent re-processing
    const duplicate = await ShopifyOrder.findOne({
      shopifyOrderId: orderId,
      shopifyUpdatedAt: order.updated_at,
    });
    if (duplicate) {
      console.warn(`[Webhook] Duplicate webhook for ${orderId}, skipping.`);
      return res.status(200).json({
        status: "duplicate",
        shopifyOrderId: orderId,
        message: "Already processed.",
      });
    }

    // 2) Upsert the raw payload
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
        },
      },
      { upsert: true }
    );
    console.log("[Webhook] Saved Shopify order. Line items:", order.line_items);

    // 3) Prevent duplicate SYNNEX send
    const existing = await SynnexResponse.findOne({ shopifyOrderId: orderId });
    if (existing) {
      console.warn(`[Webhook] SYNNEX already has ${orderId}, skipping.`);
      return res.status(200).json({
        status: "skipped",
        shopifyOrderId: orderId,
        message: "Already forwarded to SYNNEX.",
      });
    }

    // 4) Build & send to SYNNEX, then invoice in Zoho
    const { rawXml, parsed } = await handleNewOrder(order);
    const fullParsed = convert(rawXml, { format: "object" });
    console.log(
      "[Webhook] Full SYNNEX response:\n",
      JSON.stringify(fullParsed, null, 2)
    );

    // 5) Persist SYNNEX response
    await SynnexResponse.create({
      shopifyOrderId: orderId,
      poNumber: parsed.poNumber,
      customerNumber: parsed.customerNumber,
      statusCode: parsed.statusCode,
      rejectionReason: parsed.reason || null,
      items: parsed.items,
      rawXml,
      parsed: fullParsed,
    });

    // 6) Ack the webhook
    res.status(200).json({
      status: "success",
      shopifyOrderId: orderId,
      message: "Forwarded to SYNNEX (and invoiced).",
      synnex: parsed,
    });
  } catch (err) {
    console.error("[Webhook] Error handling order:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to process order",
      error: err.message,
    });
  }
});

export default router;
