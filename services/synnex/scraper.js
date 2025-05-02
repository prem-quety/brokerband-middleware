import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { readFile } from "fs/promises";

export const scrapeSkuDetails = async (sku) => {
  sku = sku.trim(); // ✅ Sanitize input (fixes \n bugs)

  const cookiesPath = path.resolve("data", "cookies.json");
  const cookies = JSON.parse(await readFile(cookiesPath, "utf-8"));

  const screenshotDir = path.resolve("logs", "screenshots");
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(cookies);
  const page = await context.newPage();

  const url = `https://ec.synnex.ca/ecx/part/techNote.html?skuNo=${sku}`;
  console.log(`🔍 Navigating to ${url}`);
  await page.goto(url, { timeout: 60000 });

  const title = await page.title();
  const currentURL = page.url();
  const pageTitle = await page.title();

  await page.screenshot({
    path: path.join(screenshotDir, `${sku}.png`),
  });

  // ❌ If login required, return fallback
  console.log(`📄 Page Title for SKU ${sku}: ${pageTitle}`);
  if (title.toLowerCase().includes("login") || currentURL.includes("login")) {
    await browser.close();
    throw new Error(`❌ Session expired: SYNNEX login required for SKU ${sku}`);
  }

  // ✅ Scrape ALL image URLs (converted to high-res)
  const image_urls = await page.evaluate(() => {
    const thumbnails = Array.from(
      document.querySelectorAll(".carousel-gallery img")
    );

    return thumbnails
      .map((img) => img.getAttribute("src"))
      .filter(Boolean)
      .map((src) =>
        src.startsWith("//")
          ? `https:${
              src
                .replace("small_image_technote", "image_technote")
                .split("?")[0]
            }`
          : null
      )
      .filter(Boolean);
  });

  console.log(`🖼️ Found ${image_urls.length} image(s) for SKU ${sku}`);
  if (!image_urls.length) {
    await browser.close();
    throw new Error(`❌ No product images found for SKU ${sku}`);
  }

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

      if (Object.keys(data).length) {
        result[title] = data;
      }
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
      warranty: data.warranty || null,
    };
  });

  const scrapedDescription = await page.evaluate(() => {
    const descEl = document.querySelector("p.product-description");
    return descEl?.innerText.trim() || null;
  });

  await browser.close();

  return {
    image_urls,
    specifications,
    extraDetails,
    description: scrapedDescription,
  };
};
