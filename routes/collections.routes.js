// File: shopify-td-zoho/routes/shopify.smartCollections.js

import express from "express";
import axios from "axios";

const router = express.Router();

// Bulk Smart Collection Creator using tag as condition (mirroring product_type)
router.post("/collection/smart/bulk", async (req, res) => {
  const { categories } = req.body;

  if (!Array.isArray(categories) || categories.length === 0) {
    return res.status(400).json({ error: "No categories provided" });
  }

  try {
    const created = [];

    for (const category of categories) {
      const payload = {
        smart_collection: {
          title: category,
          rules: [
            {
              column: "tag",
              relation: "equals",
              condition: category,
            },
          ],
          published: true,
        },
      };

      const url = `${process.env.SHOPIFY_STORE_URL}/admin/api/${process.env.SHOPIFY_API_VERSION}/smart_collections.json`;

      const response = await axios.post(url, payload, {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
        },
      });

      created.push(response.data.smart_collection);
    }

    res.status(201).json({
      success: true,
      message: "Smart collections created using tag condition",
      data: created,
    });
  } catch (err) {
    console.error(
      "Smart collection bulk create error:",
      err.response?.data || err.message
    );
    res.status(500).json({
      error: err.response?.data || "Failed to create smart collections",
    });
  }
});

export default router;
