const express = require('express');
const multer = require('multer');
const Papa = require('papaparse');
const Product = require('../models/Product');
const Alert = require('../models/Alert');
const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Add New Product (Manual)
router.post('/add', async (req, res) => {
  try {
    const { name, category, quantity, buyPrice, sellPrice, lowStockThreshold, expiryDate } = req.body;
    const profitPerUnit = sellPrice - buyPrice;
    const profitPercent = buyPrice > 0 ? (profitPerUnit / buyPrice) * 100 : 0;
    const isLowStock = quantity < (lowStockThreshold || 10);

    const product = new Product({ 
      name, 
      category, 
      quantity, 
      buyPrice, 
      sellPrice, 
      profitPerUnit, 
      profitPercent, 
      lowStockThreshold: lowStockThreshold || 10, 
      expiryDate: expiryDate ? new Date(expiryDate) : null, 
      isLowStock 
    });
    await product.save();

    // Create alert if low stock
    if (isLowStock) {
      await new Alert({ productId: product._id, message: `Low stock alert for ${name}` }).save();
    }

    res.json({ success: true, product });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Upload Products from CSV (Advanced)
router.post('/upload', upload.single('csv'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });

  Papa.parse(req.file.buffer.toString(), {
    header: true,
    complete: async (results) => {
      try {
        const products = results.data
          .filter(row => row.name && row.buyPrice && row.sellPrice)  // Valid rows only
          .map(row => {
            const buyPrice = parseFloat(row.buyPrice) || 0;
            const sellPrice = parseFloat(row.sellPrice) || 0;
            const profitPerUnit = sellPrice - buyPrice;
            const profitPercent = buyPrice > 0 ? (profitPerUnit / buyPrice) * 100 : 0;
            const quantity = parseInt(row.quantity) || 0;
            const lowStockThreshold = parseInt(row.lowStockThreshold) || 10;
            const isLowStock = quantity < lowStockThreshold;

            return new Product({
              name: row.name,
              category: row.category || '',
              quantity,
              buyPrice,
              sellPrice,
              profitPerUnit,
              profitPercent,
              lowStockThreshold,
              expiryDate: row.expiryDate ? new Date(row.expiryDate) : null,
              isLowStock
            });
          });

        await Product.insertMany(products);
        res.json({ success: true, count: products.length, message: 'Products uploaded from CSV' });
      } catch (error) {
        res.status(400).json({ error: error.message });
      }
    }
  });
});

// Get All Products (with filters/sort)
router.get('/', async (req, res) => {
  try {
    const { sortBy = 'name', filterBy, category } = req.query;
    let query = {};
    if (filterBy === 'lowStock') query.isLowStock = true;
    if (category) query.category = category;

    const sortOptions = {
      name: { name: 1 },
      profit: { profitPercent: -1 },
      quantity: { quantity: -1 }
    };
    const sort = sortOptions[sortBy] || { name: 1 };

    const products = await Product.find(query).sort(sort).lean();  // lean() for faster query
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update Product Quantity (After Sale/Billing)
router.patch('/:id/update-quantity', async (req, res) => {
  try {
    const { quantitySold } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    product.quantity -= quantitySold;
    product.isLowStock = product.quantity < product.lowStockThreshold;
    await product.save();

    // Alert if now low stock
    if (product.isLowStock && product.quantity >= 0) {  // Avoid negative alerts
      await new Alert({ productId: product._id, message: `Low stock for ${product.name} (Qty: ${product.quantity})` }).save();
    }

    res.json({ success: true, product });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
