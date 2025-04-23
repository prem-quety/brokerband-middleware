import mongoose from "mongoose";

const schema = new mongoose.Schema({
  test: String,
});

export default mongoose.model("Order", schema);
