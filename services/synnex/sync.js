// services/sync.service.js
import { readFile } from "fs/promises";
import { syncSynnexToShopify } from "./synnex.js"; // update path
import path from "path";

export const syncLenovoSKUsFromFile = async (
  filePath = "./filtered_skus_two.json"
) => {
  const file = await readFile(
    "./services/synnex/filtered_skus_two.json",
    "utf-8"
  );
  const list = JSON.parse(file);

  let success = 0;
  let failed = [];

  for (let i = 0; i < list.length; i++) {
    const sku = list[i]?.sku;
    if (!sku) continue;

    console.log(`\n🔄 Syncing SKU [${i + 1}/${list.length}]: ${sku}`);

    try {
      const result = await syncSynnexToShopify(sku);
      if (result) success++;
    } catch (err) {
      console.error(`❌ Failed for SKU ${sku}: ${err.message}`);
      failed.push(sku);
    }

    await new Promise((r) => setTimeout(r, 2000)); // optional delay
  }

  return {
    synced: success,
    failed,
    total: list.length,
  };
};
