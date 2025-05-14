import fs from "fs";
import axios from "axios";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

const TOKEN_PATH = path.join(process.cwd(), "zoho_tokens.json");

// 🔸 Save tokens to file
export const saveTokensToFile = (tokenData) => {
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData, null, 2));
  console.log("✅ Tokens saved to zoho_tokens.json");
};

// 🔸 Load tokens from file
export const loadTokensFromFile = () => {
  if (!fs.existsSync(TOKEN_PATH)) return null;
  const raw = fs.readFileSync(TOKEN_PATH);
  return JSON.parse(raw);
};

// 🔄 Refresh access token using refresh_token
export const refreshAccessToken = async () => {
  const saved = loadTokensFromFile();
  if (!saved || !saved.refresh_token) throw new Error("Refresh token not found.");

  const response = await axios.post("https://accounts.zoho.com/oauth/v2/token", null, {
    params: {
      refresh_token: saved.refresh_token,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: "refresh_token",
    },
  });

  const newTokens = {
    ...saved,
    access_token: response.data.access_token,
    expires_in: response.data.expires_in,
  };

  saveTokensToFile(newTokens);
  return newTokens.access_token;
};

// 🧠 Get valid token — uses saved or refreshes if needed
export const getZohoAccessToken = async () => {
  const tokens = loadTokensFromFile();
  if (!tokens || !tokens.access_token) throw new Error("No tokens found.");

  // You can later add expiry check here
  return tokens.access_token;
};
