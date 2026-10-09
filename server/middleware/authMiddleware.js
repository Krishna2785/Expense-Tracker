// server/middleware/authMiddleware.js
// Middleware to protect private routes by verifying the JSON Web Token.

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect middleware:
 * Intercepts incoming requests to private endpoints.
 * 1. Checks if the Authorization header has a Bearer token.
 * 2. Verifies the token using JWT_SECRET.
 * 3. Retrieves the corresponding user from MongoDB (excluding password).
 * 4. Attaches the user object to req.user so downstream controllers have access to req.user.id.
 */
const protect = async (req, res, next) => {
  let token;

  // Check if Authorization header is present and starts with 'Bearer'
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      // Format is: "Bearer <token>" -> split by space and grab index 1
      token = req.headers.authorization.split(' ')[1];

      // Verify the token using our secret key
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Find the user by ID stored in the token payload; omit password field (-password)
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User no longer exists. Authorization denied.',
        });
      }

      // Proceed to the next middleware or controller
      next();
    } catch (error) {
      console.error('[Auth Middleware Error]:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Not authorized: Token is invalid or expired',
      });
    }
  }

  // If no token was found in the header
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized: No token provided in Authorization header',
    });
  }
};

module.exports = { protect };
