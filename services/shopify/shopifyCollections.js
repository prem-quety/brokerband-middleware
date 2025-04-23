import dotenv from "dotenv";
dotenv.config(); // Must be first before accessing env vars

import axios from "axios";

// Build base URL safely
const baseURL = `${process.env.SHOPIFY_STORE_URL}/admin/api/${process.env.SHOPIFY_API_VERSION}`;
const headers = {
  "Content-Type": "application/json",
  "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
};

// Find a collection ID by title
export const findCollectionIdByTitle = async (title) => {
  try {
    const res = await axios.get(`${baseURL}/custom_collections.json`, {
      headers,
    });
    const collection = res.data.custom_collections.find(
      (c) => c.title === title
    );
    return collection?.id || null;
  } catch (err) {
    console.error(
      "❌ Error fetching collections:",
      err.response?.data || err.message
    );
    throw err;
  }
};

// Add multiple products to a collection (sequentially)
export const addMultipleProductsToCollection = async (
  productIds,
  collectionId
) => {
  const results = [];

  for (const product_id of productIds) {
    const payload = {
      collect: {
        product_id,
        collection_id: collectionId,
      },
    };

    try {
      console.log(
        "📦 Adding product",
        product_id,
        "to collection",
        collectionId
      );
      console.log("➡️ POST:", `${baseURL}/collects.json`);

      const res = await axios.post(`${baseURL}/collects.json`, payload, {
        headers,
      });
      results.push({
        product_id,
        status: "success",
        collectId: res.data.collect.id,
      });
    } catch (err) {
      const errorMsg = err.response?.data || err.message;
      console.error(`❌ Failed to add product ${product_id}:`, errorMsg);

      results.push({
        product_id,
        status: "error",
        message: errorMsg,
      });
    }
  }

  return results;
};
