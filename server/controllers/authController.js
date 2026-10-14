// server/controllers/authController.js
// Controller functions for user registration, login, and profile retrieval.

const User = require('../models/User');
const generateToken = require('../utils/generateToken');

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const registerUser = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // 1. Validate that all required fields are provided
    if (!name || typeof name !== 'string' || !name.trim() || !email || typeof email !== 'string' || !email.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, email, and password',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address (e.g. name@example.com)',
      });
    }

    // 2. Validate password length
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    // 3. Check if a user with this email already exists
    const userExists = await User.findOne({ email: trimmedEmail });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email address is already registered',
      });
    }

    // 4. Create new user in MongoDB (the pre-save hook in User model will hash the password)
    const user = await User.create({
      name: name.trim(),
      email: trimmedEmail,
      password,
    });

    // 5. Send back success response with user info and signed JWT
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      token: generateToken(user._id),
    });
  } catch (error) {
    // Forward any unexpected errors to central error handler
    next(error);
  }
};

/**
 * @desc    Authenticate user & get token (Login)
 * @route   POST /api/auth/login
 * @access  Public
 */
const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // 1. Validate that both email and password are provided
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password',
      });
    }

    // 2. Find user by email in the database
    const user = await User.findOne({ email });

    // 3. Check if user exists AND if the provided password matches the hashed password
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // 4. Send back success response with user info and signed JWT
    res.status(200).json({
      success: true,
      message: 'Login successful',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
      token: generateToken(user._id),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get currently logged-in user profile
 * @route   GET /api/auth/profile
 * @access  Private (Protected by JWT)
 */
const getUserProfile = async (req, res, next) => {
  try {
    // req.user is attached by the 'protect' middleware
    res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
};
