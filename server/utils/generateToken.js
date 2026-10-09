// server/utils/generateToken.js
// Utility function to create a signed JSON Web Token (JWT).

const jwt = require('jsonwebtoken');

/**
 * Generates a signed JWT containing the user's ID as the payload.
 * 
 * @param {string} userId - The MongoDB _id of the user.
 * @returns {string} - The encoded JWT string.
 */
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId }, // Payload: stores user ID inside the token
    process.env.JWT_SECRET, // Secret key used to sign the token
    {
      expiresIn: '7d', // Token expires in 7 days
    }
  );
};

module.exports = generateToken;
