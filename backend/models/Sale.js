const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  billId: { type: String, unique: true },
  customerMobile: { type: String },
  items: [{  // Array of sold items
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    name: String,
    quantity: Number,
    sellPrice: Number,
    total: Number  // quantity * sellPrice
  }],
  totalAmount: { type: Number },  // Before discount
  totalCost: { type: Number },  // Seller's cost (for profit calc)
  discountType: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
  discountValue: { type: Number, default: 0 },
  discountedTotal: { type: Number, default: 0 },  // After discount
  profit: { type: Number },  // discountedTotal - totalCost
  date: { type: Date, default: Date.now },
  billPdfUrl: { type: String }  // Link to generated PDF
});

module.exports = mongoose.model('Sale', saleSchema);
