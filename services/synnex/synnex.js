import axios from "axios";
import { chromium } from "playwright";
import { readFile, writeFile } from "fs/promises";
import fs from "fs";
import path from "path";
import { buildXML, parseXML, log, extractError } from "../../utils/helpers.js";
import {
  postProductToShopify,
  setProductMetafields,
} from "../shopify/shopify.js";

const SYNNEX_URL = "https://ec.ca.tdsynnex.com/SynnexXML/PriceAvailability";

// Ensure log directories exist
const logDir = path.resolve("logs", "xml");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
const screenshotDir = path.resolve("logs", "screenshots");
if (!fs.existsSync(screenshotDir))
  fs.mkdirSync(screenshotDir, { recursive: true });

// ---------------------------
// STEP 1: Scrape Specs + Image + Extra Details
// ---------------------------
export const scrapeSkuDetails = async (sku) => {
  const cookiesPath = path.resolve("services", "synnex", "cookies.json");
  const cookies = JSON.parse(await readFile(cookiesPath, "utf-8"));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(cookies);

  const page = await context.newPage();
  const url = `https://ec.synnex.ca/ecx/part/techNote.html?skuNo=${sku}`;
  console.log(`🔍 Visiting: ${url}`);
  await page.goto(url, { timeout: 60000 });

  const pageTitle = await page.title();
  console.log(`📄 Page Title for SKU ${sku}: ${pageTitle}`);
  await page.screenshot({ path: path.join(screenshotDir, `${sku}.png`) });

  const currentURL = page.url();
  if (
    pageTitle.toLowerCase().includes("login") ||
    currentURL.includes("login")
  ) {
    console.warn(`❌ Session expired or login required for SKU ${sku}`);
    await browser.close();
    return { image_url: null, specifications: {}, extraDetails: {} };
  }

  const imageEl = await page.$("img.product-main-img");
  let image_url = imageEl ? await imageEl.getAttribute("src") : null;
  if (image_url?.startsWith("//")) image_url = `https:${image_url}`;
  if (!image_url) console.warn(`⚠️ No image found for SKU ${sku}`);

  const specifications = await page.evaluate(() => {
    const container = document.querySelector("#tabContext_spec");
    if (!container) return {};
    const result = {};
    container.querySelectorAll("li.tree-item").forEach((section) => {
      const title =
        section.querySelector("strong")?.innerText.trim() || "Unknown";
      const data = {};
      section.querySelectorAll("tr").forEach((row) => {
        const cols = row.querySelectorAll("td");
        if (cols.length === 2) {
          const key = cols[0].innerText.trim().replace(/:$/, "");
          const value = cols[1].innerText.trim();
          data[key] = value;
        }
      });
      if (Object.keys(data).length) result[title] = data;
    });
    return result;
  });

  const extraDetails = await page.evaluate(() => {
    const data = {};
    document.querySelectorAll("dl.product-vertical dt").forEach((dt) => {
      const key = dt.innerText.trim().replace(":", "");
      const dd = dt.nextElementSibling;
      if (!dd) return;
      const val =
        dd.querySelector("strong")?.innerText.trim() || dd.innerText.trim();
      if (["UNSPSC", "UPC", "Warranty"].includes(key)) {
        data[key.toLowerCase()] = val || null;
      }
    });
    return {
      upc: data.upc || null,
      unspsc: data.unspsc || null,
      warranty: data.warranty || null, // still returned but unused
    };
  });

  await browser.close();
  return { image_url, specifications, extraDetails };
};

// ---------------------------
// STEP 2: SYNNEX API Fetcher
// ---------------------------
export const fetchSynnexPriceData = async (synnexSKU) => {
  try {
    const requestXML = buildXML({
      priceRequest: {
        $: { version: "2.8" },
        customerNo: process.env.SYNNEX_CUSTOMER_NO,
        userName: process.env.SYNNEX_USERNAME,
        password: process.env.SYNNEX_PASSWORD,
        skuList: { synnexSKU, lineNumber: 1 },
      },
    });
    console.log("DEBUG SYNNEX CREDENTIALS:", {
      customerNo: process.env.SYNNEX_CUSTOMER_NO,
      username: process.env.SYNNEX_USERNAME,
      password: process.env.SYNNEX_PASSWORD,
    });

    const { data: rawXML } = await axios.post(SYNNEX_URL, requestXML, {
      headers: { "Content-Type": "application/xml" },
    });
    await writeFile(`./logs/xml/${synnexSKU}.xml`, rawXML);
    console.log(`🧾 Saved raw XML for SKU: ${synnexSKU}`);

    const parsed = await parseXML(rawXML);
    const product = parsed?.priceResponse?.PriceAvailabilityList?.[0];
    if (!product) {
      log("warn", `SYNNEX: SKU ${synnexSKU} skipped — no product data`);
      return null;
    }

    const status =
      product.status?.[0]?.toLowerCase() ||
      product.GlobalProductStatusCode?.[0]?.toLowerCase();
    if (["not found", "discontinued", "notauthorized"].includes(status)) {
      log("warn", `SYNNEX: SKU ${synnexSKU} skipped — status: ${status}`);
      return null;
    }

    const warehouses = (product.AvailabilityByWarehouse || []).map((entry) => ({
      city: entry.warehouseInfo?.[0]?.city?.[0],
      qty: parseInt(entry.qty?.[0] || 0),
    }));

    return {
      synnexSKU: product.synnexSKU?.[0],
      mfgPN: product.mfgPN?.[0],
      description: product.description?.[0],
      price: product.price?.[0],
      msrp: product.msrp?.[0],
      quantity: product.totalQuantity?.[0],
      weight: product.weight?.[0],
      parcelShippable: product.parcelShippable?.[0],
      warehouses,
      status,
    };
  } catch (err) {
    log("error", "Failed to fetch SYNNEX product:", extractError(err));
    return null;
  }
};

// ---------------------------
// STEP 3: Map Product to Shopify
// ---------------------------
export const mapSynnexToShopify = (item) => {
  const title = item.description || "Unnamed Product";
  const type = "Adapters";
  const price = parseFloat(item.msrp || 0).toFixed(2);
  const msrp = parseFloat(item.msrp || 0).toFixed(2);
  const compareAtPrice = (msrp * 1.1).toFixed(2);
  const weight = parseFloat(item.weight || 0.5);
  const vendor = title.trim().split(" ")[0] || "QueryTel";
  return {
    title,
    body_html: `<p>${title}</p>`,
    vendor,
    product_type: type,
    tags: [type],
    status: "active",
    variants: [
      {
        sku: item.mfgPN,
        price,
        compare_at_price: compareAtPrice,
        weight,
        weight_unit: "lb",
        inventory_quantity: parseInt(item.quantity || 0),
        inventory_management: "shopify",
        fulfillment_service: "manual",
      },
    ],
  };
};

// ---------------------------
// STEP 4: Metafields Builder
// ---------------------------
const buildMetafieldsFromSynnex = (data, product) => [
  {
    namespace: "custom",
    key: "shopify_status",
    value: product.status || "draft",
    type: "single_line_text_field",
  },
  {
    namespace: "custom",
    key: "msrp",
    value: String(data.msrp || 0),
    type: "number_decimal",
  },
  {
    namespace: "custom",
    key: "distributor_price",
    value: String(data.price || 0),
    type: "number_decimal",
  },
  {
    namespace: "custom",
    key: "compatibility",
    value: JSON.stringify({
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              value:
                "Compatible with Windows. Not supported on macOS, ChromeOS, or Linux.",
            },
          ],
        },
      ],
    }),
    type: "rich_text_field",
  },
  {
    namespace: "custom",
    key: "shipping_info",
    value: JSON.stringify({
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              value:
                data.parcelShippable === "Y"
                  ? "Parcel shippable. Drop-shipped by MFG or local warehouse."
                  : "Shipping details not available.",
            },
          ],
        },
      ],
    }),
    type: "rich_text_field",
  },
  {
    namespace: "custom",
    key: "warehouse_breakdown",
    value: JSON.stringify({ warehouses: data.warehouses || [] }),
    type: "json",
  },
];

// ---------------------------
// STEP 5: Master Sync Function
// ---------------------------
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
  const metafields = buildMetafieldsFromSynnex(apiData, created);

  if (scraped.specifications && Object.keys(scraped.specifications).length) {
    metafields.push({
      namespace: "custom",
      key: "specifications",
      value: JSON.stringify(scraped.specifications),
      type: "json",
    });
  }

  const { upc, unspsc, warranty } = scraped.extraDetails || {};
  const { mfgPN } = apiData;

  if (upc) {
    metafields.push({
      namespace: "custom",
      key: "upc",
      value: String(upc),
      type: "single_line_text_field",
    });
  }

  if (unspsc) {
    metafields.push({
      namespace: "custom",
      key: "unspsc",
      value: String(unspsc),
      type: "single_line_text_field",
    });
  }

  // push MFR part number
  metafields.push({
    namespace: "custom",
    key: "mfr_pn",
    value: String(mfgPN),
    type: "single_line_text_field",
  });

  metafields.push({
    namespace: "custom",
    key: "warranty",
    value: warranty || "Call for Availability",
    type: "single_line_text_field",
  });

  await setProductMetafields(created.id, metafields);
  log("info", `✅ Synced product + metafields for SKU: ${synnexSKU}`);
  return created;
};
