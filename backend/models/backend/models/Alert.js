const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  message: { type: String, required: true },
  date: { type: Date, default: Date.now },
  sent: { type: Boolean, default: false }  // If notification sent (email/SMS)
});

module.exports = mongoose.model('Alert', alertSchema);
