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

  const printerTerms = [
    "laserjet",
    "inkjet",
    "printer",
    "mfp",
    "aio",
    "officejet",
    "designjet",
    "deskjet",
    "pagewide",
    "label printer",
    "impact printer",
    "dot matrix",
    "smartlabel",
    "thermal printer",
    "imageclass",
    "imageprograf",
    "ecosys",
  ];

  const printerSupplyTerms = [
    "remanufactured consumable",
    "toner",
    "ink",
    "cartridge",
    "fuser",
    "drum",
    "ribbon",
    "maintenance kit",
    "staple cartridge",
    "print ribbon",
  ];

  const workstationTerms = [
    "mobile precision",
    "precision tower",
    "tower workstation",
    "compact workstation",
  ];

  const aios = ["all in one", "aio"];
  const sff = ["small form factor"];
  const micro = ["micro"];
  const optiplex = ["optiplex"];

  const typeMap = {
    laptop: "Laptop",
    notebook: "Laptop",
    desktop: "Desktop",
    backpack: "Bag",
    charger: "Charger",
    adapter: "Adapter",
    monitor: "Monitor",
    mouse: "Mouse",
    keyboard: "Keyboard",
    webcam: "Webcam",
    dock: "Dock",
    phone: "Phone",
    speaker: "Speaker",
    stylus: "Stylus",
    pen: "Stylus",
    tab: "Tablet",
    tablet: "Tablet",
    handle: "Tablet Accessory",
    strap: "Tablet Accessory",
  };

  // Precision-based checks
  for (const term of workstationTerms)
    if (lowerDesc.includes(term)) return "Workstation";

  for (const term of aios)
    if (lowerDesc.includes(term) && lowerDesc.includes("optiplex"))
      return "All-in-One PC";

  for (const term of sff)
    if (lowerDesc.includes(term) && lowerDesc.includes("optiplex"))
      return "Small Form Factor PC";

  for (const term of micro)
    if (lowerDesc.includes(term) && lowerDesc.includes("optiplex"))
      return "Mini PC";

  for (const term of optiplex)
    if (lowerDesc.includes(term)) return "Desktop PC";

  for (const term of printerTerms)
    if (lowerDesc.includes(term)) return "Printer";

  for (const term of printerSupplyTerms)
    if (lowerDesc.includes(term)) return "Printer Supply";

  for (const [keyword, type] of Object.entries(typeMap))
    if (lowerDesc.includes(keyword)) return type;

  // Scraped fallback
  const scrapedSections = Object.keys(scraped.specifications || {});
  for (const section of scrapedSections) {
    const lower = section.toLowerCase();
    if (lower.includes("laptop")) return "Laptop";
    if (lower.includes("printer")) return "Printer";
    if (lower.includes("monitor")) return "Monitor";
    if (lower.includes("bag")) return "Bag";
  }

  return "Miscellaneous";
};

const KNOWN_BRANDS = [
  "HP",
  "HPI",
  "HP Inc.",
  "DELL",
  "Dell CSG",
  "Lenovo",
  "Acer",
  "Asus",
  "Canon",
  "Epson",
  "Lexmark",
  "Brother",
  "Toshiba",
  "Xerox",
  "Kyocera",
  "Seiko",
  "StarTech",
  "LG",
  "Neat",
  "TROY",
  "Deepcool",
  "Tripp",
  "C2G",
  "DYMO",
  "Newell",
  "Samsung",
  "MSI",
  "Razer",
  "Clover Imaging Group",
];

export const detectVendor = (title = "", description = "") => {
  const combinedText = `${title} ${description}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const titleWords = title.trim().split(/\s+/);

  for (const brand of KNOWN_BRANDS) {
    const cleanBrand = brand
      .toLowerCase()
      .replace(/ inc\.?| csg/g, "")
      .trim();
    if (combinedText.includes(cleanBrand)) {
      return brand.replace(/ inc\.?| csg/g, "").trim();
    }
  }

  const blockedFallbacks = [
    "optiplex",
    "latitude",
    "thinkpad",
    "envy",
    "precision",
  ];

  const firstWord = titleWords[0]?.toLowerCase();
  if (firstWord && !blockedFallbacks.includes(firstWord)) {
    return titleWords[0][0].toUpperCase() + titleWords[0].slice(1); // Capitalized
  }

  return "BrokerBand"; // Brand fallback
};
