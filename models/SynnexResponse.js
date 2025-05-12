import mongoose from "mongoose";

const synnexItemSchema = new mongoose.Schema({
  lineNumber: String,
  sku: String,
  quantity: String,
  code: String,
  reason: String,
  synnexOrderNumber: String,
  orderType: String,
  warehouse: Object,
  internalReference: String,
});

const synnexResponseSchema = new mongoose.Schema({
  // Core Identifiers
  shopifyOrderId: { type: String, required: true, index: true },
  poNumber: { type: String, required: true, index: true },
  customerNumber: String,

  // Raw
  rawXml: { type: String, required: true },
  parsed: { type: Object, required: true },

  // Parsed Summary
  statusCode: String,
  rejectionReason: String,

  // Items
  items: [synnexItemSchema],

  // Timestamps
  synnexCreatedAt: { type: Date, default: Date.now },
});

export default mongoose.model("SynnexResponse", synnexResponseSchema);
