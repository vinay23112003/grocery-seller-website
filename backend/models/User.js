const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },  // Hashed password
  role: { type: String, enum: ['admin', 'staff'], default: 'admin' },
  businessName: { type: String, default: 'Grocery Store' },
  whatsappApiKey: { type: String },  // For custom WhatsApp integration
  gstNumber: { type: String }  // Business GST
});

module.exports = mongoose.model('User ', userSchema);
