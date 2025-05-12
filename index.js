import express from "express";
import dotenv from "dotenv";
import shopifyRoutes from "./routes/shopify.routes.js"; // Combined routes
import mongoose from "mongoose";
import collectionRoutes from "./routes/collections.routes.js";
import synnexRoutes from "./routes/synnex.routes.js";
import orderRouter from "./routes/orders.shopify.routes.js"
dotenv.config();

mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));

const app = express();
const PORT = process.env.PORT || 8336;

app.use(express.json());

// Unified Shopify routes
app.use("/api/shopify", shopifyRoutes);
app.use("/api/shopify", collectionRoutes);
app.use("/api/synnex", synnexRoutes);
app.use("/api/orders", orderRouter);

app.get("/", (req, res) => {
  res.send("QueryTel + Shopify API Server is Live!");
});

app.listen(PORT, `0.0.0.0`, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});