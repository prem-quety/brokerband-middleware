import axios from "axios";
import { saveTokensToFile } from "./tokens.js";
export const startOAuthFlow = (req, res) => {
  const redirectUrl = `https://accounts.zoho.com/oauth/v2/auth?response_type=code&client_id=${process.env.ZOHO_CLIENT_ID}&scope=ZohoBooks.fullaccess.all&redirect_uri=${process.env.ZOHO_REDIRECT_URI}&access_type=offline&prompt=consent`;
  res.redirect(redirectUrl);
};

export const handleOAuthCallback = async (req, res) => {
  const { code } = req.query;

  if (!code) return res.status(400).send("No code provided.");

  try {
    const tokenResponse = await axios.post("https://accounts.zoho.com/oauth/v2/token", null, {
      params: {
        code,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        redirect_uri: process.env.ZOHO_REDIRECT_URI,
        grant_type: "authorization_code",
      },
    });

    const tokens = tokenResponse.data;
    saveTokensToFile(tokens);
    // TEMP: log to console for now — later write to DB or secure file
    console.log("🔥 Zoho Tokens:", tokens);

    res.send("✅ Zoho OAuth Success. Tokens logged in console.");
  } catch (err) {
    console.error("❌ Token exchange failed:", err.response?.data || err.message);
    res.status(500).send("Zoho token exchange failed.");
  }
};
