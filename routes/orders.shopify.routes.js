// routes/webhooks/shopify.js
import express from "express";
import { handleNewOrder } from "../services/orders/shopify.js";

const router = express.Router();

router.post("/order", express.json(), async (req, res) => {
  try {
    const order = req.body;
    console.log("[Webhook] New order received:", order.id);

    await handleNewOrder(order);

    res.sendStatus(200);
  } catch (err) {
    console.error("[Webhook] Error handling order:", err);
    res.sendStatus(500);
  }
});

export default router;
