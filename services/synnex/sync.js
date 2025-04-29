import { fetchSynnexPriceData } from "./apiFetcher.js";
import { scrapeSkuDetails } from "./scraper.js";
import { mapSynnexToShopify, buildMetafieldsFromSynnex } from "./mappings.js";
import {
  postProductToShopify,
  setProductMetafields,
} from "../shopify/shopify.js";
import { log, logSyncSuccess, logSyncFailure } from "../../utils/helpers.js";

export const syncSynnexToShopify = async (synnexSKU) => {
  try {
    const [apiData, scraped] = await Promise.all([
      fetchSynnexPriceData(synnexSKU),
      scrapeSkuDetails(synnexSKU),
    ]);

    if (!apiData) {
      log("warn", `No data returned for SKU: ${synnexSKU}`);
      await logSyncFailure(
        synnexSKU,
        new Error("No data returned from SYNNEX API")
      );
      return;
    }

    const payload = mapSynnexToShopify(apiData);
    if (scraped.image_url) payload.images = [{ src: scraped.image_url }];

    const created = await postProductToShopify(payload);
    const metafields = buildMetafieldsFromSynnex(apiData, created, scraped);
    const metafieldResponses = await setProductMetafields(
      created.id,
      metafields
    );

    // New: save full sync to MongoDB
    await logSyncSuccess({
      sku: synnexSKU,
      apiData,
      scraped,
      created,
      payload,
      metafields,
      metafieldResponses,
      inflatedCompareAtPrice: parseFloat(payload.variants[0].compare_at_price),
    });

    log("info", `✅ Synced product + metafields for SKU: ${synnexSKU}`);
    return created;
  } catch (err) {
    log("error", `❌ Sync failed for SKU: ${synnexSKU}`, err);
    await logSyncFailure(synnexSKU, err);
    throw err;
  }
};
