// server/controllers/insightController.js
// Handles user financial insights: unusual spending, recurring bills, and month-end pace forecast.

const Expense = require('../models/Expense');
const {
  detectUnusual,
  detectRecurring,
  forecastMonthEnd,
} = require('../utils/insights');

/**
 * @desc    Get analytical insights for the authenticated user
 * @route   GET /api/insights
 * @access  Private (JWT protected)
 */
const getInsights = async (req, res, next) => {
  try {
    // Multi-tenant isolation: only fetch expenses belonging to the logged-in user
    const expenses = await Expense.find({ user: req.user.id })
      .sort({ date: -1 })
      .lean();

    const unusual = detectUnusual(expenses);
    const recurring = detectRecurring(expenses);
    const forecast = forecastMonthEnd(expenses);

    res.status(200).json({
      success: true,
      message: 'Insights retrieved successfully',
      data: {
        unusual,
        recurring,
        forecast,
        totalExpensesAnalyzed: expenses.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getInsights,
};
