// models/ZohoSyncLog.js
import mongoose from "mongoose";

const ZohoSyncLogSchema = new mongoose.Schema({
  shopify_product_id: String,
  shopify_variant_id: String,
  shopify_title: String,
  zoho_item_id: String,
  sku: String,
  hash: String,
  synced_at: Date,
  status: { type: String, enum: ["success", "failed"] },
  message: String,
});

export default mongoose.model("ZohoSyncLog", ZohoSyncLogSchema);
