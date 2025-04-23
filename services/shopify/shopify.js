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
