const express = require('express');
const Sale = require('../models/Sale');
const router = express.Router();

// Get Daily Profits
router.get('/daily', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const sales = await Sale.aggregate([
      { $match: { date: { $gte: today, $lt: tomorrow } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$discountedTotal' },
          totalCost: { $sum: '$totalCost' },
          totalProfit: { $sum: '$profit' },
          billCount: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          date: today,
          totalRevenue: { $round: ['$totalRevenue', 2] },
          totalCost: { $round: ['$totalCost', 2] },
          totalProfit: { $round: ['$totalProfit', 2] },
          billCount: 1,
          profitMargin: { $round: [{ $multiply: [{ $divide: ['$totalProfit', '$totalRevenue'] }, 100] }, 2] }
        }
      }
    ]);

    const result = sales[0] || { totalRevenue: 0, totalCost: 0, totalProfit: 0, billCount: 0, profitMargin: 0 };
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Weekly Profits
router.get('/weekly', async (req, res) => {
  try {
    const endDate = new Date();
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 7);  // Last 7 days
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    const sales = await Sale.aggregate([
      { $match: { date: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$discountedTotal' },
          totalCost: { $sum: '$totalCost' },
          totalProfit: { $sum: '$profit' },
          billCount: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          period: 'Last 7 Days',
          totalRevenue: { $round: ['$totalRevenue', 2] },
          totalCost: { $round: ['$totalCost', 2] },
          totalProfit: { $round: ['$totalProfit', 2] },
          billCount: 1,
          profitMargin: { $round: [{ $multiply: [{ $divide: ['$totalProfit', '$totalRevenue'] }, 100] }, 2] }
        }
      }
    ]);

    const result = sales[0] || { totalRevenue: 0, totalCost: 0, totalProfit: 0, billCount: 0, profitMargin: 0 };
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get Monthly Profits (Bonus)
router.get('/monthly', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const sales = await Sale.aggregate([
      { $match: { date: { $gte: startOfMonth, $lte: endOfMonth } } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$discountedTotal' },
          totalCost: { $sum: '$totalCost' },
          totalProfit: { $sum: '$profit' },
          billCount: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          period: 'Current Month',
          totalRevenue: { $round: ['$totalRevenue', 2] },
          totalCost: { $round: ['$totalCost', 2] },
          totalProfit: { $round: ['$totalProfit', 2] },
          billCount: 1,
          profitMargin: { $round: [{ $multiply: [{ $divide: ['$totalProfit', '$totalRevenue'] }, 100] }, 2] }
        }
      }
    ]);

    const result = sales[0] || { totalRevenue: 0, totalCost: 0, totalProfit: 0, billCount: 0, profitMargin: 0 };
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
