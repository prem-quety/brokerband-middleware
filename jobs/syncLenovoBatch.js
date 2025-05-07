import path from "path";
import { syncSkusFromFile } from "./syncSkusFromFile.js";

export const syncLenovoSKUsFromFile = async () => {
  const filePath = path.resolve("data", "filtered_skus_two.json");
  return await syncSkusFromFile(filePath);
};
