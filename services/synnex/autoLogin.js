// File: services/synnex/autoLogin.js
import { chromium } from "playwright";
import path from "path";
import fs from "fs/promises";
import dotenv from "dotenv";

dotenv.config(); // Load .env

export const autoLoginAndSaveCookies = async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("🚀 Launching browser for SYNNEX login...");

  await page.goto("https://ec.synnex.ca/ecx/login.html", { timeout: 60000 });

  // Fill username and password
  await page.fill("#inputEmailAddress", process.env.SYNNEX_USERNAME);
  await page.fill("#inputPassword", process.env.SYNNEX_PASSWORD);
  await page.click("button[type='submit']");

  // Wait for successful navigation (assuming dashboard URL or some selector)
  await page.waitForLoadState("networkidle");

  console.log("✅ Logged in. Saving cookies...");

  const cookies = await context.cookies();
  const cookiesPath = path.resolve("data", "cookies.json");

  await fs.mkdir(path.dirname(cookiesPath), { recursive: true });
  await fs.writeFile(cookiesPath, JSON.stringify(cookies, null, 2));

  console.log(`🍪 Cookies saved to: ${cookiesPath}`);

  await browser.close();
};

autoLoginAndSaveCookies().catch((err) => {
  console.error("❌ Auto-login failed:", err.message);
  process.exit(1);
});
