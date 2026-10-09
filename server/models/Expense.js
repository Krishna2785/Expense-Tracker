// server/models/Expense.js
// Mongoose schema and model for user expenses and income entries.

const mongoose = require('mongoose');

// Define the Expense schema
const expenseSchema = new mongoose.Schema(
  {
    // Reference to the User who owns this expense (Multi-tenancy isolation)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true, // Speeds up queries filtering by user
    },
    title: {
      type: String,
      required: [true, 'Please provide an expense title'],
      trim: true,
      maxlength: [100, 'Title cannot exceed 100 characters'],
    },
    amount: {
      type: Number,
      required: [true, 'Please provide an expense amount'],
      min: [0.01, 'Amount must be greater than zero'],
    },
    category: {
      type: String,
      required: [true, 'Please provide a category'],
      trim: true,
      default: 'General',
    },
    date: {
      type: Date,
      required: [true, 'Please provide a transaction date'],
      default: Date.now,
    },
    note: {
      type: String,
      trim: true,
      default: '',
      maxlength: [250, 'Note cannot exceed 250 characters'],
    },
    // Transaction type: 'debit' for expense (money out), 'credit' for income (money in)
    type: {
      type: String,
      enum: {
        values: ['debit', 'credit'],
        message: '{VALUE} is not supported. Use "debit" or "credit"',
      },
      default: 'debit',
    },
    // Transaction source: 'manual' (entered by user) or 'sms' (parsed from SMS alerts)
    source: {
      type: String,
      enum: {
        values: ['manual', 'sms'],
        message: '{VALUE} is not supported. Use "manual" or "sms"',
      },
      default: 'manual',
    },
  },
  {
    timestamps: true, // Generates createdAt and updatedAt fields
  }
);

// Compound index to optimize the most frequent query: fetching a user's expenses by date
expenseSchema.index({ user: 1, date: -1 });

const Expense = mongoose.model('Expense', expenseSchema);

module.exports = Expense;
