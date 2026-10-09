// server/utils/db.js
// Utility function to connect to the MongoDB database using Mongoose.

const mongoose = require('mongoose');

/**
 * Connects the Express application to MongoDB.
 * Reads the connection URI from the environment variable MONGO_URI.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[Database Error] Failed to connect to MongoDB: ${error.message}`);
    // If the database cannot connect, exit the process with failure code (1)
    process.exit(1);
  }
};

module.exports = connectDB;
