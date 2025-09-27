const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, default: '' },
  quantity: { type: Number, required: true, default: 0 },
  buyPrice: { type: Number, required: true },
  sellPrice: { type: Number, required: true },
  profitPerUnit: { type: Number, default: 0 },  // Auto: sellPrice - buyPrice
  profitPercent: { type: Number, default: 0 },  // Auto: (profitPerUnit / buyPrice) * 100
  refillDate: { type: Date, default: Date.now },
  expiryDate: { type: Date },
  lowStockThreshold: { type: Number, default: 10 },
  image: { type: String },  // Optional image URL
  isLowStock: { type: Boolean, default: false }  // Auto-flag if quantity low
});

module.exports = mongoose.model('Product', productSchema);
