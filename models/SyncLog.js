import mongoose from "mongoose";

const warehouseSchema = new mongoose.Schema({
  city: String,
  qty: Number,
});

const syncLogSchema = new mongoose.Schema({
  // Core Identifiers
  sku: { type: String, required: true },
  mfgpn: String,
  productTitle: String,
  description: String,

  // Pricing & Inventory
  price: Number, // Distributor price
  msrp: Number,
  inflatedCompareAtPrice: Number,
  quantityAvailable: Number,
  weight: Number,
  vendor: String,

  // Shopify
  shopifyProductId: String,
  shopifyPayload: Object,
  metafieldsPayload: [Object], // Each metafield object you send
  shopifyMetafieldsResponse: [Object],

  // Scraped Details
  imageUploaded: Boolean,
  scrapedImageUrl: String,
  specsFound: Boolean,
  scrapedSpecs: Object,
  scrapedExtraDetails: {
    upc: String,
    unspsc: String,
    warranty: String,
  },

  // Warehouses
  warehouses: [warehouseSchema],

  // Sync Status
  status: {
    type: String,
    enum: ["success", "failed"],
    default: "success",
  },
  errorMessage: String,
  errorStack: { type: String },

  // Timestamps
  syncedAt: { type: Date, default: Date.now },
});

export default mongoose.model("SyncLog", syncLogSchema);
