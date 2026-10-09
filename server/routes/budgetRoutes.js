// server/routes/budgetRoutes.js
// Express router for all budget management endpoints.

const express = require('express');
const router = express.Router();

const {
  createBudget,
  getBudgets,
  getBudgetById,
  updateBudget,
  deleteBudget,
} = require('../controllers/budgetController');

const { protect } = require('../middleware/authMiddleware');

// Protect all budget routes with JWT authentication
router.use(protect);

// Collection routes
router.route('/')
  .post(createBudget)
  .get(getBudgets);

// Individual item routes
router.route('/:id')
  .get(getBudgetById)
  .put(updateBudget)
  .delete(deleteBudget);

module.exports = router;
