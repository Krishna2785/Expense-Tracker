// server/server.js
// Main entry point for the Smart Expense Tracker Backend.

// 1. Load environment variables from .env file at the very start
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./utils/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// 2. Initialize the Express application
const app = express();

// 3. Connect to the MongoDB database
connectDB();

// 4. Global Middleware
// Enables Cross-Origin Resource Sharing so our React frontend can communicate with this API
app.use(cors());

// Parses incoming requests with JSON payloads (replaces bodyParser)
app.use(express.json());

// 5. Mount API Routes
const authRoutes = require('./routes/authRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const budgetRoutes = require('./routes/budgetRoutes');

// Base Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'OK',
    message: 'Smart Expense Tracker API is running smoothly',
    timestamp: new Date().toISOString(),
  });
});

// Authentication routes (register, login, profile)
app.use('/api/auth', authRoutes);

// Expense routes (CRUD, filtering, sorting, summary)
app.use('/api/expenses', expenseRoutes);

// Budget routes (CRUD, monthly budget limits)
app.use('/api/budgets', budgetRoutes);

// 6. Centralized Error Handling Middlewares
// Catch 404 routes that don't match any registered endpoints
app.use(notFound);

// Custom central error handler to format errors as JSON
app.use(errorHandler);

// 7. Start the Express server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`[Server] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`[Server] Health check available at: http://localhost:${PORT}/api/health`);
});
