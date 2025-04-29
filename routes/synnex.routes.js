import express from "express";
import { syncSynnexToShopify } from "../services/synnex/sync.js";

import { syncLenovoSKUsFromFile } from "../jobs/syncLenovoBatch.js";

const router = express.Router();

router.post("/sync-synnex", async (req, res) => {
  const { sku } = req.body;

  if (!sku) return res.status(400).json({ error: "SKU is required" });

  try {
    const product = await syncSynnexToShopify(sku);
    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/sync/lenovo", async (req, res) => {
  try {
    const result = await syncLenovoSKUsFromFile();
    res.status(200).json({
      message: "✅ Lenovo sync completed",
      ...result,
    });
  } catch (err) {
    console.error("❌ Sync error:", err.message);
    res.status(500).json({ error: "Failed to sync Lenovo SKUs" });
  }
});

router.get("/test-sync", async (req, res) => {
  const sku = req.query.sku || "7984359"; // default test SKU from your JSON

  try {
    const result = await syncSynnexToShopify(sku);
    if (!result) {
      return res.status(404).json({ error: "Product not synced (no data)" });
    }

    res.json({
      message: `✅ Test sync successful for SKU: ${sku}`,
      productId: result.id,
      title: result.title,
    });
  } catch (err) {
    console.error("❌ Sync error:", err.message);
    res.status(500).json({
      error: "Sync failed",
      details: err.message,
    });
  }
});

export default router;
