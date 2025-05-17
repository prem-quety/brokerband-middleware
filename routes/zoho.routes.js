import express from "express";
import { handleOAuthCallback, startOAuthFlow } from "../services/zoho/auth.js";
import { getOrganizationInfo } from "../services/zoho/org.js";
import { createOrGetCustomer } from "../services/zoho/customer.js";
import { runZohoProductSync } from "../jobs/runZohoSync.js";
const router = express.Router();

router.get("/auth", startOAuthFlow); // redirects to Zoho
router.get("/oauth/callback", handleOAuthCallback); // handles Zoho's redirect

router.get("/org", async (req, res) => {
  try {
    const data = await getOrganizationInfo();
    res.json(data);
  } catch (err) {
    console.error("❌ Failed to fetch org info:", err.message);
    res.status(500).send("Could not fetch organization info.");
  }
});

router.post("/customer", async (req, res) => {
  try {
    const shopifyCustomer = req.body;
    const customer = await createOrGetCustomer(shopifyCustomer);
    res.json(customer);
  } catch (err) {
    console.error("❌ Customer sync failed:", err.message);
    res.status(500).send("Zoho customer creation failed.");
  }
});

router.get('/sync-products', async (req, res) => {
  console.log('[Router] GET /sync-products hit')
  try {
    await runZohoProductSync()
    res.status(200).send('Product sync to Zoho completed')
  } catch (err) {
    console.error('[Router] sync error →', err.message)
    res.status(500).send('Zoho product sync failed')
  }
})

export default router;
