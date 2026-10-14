// server/controllers/budgetController.js
// Controller handling CRUD operations for user monthly budgets and comparison against actual spending.

const mongoose = require('mongoose');
const Budget = require('../models/Budget');
const Expense = require('../models/Expense');
const escapeRegex = require('../utils/escapeRegex');

/**
 * @desc    Create a new category budget
 * @route   POST /api/budgets
 * @access  Private
 */
const createBudget = async (req, res, next) => {
  try {
    const { category, monthlyLimit } = req.body;

    // Validate inputs
    if (!category || typeof category !== 'string' || !category.trim() || monthlyLimit === undefined || monthlyLimit === null) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both a valid category and monthlyLimit',
      });
    }

    const numLimit = Number(monthlyLimit);
    if (isNaN(numLimit) || numLimit <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Monthly limit must be a valid positive number greater than 0',
      });
    }

    // Check if the user already configured a budget for this category (regex-escaped)
    const safeCategory = escapeRegex(category.trim());
    const existingBudget = await Budget.findOne({
      user: req.user.id,
      category: { $regex: new RegExp(`^${safeCategory}$`, 'i') },
    });

    if (existingBudget) {
      return res.status(400).json({
        success: false,
        message: `A budget for category '${category}' already exists. Please update it instead.`,
      });
    }

    const budget = await Budget.create({
      user: req.user.id,
      category: category.trim(),
      monthlyLimit: Number(monthlyLimit),
    });

    res.status(201).json({
      success: true,
      message: 'Budget created successfully',
      data: budget,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all budgets for the logged-in user with spending progress
 * @route   GET /api/budgets
 * @access  Private
 * 
 * Supports query params:
 *  - month: Month number (1 - 12, defaults to current month)
 *  - year: Year number (defaults to current year)
 */
const getBudgets = async (req, res, next) => {
  try {
    const currentDate = new Date();
    const queryMonth = req.query.month ? parseInt(req.query.month, 10) : currentDate.getUTCMonth() + 1;
    const queryYear = req.query.year ? parseInt(req.query.year, 10) : currentDate.getUTCFullYear();

    // 1. Fetch all budgets belonging to the logged-in user
    const budgets = await Budget.find({ user: req.user.id }).sort({ category: 1 });

    // 2. Compute date boundaries for the selected month to calculate actual spending
    const startOfMonth = new Date(Date.UTC(queryYear, queryMonth - 1, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(queryYear, queryMonth, 0, 23, 59, 59, 999));

    // 3. Aggregate user expenses for that month by category (strictly casting ObjectId)
    const monthlySpending = await Expense.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(req.user.id),
          type: 'debit',
          date: { $gte: startOfMonth, $lte: endOfMonth },
        },
      },
      {
        $group: {
          _id: { $toLower: '$category' },
          totalSpent: { $sum: '$amount' },
        },
      },
    ]);

    // Create a fast lookup map: categoryNameInLowerCase -> totalSpent
    const spendingMap = {};
    monthlySpending.forEach((item) => {
      spendingMap[item._id] = item.totalSpent;
    });

    // 4. Combine each budget with its actual spending status
    const budgetsWithProgress = budgets.map((budget) => {
      const spent = spendingMap[budget.category.toLowerCase()] || 0;
      const remaining = Number((budget.monthlyLimit - spent).toFixed(2));
      const percentageUsed =
        budget.monthlyLimit > 0
          ? Number(((spent / budget.monthlyLimit) * 100).toFixed(1))
          : 0;

      return {
        _id: budget._id,
        category: budget.category,
        monthlyLimit: budget.monthlyLimit,
        currentSpent: Number(spent.toFixed(2)),
        remaining,
        percentageUsed,
        isOverBudget: spent > budget.monthlyLimit,
        isNearLimit: percentageUsed >= 80 && spent <= budget.monthlyLimit,
        createdAt: budget.createdAt,
        updatedAt: budget.updatedAt,
      };
    });

    res.status(200).json({
      success: true,
      month: queryMonth,
      year: queryYear,
      count: budgetsWithProgress.length,
      data: budgetsWithProgress,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a single budget by ID
 * @route   GET /api/budgets/:id
 * @access  Private
 */
const getBudgetById = async (req, res, next) => {
  try {
    const budget = await Budget.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found or unauthorized',
      });
    }

    res.status(200).json({
      success: true,
      data: budget,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update a category budget
 * @route   PUT /api/budgets/:id
 * @access  Private
 */
const updateBudget = async (req, res, next) => {
  try {
    const budget = await Budget.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found or unauthorized',
      });
    }

    const { category, monthlyLimit } = req.body;

    if (monthlyLimit !== undefined) {
      const numLimit = Number(monthlyLimit);
      if (isNaN(numLimit) || numLimit <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Monthly limit must be a valid positive number greater than 0',
        });
      }
      budget.monthlyLimit = numLimit;
    }

    if (category !== undefined) {
      if (typeof category !== 'string' || !category.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Category cannot be empty',
        });
      }
      const safeCategory = escapeRegex(category.trim());
      // Check if updating to a category name that already exists in another budget
      const duplicateCheck = await Budget.findOne({
        user: req.user.id,
        category: { $regex: new RegExp(`^${safeCategory}$`, 'i') },
        _id: { $ne: budget._id },
      });

      if (duplicateCheck) {
        return res.status(400).json({
          success: false,
          message: `Another budget already exists for category '${category}'`,
        });
      }

      budget.category = category.trim();
    }

    const updatedBudget = await budget.save();

    res.status(200).json({
      success: true,
      message: 'Budget updated successfully',
      data: updatedBudget,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a category budget
 * @route   DELETE /api/budgets/:id
 * @access  Private
 */
const deleteBudget = async (req, res, next) => {
  try {
    const budget = await Budget.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: 'Budget not found or unauthorized',
      });
    }

    await budget.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Budget deleted successfully',
      deletedId: req.params.id,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createBudget,
  getBudgets,
  getBudgetById,
  updateBudget,
  deleteBudget,
};
