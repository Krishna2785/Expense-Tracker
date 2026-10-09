// server/routes/authRoutes.js
// Express router for user authentication and authorization endpoints.

const express = require('express');
const router = express.Router();

const {
  registerUser,
  loginUser,
  getUserProfile,
} = require('../controllers/authController');

const { protect } = require('../middleware/authMiddleware');

// Public routes: Anyone can register or log in
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected routes: Only users with a valid JWT can access
router.get('/profile', protect, getUserProfile);

module.exports = router;
