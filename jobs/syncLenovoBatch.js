import path from "path";
import { syncSkusFromFile } from "./syncSkusFromFile.js";

export const syncLenovoSKUsFromFile = async () => {
  const filePath = path.resolve("data", "filtered_dell_systems.json");
  return await syncSkusFromFile(filePath);
};
