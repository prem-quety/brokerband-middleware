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

    // 1. Check if this exact update was already processed
    const existingShopifyOrder = await ShopifyOrder.findOne({
      shopifyOrderId: orderId,
      shopifyUpdatedAt: order.updated_at,
    });

    if (existingShopifyOrder) {
      console.warn(
        `[Webhook] Duplicate webhook for ${orderId}, skipping processing.`
      );
      return res.status(200).json({
        status: "duplicate",
        shopifyOrderId: orderId,
        message: "This Shopify order update was already processed.",
      });
    }

    // 2. Save Shopify order safely (always upsert the latest payload)
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
      { upsert: true, new: true }
    );

    console.log("[Webhook] Raw Shopify line_items:", order.line_items);

    // 3. Prevent duplicate SYNNEX handling
    const existing = await SynnexResponse.findOne({ shopifyOrderId: orderId });
    if (existing) {
      console.warn(
        `[Webhook] SYNNEX response already exists for ${orderId}, skipping duplicate.`
      );
      return res.status(200).json({
        status: "skipped",
        shopifyOrderId: orderId,
        message: "Order already forwarded to SYNNEX.",
      });
    }

    // 4. Proceed to SYNNEX
    const { rawXml, parsed } = await handleNewOrder(order);
    const fullParsed = convert(rawXml, { format: "object" });

    console.log(
      "[Webhook] Full SYNNEX response:\n",
      JSON.stringify(fullParsed, null, 2)
    );

    // 5. Save SYNNEX response
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

    // 6. Return success
    return res.status(200).json({
      status: "success",
      shopifyOrderId: orderId,
      message: "Order forwarded to SYNNEX successfully",
      synnex: parsed,
    });
  } catch (err) {
    console.error("[Webhook] Error handling order:", err);
    return res.status(500).json({
      status: "error",
      message: "Failed to process order",
      error: err.message,
    });
  }
});

export default router;
