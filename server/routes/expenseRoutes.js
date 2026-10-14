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
  parseSmsExpense,
  upsertMerchantRule,
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

// SMS parse-only route — returns extracted fields WITHOUT saving (must be before /:id)
router.post('/parse-sms', parseSmsExpense);

// Upsert user merchant→category rule (must be before /:id)
router.post('/merchant-rule', upsertMerchantRule);

// Routes for '/:id'
router.route('/:id')
  .get(getExpenseById)
  .put(updateExpense)
  .delete(deleteExpense);

module.exports = router;
