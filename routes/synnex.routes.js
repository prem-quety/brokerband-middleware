import express from "express";
import { syncSynnexToShopify } from "../services/synnex/synnex.js";
import { syncLenovoSKUsFromFile } from "../services/synnex/sync.js";

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

export default router;
