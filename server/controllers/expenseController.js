// server/controllers/expenseController.js
// Controller containing CRUD operations and filtering for user expenses.
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const MerchantRule = require('../models/MerchantRule');
const escapeRegex = require('../utils/escapeRegex');
const { parseSms } = require('../utils/smsParser');
const { resolveCategory } = require('../utils/categorizer');

/**
 * @desc    Create a new expense or income record
 * @route   POST /api/expenses
 * @access  Private (Requires valid JWT)
 */
const createExpense = async (req, res, next) => {
  try {
    const { title, amount, category, date, note, type, source } = req.body;

    // Validate required fields
    if (!title || typeof title !== 'string' || !title.trim() || amount === undefined || amount === null) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both a valid title and amount for the transaction',
      });
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Transaction amount must be a valid positive number greater than 0',
      });
    }

    if (type && type !== 'debit' && type !== 'credit') {
      return res.status(400).json({
        success: false,
        message: 'Transaction type must be either "debit" or "credit"',
      });
    }

    let parsedDate = new Date();
    if (date) {
      parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid transaction date',
        });
      }
    }

    // Create the expense document linked strictly to the logged-in user
    const expense = await Expense.create({
      user: req.user.id, // Enforce multi-tenancy isolation
      title: title.trim(),
      amount: numAmount,
      category: category && String(category).trim() ? String(category).trim() : 'General',
      date: parsedDate,
      note: note ? String(note).trim() : '',
      type: type || 'debit',
      source: source || 'manual',
    });

    // Auto-save a MerchantRule when the user confirms an SMS-imported expense.
    // The merchant name is passed as req.body.merchant (set by parseSmsExpense).
    // This ensures that the EXACT category the user chose is remembered.
    if (source === 'sms' && req.body.merchant) {
      const merchantName = String(req.body.merchant).trim();
      if (merchantName.length > 1) {
        // findOneAndUpdate with upsert so repeat saves update, not duplicate
        await MerchantRule.findOneAndUpdate(
          { user: req.user.id, merchant: { $regex: new RegExp(`^${merchantName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
          { user: req.user.id, merchant: merchantName, category: category || 'General' },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
      }
    }

    res.status(201).json({
      success: true,
      message: 'Expense created successfully',
      data: expense,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all expenses for logged-in user with filters and sorting
 * @route   GET /api/expenses
 * @access  Private
 * 
 * Query parameters supported:
 *  - category: Filter by category name
 *  - type: 'debit' or 'credit'
 *  - source: 'manual' or 'sms'
 *  - search: Search keyword in title or note
 *  - month: Month number (1 - 12)
 *  - year: Year number (e.g. 2026)
 *  - startDate & endDate: Date range filter (YYYY-MM-DD)
 *  - sortBy: 'date' or 'amount' (default: 'date')
 *  - order: 'asc' or 'desc' (default: 'desc')
 */
const getExpenses = async (req, res, next) => {
  try {
    const {
      category,
      type,
      source,
      search,
      month,
      year,
      startDate,
      endDate,
      sortBy = 'date',
      order = 'desc',
    } = req.query;

    // Rule: Every query MUST filter by the logged-in user's ID
    const filter = {
      user: req.user.id,
    };

    // 1. Filter by category (case-insensitive & regex-escaped to prevent ReDoS / crashes)
    if (category) {
      const safeCategory = escapeRegex(category.trim());
      filter.category = { $regex: new RegExp(`^${safeCategory}$`, 'i') };
    }

    // 2. Filter by transaction type ('debit' or 'credit')
    if (type) {
      filter.type = type.toLowerCase();
    }

    // 3. Filter by source ('manual' or 'sms')
    if (source) {
      filter.source = source.toLowerCase();
    }

    // 4. Search keyword across title or note (regex-escaped for safety)
    if (search) {
      const safeSearch = escapeRegex(search.trim());
      filter.$or = [
        { title: { $regex: safeSearch, $options: 'i' } },
        { note: { $regex: safeSearch, $options: 'i' } },
      ];
    }

    // 5. Date filtering logic
    // Option A: Specific month and/or year (defaults year to current year if only month provided)
    if (month || year) {
      const currentYear = new Date().getUTCFullYear();
      const parsedYear = year ? parseInt(year, 10) : currentYear;

      if (month) {
        const parsedMonth = parseInt(month, 10);
        if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
          return res.status(400).json({
            success: false,
            message: 'Month must be an integer between 1 and 12',
          });
        }
        const startOfMonth = new Date(Date.UTC(parsedYear, parsedMonth - 1, 1, 0, 0, 0, 0));
        const endOfMonth = new Date(Date.UTC(parsedYear, parsedMonth, 0, 23, 59, 59, 999));
        filter.date = { $gte: startOfMonth, $lte: endOfMonth };
      } else {
        const startOfYear = new Date(Date.UTC(parsedYear, 0, 1, 0, 0, 0, 0));
        const endOfYear = new Date(Date.UTC(parsedYear, 11, 31, 23, 59, 59, 999));
        filter.date = { $gte: startOfYear, $lte: endOfYear };
      }
    }
    // Option C: Custom date range (startDate and/or endDate)
    else if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // Include full end day
        filter.date.$lte = end;
      }
    }

    // 6. Sorting configuration
    const sortField = sortBy === 'amount' ? 'amount' : 'date';
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortOptions = {
      [sortField]: sortOrder,
      _id: -1, // Secondary tie-breaker for deterministic ordering
    };

    // Execute query
    const expenses = await Expense.find(filter).sort(sortOptions);

    // Calculate helpful metadata summary for the caller
    let totalDebit = 0;
    let totalCredit = 0;

    expenses.forEach((item) => {
      if (item.type === 'credit') {
        totalCredit += item.amount;
      } else {
        totalDebit += item.amount;
      }
    });

    res.status(200).json({
      success: true,
      count: expenses.length,
      summary: {
        totalDebit: Number(totalDebit.toFixed(2)),
        totalCredit: Number(totalCredit.toFixed(2)),
        balance: Number((totalCredit - totalDebit).toFixed(2)),
      },
      data: expenses,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get a single expense by ID
 * @route   GET /api/expenses/:id
 * @access  Private
 */
const getExpenseById = async (req, res, next) => {
  try {
    // Strictly filter by both expense _id AND user id
    const expense = await Expense.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found or you are not authorized to view it',
      });
    }

    res.status(200).json({
      success: true,
      data: expense,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update an existing expense
 * @route   PUT /api/expenses/:id
 * @access  Private
 */
const updateExpense = async (req, res, next) => {
  try {
    // Ensure the expense exists and belongs to the logged-in user
    const expense = await Expense.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found or you are not authorized to edit it',
      });
    }

    const { title, amount, category, date, note, type, source } = req.body;

    if (title !== undefined) {
      if (typeof title !== 'string' || !title.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Transaction title cannot be empty',
        });
      }
      expense.title = title.trim();
    }

    if (amount !== undefined) {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Transaction amount must be a valid positive number greater than 0',
        });
      }
      expense.amount = numAmount;
    }

    if (type !== undefined) {
      if (type !== 'debit' && type !== 'credit') {
        return res.status(400).json({
          success: false,
          message: 'Transaction type must be either "debit" or "credit"',
        });
      }
      expense.type = type;
    }

    if (date !== undefined) {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid transaction date',
        });
      }
      expense.date = parsedDate;
    }

    // Update optional fields
    if (category !== undefined) expense.category = String(category).trim() || 'General';
    if (note !== undefined) expense.note = String(note).trim();
    if (source !== undefined) expense.source = source;

    const updatedExpense = await expense.save();

    res.status(200).json({
      success: true,
      message: 'Expense updated successfully',
      data: updatedExpense,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete an expense
 * @route   DELETE /api/expenses/:id
 * @access  Private
 */
const deleteExpense = async (req, res, next) => {
  try {
    // Ensure the expense exists and belongs strictly to the logged-in user
    const expense = await Expense.findOne({
      _id: req.params.id,
      user: req.user.id,
    });

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Expense not found or you are not authorized to delete it',
      });
    }

    await expense.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Expense deleted successfully',
      deletedId: req.params.id,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get expense summary (total per category and total per month) using MongoDB aggregation
 * @route   GET /api/expenses/summary
 * @access  Private
 * 
 * Supports query params:
 *  - month: Month number (1 - 12)
 *  - year: Year number (e.g. 2026)
 */
const getExpenseSummary = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const userObjectId = new mongoose.Types.ObjectId(req.user.id);

    // 1. Build match filter for category breakdown (filtering by user and debit)
    const categoryMatch = {
      user: userObjectId,
      type: 'debit',
    };

    if (month || year) {
      const currentYear = new Date().getUTCFullYear();
      const parsedYear = year ? parseInt(year, 10) : currentYear;

      if (month) {
        const parsedMonth = parseInt(month, 10);
        if (isNaN(parsedMonth) || parsedMonth < 1 || parsedMonth > 12) {
          return res.status(400).json({
            success: false,
            message: 'Month must be an integer between 1 and 12',
          });
        }
        const startOfMonth = new Date(Date.UTC(parsedYear, parsedMonth - 1, 1, 0, 0, 0, 0));
        const endOfMonth = new Date(Date.UTC(parsedYear, parsedMonth, 0, 23, 59, 59, 999));
        categoryMatch.date = { $gte: startOfMonth, $lte: endOfMonth };
      } else {
        const startOfYear = new Date(Date.UTC(parsedYear, 0, 1, 0, 0, 0, 0));
        const endOfYear = new Date(Date.UTC(parsedYear, 11, 31, 23, 59, 59, 999));
        categoryMatch.date = { $gte: startOfYear, $lte: endOfYear };
      }
    }

    // 2. MongoDB Aggregation: Total spent per category
    const categoryBreakdown = await Expense.aggregate([
      { $match: categoryMatch },
      {
        $group: {
          _id: '$category',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
      {
        $project: {
          _id: 0,
          category: '$_id',
          totalAmount: { $round: ['$totalAmount', 2] },
          count: 1,
        },
      },
    ]);

    // Calculate total across all categories to determine spending percentage
    const totalSpent = categoryBreakdown.reduce((acc, curr) => acc + curr.totalAmount, 0);

    const categoryBreakdownWithPercent = categoryBreakdown.map((item) => ({
      ...item,
      percentage: totalSpent > 0 ? Number(((item.totalAmount / totalSpent) * 100).toFixed(1)) : 0,
    }));

    // 3. Build match filter for monthly breakdown
    const monthlyMatch = {
      user: userObjectId,
      type: 'debit',
    };

    if (year) {
      const parsedYear = parseInt(year, 10);
      monthlyMatch.date = {
        $gte: new Date(Date.UTC(parsedYear, 0, 1, 0, 0, 0, 0)),
        $lte: new Date(Date.UTC(parsedYear, 11, 31, 23, 59, 59, 999)),
      };
    }

    // 4. MongoDB Aggregation: Total spent grouped by Year and Month
    const monthlyBreakdown = await Expense.aggregate([
      { $match: monthlyMatch },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
          },
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1,
        },
      },
      {
        $project: {
          _id: 0,
          year: '$_id.year',
          month: '$_id.month',
          totalAmount: { $round: ['$totalAmount', 2] },
          count: 1,
        },
      },
    ]);

    res.status(200).json({
      success: true,
      filter: {
        month: month ? parseInt(month, 10) : null,
        year: year ? parseInt(year, 10) : null,
      },
      totalSpent: Number(totalSpent.toFixed(2)),
      categoryBreakdown: categoryBreakdownWithPercent,
      monthlyBreakdown,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Parse a raw SMS string and return extracted fields WITHOUT saving
 * @route   POST /api/expenses/parse-sms
 * @access  Private
 *
 * Body: { text: "<raw SMS string>" }
 * Returns extracted { amount, merchant, date, type } or a 422 if parsing fails.
 */
const parseSmsExpense = async (req, res, next) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a non-empty SMS text string in the "text" field.',
      });
    }

    const parsed = parseSms(text.trim());

    if (!parsed) {
      return res.status(422).json({
        success: false,
        message:
          'Could not extract transaction details from this SMS. ' +
          'The message may be an OTP, promotional, or unsupported bank format.',
      });
    }

    // Resolve category: user rule → keyword map → 'General'
    const category = await resolveCategory(parsed.merchant, req.user.id, MerchantRule);

    // Format date to YYYY-MM-DD for the frontend date input
    const dateStr = parsed.date
      ? parsed.date.toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    res.status(200).json({
      success: true,
      message: 'SMS parsed successfully. Review and confirm before saving.',
      // categorySource tells the UI where the suggestion came from
      categorySource: category === 'General' ? 'fallback' : 'rule',
      data: {
        title: parsed.merchant,
        amount: parsed.amount,
        merchant: parsed.merchant, // kept so createExpense can upsert a rule
        date: dateStr,
        type: parsed.type,
        category,
        source: 'sms',
        note: '',
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Explicitly upsert a MerchantRule (user corrects a category)
 * @route   POST /api/expenses/merchant-rule
 * @access  Private
 *
 * Body: { merchant: string, category: string }
 * Idempotent — calling multiple times with the same merchant updates the rule.
 */
const upsertMerchantRule = async (req, res, next) => {
  try {
    const { merchant, category } = req.body;

    if (!merchant || typeof merchant !== 'string' || merchant.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Merchant name is required.' });
    }
    if (!category || typeof category !== 'string' || category.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Category is required.' });
    }

    const merchantName = merchant.trim();
    const safePattern = merchantName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const rule = await MerchantRule.findOneAndUpdate(
      { user: req.user.id, merchant: { $regex: new RegExp(`^${safePattern}$`, 'i') } },
      { user: req.user.id, merchant: merchantName, category: category.trim() },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({
      success: true,
      message: `Merchant rule saved: "${merchantName}" → "${category.trim()}"`,
      data: rule,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createExpense,
  getExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
  getExpenseSummary,
  parseSmsExpense,
  upsertMerchantRule,
};
