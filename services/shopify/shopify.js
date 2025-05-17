import axios from "axios";

/**
 * Sets multiple metafields on a Shopify product
 * @param {string} productId - Shopify product ID
 * @param {Array} fields - Array of metafield objects
 */
export const setProductMetafields = async (productId, fields) => {
  const url = `${process.env.SHOPIFY_STORE_URL}/admin/api/${process.env.SHOPIFY_API_VERSION}/products/${productId}/metafields.json`;

  console.log(`⚙️  Setting metafields for product ID: ${productId}`);

  for (const field of fields) {
    const payload = {
      metafield: {
        namespace: field.namespace,
        key: field.key,
        value: field.value,
        type: field.type,
      },
    };

    console.log("📤 Payload:", JSON.stringify(payload, null, 2));

    try {
      const { data } = await axios.post(url, payload, {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
        },
      });

      console.log(
        `✅ Set metafield: ${field.key}`,
        JSON.stringify(data, null, 2)
      );
    } catch (err) {
      console.error(`❌ Error setting ${field.key}:`);
      if (err.response?.data) {
        console.dir(err.response.data, { depth: null });
      } else {
        console.error(err.message);
      }
    }
  }
};

export const fetchShopifyProducts = async () => {
  const url = `${process.env.SHOPIFY_STORE_URL}/admin/api/${process.env.SHOPIFY_API_VERSION}/products.json`;

  const { data } = await axios.get(url, {
    headers: {
      "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
      "Content-Type": "application/json",
    },
  });

  return data.products;
};

export const postProductToShopify = async (productData) => {
  try {
    const payload = { product: productData };

    const url = `${process.env.SHOPIFY_STORE_URL}/admin/api/${process.env.SHOPIFY_API_VERSION}/products.json`;

    const response = await axios.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
      },
    });

    return response.data.product;
  } catch (err) {
    console.error(
      "Shopify product creation failed:",
      err.response?.data || err.message
    );
    throw err;
  }
};

export const deleteProductsWithoutPriceOrImage = async () => {
  const deleted = [];
  let nextPageUrl = `${process.env.SHOPIFY_STORE_URL}/admin/api/${process.env.SHOPIFY_API_VERSION}/products.json?limit=250`;

  while (nextPageUrl) {
    const response = await axios.get(nextPageUrl, {
      headers: {
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
        "Content-Type": "application/json",
      },
    });

    const products = response.data.products || [];
    console.log(`📦 Fetched ${products.length} products`);

    for (const product of products) {
      const hasImage = product.images?.length > 0;
      const price = parseFloat(product.variants?.[0]?.price || "0");
      const hasPrice = !isNaN(price) && price > 0;

      if (!hasImage || !hasPrice) {
        const deleteUrl = `${process.env.SHOPIFY_STORE_URL}/admin/api/${process.env.SHOPIFY_API_VERSION}/products/${product.id}.json`;

        await axios.delete(deleteUrl, {
          headers: {
            "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN,
          },
        });

        deleted.push({ id: product.id, title: product.title });
        console.log(`🗑️ Deleted: ${product.title}`);
      }
    }

    // Use Link header to get next page URL
    const linkHeader = response.headers.link;
    const nextMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/);
    nextPageUrl = nextMatch ? nextMatch[1] : null;
  }

  console.log(`✅ Finished. Total deleted: ${deleted.length}`);
  return deleted;
};


const STORE = process.env.SHOPIFY_STORE_URL;
const API_VER = STORE.includes("brokerband-dev")
  ? "2025-04"    // your dev store
  : "2025-01";   // your real store
const TOKEN   = process.env.SHOPIFY_ADMIN_TOKEN;

export const getAllShopifyProducts = async () => {
  console.log("[Shopify] → start getAllShopifyProducts");
  const limit = 250;
  let nextPageUrl = `${STORE}/admin/api/${API_VER}/products.json?limit=${limit}`;
  const all = [];

  while (nextPageUrl) {
    console.log(`[Shopify] → GET ${nextPageUrl}`);
    let res;
    try {
      res = await axios.get(nextPageUrl, {
        headers: { "X-Shopify-Access-Token": TOKEN },
      });
    } catch (err) {
      console.error("[Shopify] ← fetch error:", err.response?.status, err.response?.data);
      throw err;
    }

    const products = res.data.products || [];
    console.log(`[Shopify] ← got ${products.length} products`);
    all.push(...products);

    // parse Link header for next cursor
    const link = res.headers.link;
    const match = link?.match(/<([^>]+)>;\s*rel="next"/);
    nextPageUrl = match ? match[1] : null;
  }

  console.log(`[Shopify] ← fetched total ${all.length}`);
  return all;
};
