const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Middleware to verify JWT Token (for protected routes)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];  // Bearer TOKEN
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'fallback_super_secret_key_change_in_production', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;  // Attach decoded user to req
    next();
  });
};

// Register New User (Admin/Staff - One-time setup)
router.post('/register', async (req, res) => {
  try {
    const { username, password, businessName, gstNumber } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Check if user already exists
    const existingUser  = await User.findOne({ username });
    if (existingUser ) {
      return res.status(400).json({ error: 'Username already exists. Please choose another.' });
    }

    // Hash the password (secure storage)
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create new user
    const user = new User({
      username,
      password: hashedPassword,
      businessName: businessName || 'Grocery Store',
      gstNumber: gstNumber || '',
      role: 'admin'  // Default admin for first user
    });
    await user.save();

    res.status(201).json({ 
      success: true, 
      message: 'User  registered successfully! Now login with /auth/login.' 
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Login User
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Check password match
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Generate JWT Token (expires in 7 days)
    const token = jwt.sign(
      { 
        userId: user._id, 
        username: user.username, 
        role: user.role 
      },
      process.env.JWT_SECRET || 'fallback_super_secret_key_change_in_production',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,  // Send token to frontend (store in localStorage)
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        businessName: user.businessName,
        gstNumber: user.gstNumber
      },
      message: 'Login successful! Use this token for API calls.'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get User Profile (Protected Route - Needs Token)
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');  // Exclude password
    if (!user) {
      return res.status(404).json({ error: 'User  not found' });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        businessName: user.businessName,
        gstNumber: user.gstNumber
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout (Client-side: Remove token, but server can blacklist if needed)
router.post('/logout', authenticateToken, (req, res) => {
  res.json({ success: true, message: 'Logged out successfully. Token invalidated on client.' });
});

module.exports = router;
