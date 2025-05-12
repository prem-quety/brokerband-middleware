import mongoose from "mongoose";

const shopifyOrderSchema = new mongoose.Schema({
  // Core Identifiers
  shopifyOrderId: { type: String, required: true, unique: true, index: true },
  orderNumber: Number,
  email: String,
  gateway: String,
  financialStatus: String,
  currency: String,
  totalPrice: String,
  subtotalPrice: String,
  totalTax: String,

  // Customer Details
  customer: Object,
  shippingAddress: Object,
  billingAddress: Object,

  // Line Items
  lineItems: [Object], // original Shopify items

  // Timestamps
  shopifyCreatedAt: String,
  shopifyUpdatedAt: String,
  receivedAt: { type: Date, default: Date.now },

  // Raw Payload
  rawPayload: { type: Object, required: true },
});

export default mongoose.model("ShopifyOrder", shopifyOrderSchema);
