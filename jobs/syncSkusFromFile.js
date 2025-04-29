// jobs/syncSkusFromFile.js
import { readFile } from "fs/promises";
import path from "path";
import { syncSynnexToShopify } from "../services/synnex/sync.js"; // <-- new path if you modularized

export const syncSkusFromFile = async (
  filePath = "./data/filtered_skus_two.json"
) => {
  const raw = await readFile(filePath, "utf-8");
  const list = JSON.parse(raw);

  let success = 0;
  const failed = [];

  for (let i = 0; i < list.length; i++) {
    const sku = list[i]?.sku;
    if (!sku) continue;

    console.log(`🔄 Syncing SKU [${i + 1}/${list.length}]: ${sku}`);
    try {
      const result = await syncSynnexToShopify(sku);
      if (result) success++;
    } catch (err) {
      console.error(`❌ Failed for SKU ${sku}: ${err.message}`);
      failed.push(sku);
    }

    await new Promise((res) => setTimeout(res, 1000)); // optional throttle
  }

  return { synced: success, failed, total: list.length };
};
