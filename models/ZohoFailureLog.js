import mongoose from 'mongoose'

const ZohoFailureLogSchema = new mongoose.Schema({
  order_id: { type: String, required: true },
  type: { type: String, default: 'zoho_invoice' }, // could be 'zoho_contact' etc later
  message: { type: String },
  status: { type: String, default: 'failed' },
  retry_count: { type: Number, default: 2 },
  tried_at: { type: Date, default: Date.now },
  resolved: { type: Boolean, default: false },
}, { timestamps: true })

export default mongoose.model('ZohoFailureLog', ZohoFailureLogSchema)
