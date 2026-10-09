// server/routes/expenseRoutes.js
// Express router for all expense endpoints.

const express = require('express');
const router = express.Router();

const {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
} = require('../controllers/expenseController');

const { protect } = require('../middleware/authMiddleware');

// All expense routes require a valid authenticated user (JWT)
router.use(protect);

// Routes for '/'
router.route('/')
  .post(createExpense)
  .get(getExpenses);

// Aggregated summary route (must be declared before /:id)
router.get('/summary', getExpenseSummary);

// Routes for '/:id'
router.route('/:id')
  .get(getExpenseById)
  .put(updateExpense)
  .delete(deleteExpense);

module.exports = router;
