import fs from "fs/promises";
import { parseStringPromise, Builder } from "xml2js";
import SyncLog from "../models/SyncLog.js";

/* ===========================
    LOGGING
=========================== */
export const log = (level, message, ...args) => {
  const time = new Date().toISOString();
  console[level](`[${time}] ${message}`, ...args);
};

/* ===========================
    FILE READ/WRITE
=========================== */
export const readJSON = async (path) =>
  JSON.parse(await fs.readFile(path, "utf8"));
export const writeJSON = async (path, data) =>
  fs.writeFile(path, JSON.stringify(data, null, 2));

/* ===========================
    XML PARSING
=========================== */
export const parseXML = async (xml) => await parseStringPromise(xml);
export const buildXML = (obj) => new Builder().buildObject(obj);

/* ===========================
    ERROR HANDLING
=========================== */
export const extractError = (err) => {
  return err?.response?.data || err?.message || "Unknown error";
};

/* ===========================
    STRING UTILS
=========================== */
export const slugify = (text) => text.toLowerCase().replace(/\s+/g, "-");
export const titleCase = (str) =>
  str.replace(/\b\w/g, (char) => char.toUpperCase());

export const logSyncSuccess = async ({
  sku,
  apiData,
  scraped,
  created,
  payload,
  metafields,
  metafieldResponses,
  inflatedCompareAtPrice,
}) => {
  const logData = {
    sku,
    mfgpn: apiData.mfgPN,
    productTitle: apiData.description,
    description: apiData.description,
    price: Number(apiData.price),
    msrp: Number(apiData.msrp),
    inflatedCompareAtPrice: inflatedCompareAtPrice,
    quantityAvailable: Number(apiData.quantity),
    weight: Number(apiData.weight),
    vendor: apiData.description?.split(" ")[0] || "Unknown",
    warehouses: apiData.warehouses || [],

    shopifyProductId: created.id,
    shopifyPayload: payload,
    metafieldsPayload: metafields,
    shopifyMetafieldsResponse: metafieldResponses || [],

    imageUploaded: !!scraped.image_url,
    scrapedImageUrl: scraped.image_url || null,
    specsFound: Object.keys(scraped.specifications || {}).length > 0,
    scrapedSpecs: scraped.specifications,
    scrapedExtraDetails: scraped.extraDetails || {},

    status: "success",
  };

  await SyncLog.create(logData);
};

export const logSyncFailure = async (sku, err) => {
  console.error(
    `❌ Sync Failure for SKU ${sku}:`,
    err?.message || "Unknown error"
  );
  await SyncLog.create({
    sku,
    status: "failed",
    errorMessage: err?.message || "Unknown error",
    errorStack: err?.stack || null,
  });
};
