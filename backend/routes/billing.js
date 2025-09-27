const express = require('express');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const pdfMake = require('pdfmake/build/pdfmake');
const vfs_fonts = require('pdfmake/build/vfs_fonts');
pdfMake.vfs = vfs_fonts.pdfMake.vfs;  // For PDF fonts
const twilio = require('twilio');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const router = express.Router();

// Twilio client (for WhatsApp/SMS - optional, comment out if no Twilio)
let client;
if (process.env.TWILIO_SID && process.env.TWILIO_TOKEN) {
  client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
}

// Create Bill with Discount
router.post('/create', async (req, res) => {
  try {
    const { items, customerMobile, discountType = 'fixed', discountValue = 0 } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    let totalAmount = 0;
    let totalCost = 0;
    const processedItems = [];

    // Process each item: Check stock, update quantity, calculate totals
    for (let item of items) {
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ error: `Product not found: ${item.name}` });
      }
      if (product.quantity < item.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${product.name}. Available: ${product.quantity}` });
      }

      // Update stock
      product.quantity -= item.quantity;
      product.isLowStock = product.quantity < product.lowStockThreshold;
      await product.save();

      // Add to processed items
      const itemTotal = item.quantity * product.sellPrice;
      processedItems.push({
        ...item,
        name: product.name,
        sellPrice: product.sellPrice,
        total: itemTotal
      });

      totalAmount += itemTotal;
      totalCost += item.quantity * product.buyPrice;

      // Update alert if low stock now
      if (product.isLowStock) {
        await new Alert({ productId: product._id, message: `Low stock after sale: ${product.name} (Qty: ${product.quantity})` }).save();
      }
    }

    // Apply Discount
    let discountedTotal = totalAmount;
    let discountAmount = 0;
    if (discountValue > 0) {
      if (discountType === 'percentage') {
        discountAmount = (totalAmount * discountValue) / 100;
      } else {
        discountAmount = discountValue;
      }
      discountedTotal = Math.max(0, totalAmount - discountAmount);
    }

    const profit = discountedTotal - totalCost;
    const billId = `BILL-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;  // Unique ID
    const sale = new Sale({
      billId,
      customerMobile,
      items: processedItems,
      totalAmount,
      totalCost,
      discountType,
      discountValue,
      discountedTotal,
      profit,
      billPdfUrl: ''  // Will update after PDF generation
    });
    await sale.save();

    // Generate PDF Bill
    const docDefinition = {
      content: [
        { text: 'Grocery Seller Bill Receipt', style: 'header', alignment: 'center' },
        { text: `Bill ID: ${billId}`, style: 'subheader' },
        { text: `Customer: ${customerMobile || 'Walk-in'}` },
        { text: `Date & Time: ${new Date().toLocaleString('en-IN')}` },
        { text: '\nItems:', style: 'subheader' },
        ...processedItems.map(item => [
          { 
            columns: [
              { text: `${item.name} x ${item.quantity}`, width: '50%' },
              { text: `@ ₹${item.sellPrice}`, width: '25%', alignment: 'right' },
              { text: `= ₹${item.total.toFixed(2)}`, width: '25%', alignment: 'right' }
            ],
            margin: [0, 2, 0, 2]
          }
        ]),
        '\n',
        { text: `Subtotal: ₹${totalAmount.toFixed(2)}`, alignment: 'right', bold: true },
        ...(discountValue > 0 ? [{
          text: `Discount (${discountType === 'percentage' ? `${discountValue}%` : `₹${discountValue}` }): -₹${discountAmount.toFixed(2)}`, 
          alignment: 'right', 
          color: 'green', 
          bold: true 
        }] : []),
        { text: `Total Payable: ₹${discountedTotal.toFixed(2)}`, alignment: 'right', fontSize: 16, bold: true, margin: [0, 10] },
        { text: `Seller Profit: ₹${profit.toFixed(2)}`, alignment: 'right', color: profit > 0 ? 'green' : 'red', italics: true },
        { text: '\nThank you for shopping! Visit again.', alignment: 'center', style: 'footer' }
      ],
      styles: {
        header: { fontSize: 20, bold: true, margin: [0, 0, 0, 20] },
        subheader: { fontSize: 14, bold: true, margin: [0, 10, 0, 5] },
        footer: { fontSize: 10, italics: true, margin: [0, 20] }
      },
      defaultStyle: { fontSize: 12 }
    };

    // Create PDF buffer and save
    const pdfDoc = pdfMake.createPdf(docDefinition);
    const pdfPath = path.join(__dirname, '../../uploads/bills', `${billId}.pdf`);
    fs.mkdirSync(path.dirname(pdfPath), { recursive: true });

    pdfDoc.getBuffer((buffer) => {
      fs.writeFileSync(pdfPath, buffer);
      const pdfUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/uploads/bills/${billId}.pdf`;
      sale.billPdfUrl = pdfUrl;
      sale.save();  // Update sale with PDF URL

      // Send WhatsApp Message (if Twilio configured)
      if (client && customerMobile) {
        const message = `🛒 Your Grocery Bill ${billId}\nSubtotal: ₹${totalAmount.toFixed(2)}\n${discountValue > 0 ? `Discount: ${discountType === 'percentage' ? `${discountValue}%` : `₹${discountValue}`}\n` : ''}Total: ₹${discountedTotal.toFixed(2)}\nView PDF: ${pdfUrl}\nProfit: ₹${profit.toFixed(2)}`;
        client.messages.create({
          from: 'whatsapp:+14155238886',  // Twilio Sandbox
          to: `whatsapp:+91${customerMobile}`,  // Indian number example
          body: message
        }).then(msg => console.log('WhatsApp sent:', msg.sid))
          .catch(err => console.error('WhatsApp error:', err));
      }
    });

    res.json({ 
      success: true, 
      saleId: sale._id, 
      billId, 
      discountedTotal, 
      profit: profit.toFixed(2), 
      billPdfUrl: sale.billPdfUrl,  // Will be updated async
      message: `Bill created successfully! Total: ₹${discountedTotal.toFixed(2)} (Profit: ₹${profit.toFixed(2)})` 
    });
  } catch (error) {
    console.error('Billing error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Get Recent Bills (History)
router.get('/history', async (req, res) => {
  try {
    const { limit = 10, dateFrom, dateTo } = req.query;
    let query = {};
    if (dateFrom) query.date = { $gte: new Date(dateFrom) };
    if (dateTo) query.date = { ...query.date, $lte: new Date(dateTo) };

    const sales = await Sale.find(query)
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .populate('items.productId', 'name sellPrice');  // Optional populate
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
