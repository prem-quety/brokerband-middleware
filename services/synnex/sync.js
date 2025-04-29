// /services/synnex/sync.js
import { fetchSynnexPriceData } from "./apiFetcher.js";
import { scrapeSkuDetails } from "./scraper.js";
import { mapSynnexToShopify, buildMetafieldsFromSynnex } from "./mappings.js";
import {
  postProductToShopify,
  setProductMetafields,
} from "../shopify/shopify.js";
import { log } from "../../utils/helpers.js";

export const syncSynnexToShopify = async (synnexSKU) => {
  const [apiData, scraped] = await Promise.all([
    fetchSynnexPriceData(synnexSKU),
    scrapeSkuDetails(synnexSKU),
  ]);

  if (!apiData) {
    log("warn", `No data returned for SKU: ${synnexSKU}`);
    return;
  }

  const payload = mapSynnexToShopify(apiData);
  if (scraped.image_url) payload.images = [{ src: scraped.image_url }];

  const created = await postProductToShopify(payload);
  const metafields = buildMetafieldsFromSynnex(apiData, created, scraped);
  await setProductMetafields(created.id, metafields);

  log("info", `✅ Synced product + metafields for SKU: ${synnexSKU}`);
  return created;
};
