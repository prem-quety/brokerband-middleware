import mongoose from "mongoose";

const zohoTokenSchema = new mongoose.Schema({
  access_token: String,
  refresh_token: String,
  expires_in: Number,
  api_domain: String,
  scope: String,
  token_type: String,
  fetched_at: { type: Date, default: Date.now },
}, { collection: "zoho_tokens" });

export default mongoose.model("ZohoToken", zohoTokenSchema);
