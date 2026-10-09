// server/models/Budget.js
// Mongoose schema and model for user category budgets.

const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema(
  {
    // The user who owns this budget limit
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // The expense category this budget applies to (e.g. 'Food', 'Entertainment', 'Groceries')
    category: {
      type: String,
      required: [true, 'Please provide a category for this budget'],
      trim: true,
    },
    // The maximum monthly spending limit for this category
    monthlyLimit: {
      type: Number,
      required: [true, 'Please provide a monthly limit amount'],
      min: [0, 'Monthly limit cannot be negative'],
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate budgets for the same category by the same user
// (A user can only have one budget target per category)
budgetSchema.index({ user: 1, category: 1 }, { unique: true });

const Budget = mongoose.model('Budget', budgetSchema);

module.exports = Budget;
