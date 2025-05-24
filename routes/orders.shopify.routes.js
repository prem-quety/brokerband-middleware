import express from "express";
import { handleNewOrder } from "../services/orders/shopify.js";
import { convert } from "xmlbuilder2";

import ShopifyOrder from "../models/ShopifyOrder.js";
import SynnexResponse from "../models/SynnexResponse.js";

const router = express.Router();

router.post("/order", express.json(), (req, res) => {
  const order = req.body;
  const orderId = order.id.toString();
  console.log("[Webhook] New order received:", orderId);

  // 1) Acknowledge immediately so Shopify won't retry
  res.status(200).json({ status: "queued", shopifyOrderId: orderId });

  // 2) Do the heavy work in background
  setImmediate(async () => {
    try {
      // a) Idempotency guard for Shopify order
      const existingShopifyOrder = await ShopifyOrder.findOne({
        shopifyOrderId: orderId,
        shopifyUpdatedAt: order.updated_at,
      });
      if (existingShopifyOrder) {
        console.warn(`[Background] Duplicate for ${orderId}, skipping.`);
        return;
      }

      // b) Upsert the Shopify order payload
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

      // c) Prevent duplicate SYNNEX handling
      const existingSynnex = await SynnexResponse.findOne({
        shopifyOrderId: orderId,
      });
      if (existingSynnex) {
        console.warn(
          `[Background] SYNNEX already done for ${orderId}, skipping.`
        );
        return;
      }

      // d) Forward to SYNNEX and save response
      const { rawXml, parsed } = await handleNewOrder(order);
      const fullParsed = convert(rawXml, { format: "object" });
      console.log(
        `[Background] Full SYNNEX response for ${orderId}:\n`,
        JSON.stringify(fullParsed, null, 2)
      );
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
    } catch (err) {
      console.error(`[Background] Error processing order ${orderId}:`, err);
    }
  });
});

export default router;
