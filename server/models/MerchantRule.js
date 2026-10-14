// server/models/MerchantRule.js
// Stores per-user corrections: when a user changes the category for a merchant,
// that choice is remembered and applied automatically to future SMS imports.

'use strict';

const mongoose = require('mongoose');

const merchantRuleSchema = new mongoose.Schema(
  {
    // The user who owns this rule (strict multi-tenancy isolation)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // The merchant/payee name exactly as extracted by smsParser
    // Stored in its original casing; lookups use case-insensitive regex
    merchant: {
      type: String,
      required: [true, 'Merchant name is required'],
      trim: true,
    },

    // The user-assigned category override for this merchant
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
  },
  {
    timestamps: true, // createdAt / updatedAt
  }
);

// Prevent duplicate rules for the same (user, merchant) pair.
// If the user changes their mind, the route uses findOneAndUpdate (upsert).
merchantRuleSchema.index({ user: 1, merchant: 1 }, { unique: true });

const MerchantRule = mongoose.model('MerchantRule', merchantRuleSchema);

module.exports = MerchantRule;
