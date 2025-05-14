import express from "express";
import { handleOAuthCallback, startOAuthFlow } from "../services/zoho/auth.js";

const router = express.Router();

router.get("/auth", startOAuthFlow); // redirects to Zoho
router.get("/oauth/callback", handleOAuthCallback); // handles Zoho's redirect

export default router;
