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

export const guessProductTags = ({
  description = "",
  brand = "",
  scraped = {},
}) => {
  const tags = new Set();

  // 1. Always add SYNNEX + Brand (if available)
  tags.add("Electronics");
  if (brand) tags.add(brand.toUpperCase());

  // 2. Keyword match from title/description
  const text = description.toLowerCase();
  const keywordMap = {
    laptop: "Laptop",
    backpack: "Bag",
    charger: "Charger",
    adapter: "Adapter",
    monitor: "Monitor",
    mouse: "Mouse",
    keyboard: "Keyboard",
    wireless: "Wireless",
    gaming: "Gaming",
    speaker: "Speaker",
    camera: "Camera",
  };

  Object.entries(keywordMap).forEach(([key, value]) => {
    if (text.includes(key)) tags.add(value);
  });

  // 3. Pull extra tags from scraped specs (like UNSPSC or categories)
  const specTags = Object.keys(scraped.specifications || {});
  specTags.forEach((section) => {
    if (section.length < 25) tags.add(section); // Add spec category names
  });

  // Fallback if not enough
  if (tags.size < 2) tags.add("Misc");

  return Array.from(tags);
};

export const guessProductType = ({ description = "", scraped = {} }) => {
  const lowerDesc = description.toLowerCase();

  // Normalize shorthand patterns
  const shorthandMap = {
    nb: "laptop", // NB = Notebook
    tp: "laptop", // ThinkPad
    t14: "laptop",
    x1: "laptop",
    r5: "laptop",
    ryzen: "laptop",
    intel: "laptop",
  };

  for (const [abbr, normalized] of Object.entries(shorthandMap)) {
    if (lowerDesc.includes(abbr)) return "Laptop";
  }

  // Main keyword map
  const typeMap = {
    laptop: "Laptop",
    notebook: "Laptop",
    backpack: "Bag",
    charger: "Charger",
    adapter: "Adapter",
    monitor: "Monitor",
    mouse: "Mouse",
    keyboard: "Keyboard",
    webcam: "Webcam",
    dock: "Dock",
    printer: "Printer",
    phone: "Phone",
    speaker: "Speaker",
  };

  for (const [keyword, type] of Object.entries(typeMap)) {
    if (lowerDesc.includes(keyword)) return type;
  }

  const scrapedSections = Object.keys(scraped.specifications || {});
  for (const section of scrapedSections) {
    const lower = section.toLowerCase();
    if (lower.includes("laptop")) return "Laptop";
    if (lower.includes("monitor")) return "Monitor";
    if (lower.includes("bag")) return "Bag";
  }

  return "Miscellaneous";
};
