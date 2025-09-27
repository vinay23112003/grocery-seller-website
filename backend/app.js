const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const productRoutes = require('./routes/products');
const billingRoutes = require('./routes/billing');
const profitRoutes = require('./routes/profits');
const authRoutes = require('./routes/auth');

const app = express();

// CORS Setup - Allows frontend to call API (replace 'yourusername' with your GitHub username later)
const corsOptions = {
  origin: [
    'http://localhost:3000',  // For local development
    'https://yourusername.github.io/grocery-seller-website',  // GitHub Pages URL (replace yourusername)
    'https://grocery-seller-website.vercel.app'  // If deploying to Vercel/Netlify
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Middleware for parsing JSON and forms
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (PDFs, images)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected successfully'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);  // Stop server if DB fails
  });

// API Routes
app.use('/api/products', productRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/profits', profitRoutes);
app.use('/api/auth', authRoutes);

// Health Check Endpoint (Test if server is running)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Backend server is running!', 
    timestamp: new Date().toISOString() 
  });
});

// For Production: Serve Frontend Static Files
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  });
}

module.exports = app;
