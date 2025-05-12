import express from "express";
import axios from "axios";
import {
  findCollectionIdByTitle,
  addMultipleProductsToCollection,
} from "../services/shopify/shopifyCollections.js";
import {
  fetchShopifyProducts,
  postProductToShopify,
} from "../services/shopify/shopify.js";
import { setProductMetafields } from "../services/shopify/shopify.js";
import { deleteProductsWithoutPriceOrImage } from "../services/shopify/shopify.js";

const router = express.Router();



// Create Product
router.post("/product", async (req, res) => {
  try {
    const productData = req.body;

    if (!productData || !productData.title || !productData.variants) {
      return res
        .status(400)
        .json({ error: "Missing required fields in product data" });
    }

    const createdProduct = await postProductToShopify(productData);
    await setProductMetafields(createdProduct.id, [
      {
        namespace: "custom",
        key: "shopify_status",
        value: "active",
        type: "single_line_text_field",
      },
      {
        namespace: "custom",
        key: "inventory",
        value: "25",
        type: "number_integer",
      },
      {
        namespace: "custom",
        key: "weight_lb",
        value: "0.5",
        type: "number_decimal",
      },
      {
        namespace: "custom",
        key: "distributor_price",
        value: "19.99",
        type: "number_decimal",
      },
      {
        namespace: "custom",
        key: "msrp",
        value: "29.99",
        type: "number_decimal",
      },
      {
        namespace: "custom",
        key: "sku",
        value: "USB2VGAE2",
        type: "single_line_text_field",
      },
      {
        namespace: "custom",
        key: "compatibility",
        value: JSON.stringify({
          type: "root",
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "text",
                  value: "Works with Windows 10/11. Not supported on macOS.",
                },
              ],
            },
          ],
        }),
        type: "rich_text",
      },
    ]);

    res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: createdProduct,
    });
  } catch (err) {
    console.error(
      "Shopify product create error:",
      err.response?.data || err.message
    );
    res
      .status(500)
      .json({ error: err.response?.data || "Something went wrong" });
  }
});

// Create Collection
router.post("/collection", async (req, res) => {
  try {
    const payload = {
      custom_collection: {
        title: "Top Best Picks",
        body_html:
          "<p>Our best-selling and most-loved tech products. Curated with care for professionals, gamers, and creators alike.</p>",
        handle: "top-best-picks", // changed from "top-picks"
        sort_order: "best-selling",
        published: true,
        image: {
          src: "https://cdn.shopify.com/s/files/1/0697/0933/2643/files/photo-1559163499-413811fb2344.jpg",
        },
      },
    };

    const url = `${process.env.SHOPIFY_STORE_URL}/admin/api/${process.env.SHOPIFY_API_VERSION}/custom_collections.json`;

    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
      },
    });

    res.status(201).json({ success: true, data: response.data });
  } catch (err) {
    console.error(
      "Shopify collection create error:",
      err.response?.data || err.message
    );
    res
      .status(500)
      .json({ error: err.response?.data || "Something went wrong" });
  }
});

// Add Products to Collection
router.post("/collection/add", async (req, res) => {
  const { productIds, collectionTitle } = req.body;

  try {
    if (!Array.isArray(productIds) || !collectionTitle) {
      return res
        .status(400)
        .json({ error: "Missing or invalid productIds or collectionTitle" });
    }

    const collectionId = await findCollectionIdByTitle(collectionTitle);
    if (!collectionId) {
      return res.status(404).json({ error: "Collection not found" });
    }

    const result = await addMultipleProductsToCollection(
      productIds,
      collectionId
    );
    res.status(200).json({ success: true, result });
  } catch (err) {
    console.error("Add to collection error:");
    console.dir(err.response?.data || err.message, { depth: null });

    res.status(500).json({ error: "Failed to add products to collection" });
  }
});

// Fetch All Products
router.get("/products", async (req, res) => {
  try {
    const products = await fetchShopifyProducts();
    res.json(products);
  } catch (error) {
    console.error("Shopify API error:", error.message);
    res.status(500).json({ error: "Failed to fetch products from Shopify" });
  }
});

router.post("/webhook/order", async (req, res) => {
  const order = req.body;
  console.log("📦 New Shopify Order Received:", order);

  // 1. Save order to DB
  // 2. Queue SYNNEX + Zoho logic (later)

  res.status(200).send("ok");
});

router.delete("/products/cleanup", async (req, res) => {
  try {
    const deleted = await deleteProductsWithoutPriceOrImage();
    res.status(200).json({
      success: true,
      message: `Deleted ${deleted.length} products without price or image`,
      data: deleted,
    });
  } catch (err) {
    console.error("❌ Cleanup error:", err.message);
    res.status(500).json({ error: "Failed to clean up products" });
  }
});

export default router;
