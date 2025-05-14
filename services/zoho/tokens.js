import axios from "axios";
import dotenv from "dotenv";
import ZohoToken from "../../models/ZohoToken.js";

dotenv.config();

// 🔸 Save tokens to MongoDB
export const saveTokensToDb = async (tokenData) => {
  await ZohoToken.deleteMany({});
  await ZohoToken.create(tokenData);
  console.log("✅ Tokens saved to DB");
};

// 🔸 Load tokens from MongoDB
export const loadTokensFromDb = async () => {
  return await ZohoToken.findOne({});
};

// 🔄 Refresh access token using refresh_token
export const refreshAccessToken = async () => {
  const saved = await loadTokensFromDb();
  if (!saved?.refresh_token) throw new Error("Refresh token not found.");

  const response = await axios.post("https://accounts.zoho.com/oauth/v2/token", null, {
    params: {
      refresh_token: saved.refresh_token,
      client_id: process.env.ZOHO_CLIENT_ID,
      client_secret: process.env.ZOHO_CLIENT_SECRET,
      grant_type: "refresh_token",
    },
  });

  const newTokens = {
    ...saved.toObject(),
    access_token: response.data.access_token,
    expires_in: response.data.expires_in,
    fetched_at: new Date(),
  };

  await saveTokensToDb(newTokens);
  return newTokens.access_token;
};


// 🧠 Get valid token — uses saved or refreshes if needed
export const getZohoAccessToken = async () => {
  const tokens = await loadTokensFromDb();
  if (!tokens || !tokens.access_token) throw new Error("No tokens found in DB.");

  // Optional: Check if expired and auto-refresh
  // For now, just return it
  return tokens.access_token;
};
