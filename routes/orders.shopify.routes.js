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

    // 1. Save Shopify order to DB
    await ShopifyOrder.create({
      shopifyOrderId: orderId,
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
    });

    // 2. Send to SYNNEX and get raw XML response
    const xmlResponse = await handleNewOrder(order);

    // 3. Parse full and partial response
    const fullParsed = convert(xmlResponse, { format: "object" });
    const parsedResponse = parseSynnexResponse(xmlResponse);

    // 4. Log full response to console
    console.log("[Webhook] Full SYNNEX response:\n", JSON.stringify(fullParsed, null, 2));

    // 5. Save SYNNEX response to DB
    await SynnexResponse.create({
      shopifyOrderId: orderId,
      poNumber: parsedResponse.poNumber,
      customerNumber: parsedResponse.customerNumber,
      statusCode: parsedResponse.statusCode,
      rejectionReason: parsedResponse.reason || null,
      items: parsedResponse.items,
      rawXml: xmlResponse,
      parsed: JSON.parse(JSON.stringify(fullParsed)),

    });

    // 6. Return clean response to Shopify
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
