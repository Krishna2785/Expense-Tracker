// server/tests/insights.test.js
// Unit tests for insights pure financial analysis functions:
// 1. detectUnusual
// 2. detectRecurring
// 3. forecastMonthEnd

const {
  detectUnusual,
  detectRecurring,
  forecastMonthEnd,
} = require('../utils/insights');

describe('Financial Insights Utility - server/utils/insights.js', () => {
  // ─── 1. detectUnusual ───────────────────────────────────────────────────────
  describe('detectUnusual(expenses)', () => {
    test('flags expenses that are over 2x their category average', () => {
      const expenses = [
        { _id: '1', title: 'Lunch', amount: 100, category: 'Food', type: 'debit' },
        { _id: '2', title: 'Snacks', amount: 100, category: 'Food', type: 'debit' },
        { _id: '3', title: 'Dinner', amount: 100, category: 'Food', type: 'debit' },
        // Category average before/with spike: (100 + 100 + 100 + 1000) / 4 = 325. Threshold = 650.
        { _id: '4', title: 'Fancy Dinner Party', amount: 1000, category: 'Food', type: 'debit' },
      ];

      const result = detectUnusual(expenses);

      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe('4');
      expect(result[0].title).toBe('Fancy Dinner Party');
      expect(result[0].amount).toBe(1000);
      expect(result[0].categoryAverage).toBe(325);
      expect(result[0].threshold).toBe(650);
      expect(result[0].multiplier).toBe(3.08); // 1000 / 325
    });

    test('handles multiple categories independently', () => {
      const expenses = [
        // Food: avg = (200 + 200 + 200 + 1500) / 4 = 525. 2x = 1050.
        { _id: 'f1', title: 'Food 1', amount: 200, category: 'Food' },
        { _id: 'f2', title: 'Food 2', amount: 200, category: 'Food' },
        { _id: 'f3', title: 'Food 3', amount: 200, category: 'Food' },
        { _id: 'f4', title: 'Food Banquet', amount: 1500, category: 'Food' },

        // Travel: avg = (50 + 50 + 60) / 3 = 53.33. No outlier.
        { _id: 't1', title: 'Metro', amount: 50, category: 'Travel' },
        { _id: 't2', title: 'Bus', amount: 50, category: 'Travel' },
        { _id: 't3', title: 'Auto', amount: 60, category: 'Travel' },

        // Shopping: avg = (500 + 500 + 4000) / 3 = 1666.67. 2x = 3333.33. 4000 is outlier.
        { _id: 's1', title: 'Shirt', amount: 500, category: 'Shopping' },
        { _id: 's2', title: 'Pants', amount: 500, category: 'Shopping' },
        { _id: 's3', title: 'Designer Suit', amount: 4000, category: 'Shopping' },
      ];

      const result = detectUnusual(expenses);

      expect(result).toHaveLength(2);
      const flaggedIds = result.map((r) => r._id);
      expect(flaggedIds).toContain('f4');
      expect(flaggedIds).toContain('s3');
    });

    test('returns empty array when all expenses are within normal range', () => {
      const expenses = [
        { title: 'Item 1', amount: 100, category: 'Food' },
        { title: 'Item 2', amount: 110, category: 'Food' },
        { title: 'Item 3', amount: 90, category: 'Food' },
        { title: 'Item 4', amount: 105, category: 'Food' },
      ];

      expect(detectUnusual(expenses)).toEqual([]);
    });

    test('does not flag single expense in a category (cannot exceed 2x its own average)', () => {
      const expenses = [
        { title: 'Only Expense', amount: 5000, category: 'Electronics' },
      ];

      // Average = 5000, 2x = 10000. 5000 > 10000 is false.
      expect(detectUnusual(expenses)).toEqual([]);
    });

    test('ignores credits / income entries and non-positive amounts', () => {
      const expenses = [
        { title: 'Salary', amount: 80000, category: 'Income', type: 'credit' },
        { title: 'Refund', amount: 2000, category: 'Food', type: 'credit' },
        { title: 'Coffee', amount: 50, category: 'Food', type: 'debit' },
        { title: 'Burger', amount: 60, category: 'Food', type: 'debit' },
      ];

      expect(detectUnusual(expenses)).toEqual([]);
    });

    test('returns empty array for empty or invalid inputs', () => {
      expect(detectUnusual([])).toEqual([]);
      expect(detectUnusual(null)).toEqual([]);
      expect(detectUnusual(undefined)).toEqual([]);
      expect(detectUnusual('invalid')).toEqual([]);
    });
  });

  // ─── 2. detectRecurring ─────────────────────────────────────────────────────
  describe('detectRecurring(expenses)', () => {
    test('detects monthly repeating subscriptions with identical amount across months', () => {
      const expenses = [
        {
          _id: 'sub1',
          merchant: 'Netflix',
          title: 'Netflix Premium',
          amount: 649,
          category: 'Entertainment',
          date: '2024-08-15',
        },
        {
          _id: 'sub2',
          merchant: 'Netflix',
          title: 'Netflix Premium',
          amount: 649,
          category: 'Entertainment',
          date: '2024-09-15',
        },
        {
          _id: 'sub3',
          merchant: 'Netflix',
          title: 'Netflix Premium',
          amount: 649,
          category: 'Entertainment',
          date: '2024-10-15',
        },
      ];

      const result = detectRecurring(expenses);

      expect(result).toHaveLength(1);
      expect(result[0].merchant).toBe('Netflix');
      expect(result[0].category).toBe('Entertainment');
      expect(result[0].averageAmount).toBe(649);
      expect(result[0].frequency).toBe('monthly');
      expect(result[0].distinctMonthsCount).toBe(3);
      expect(result[0].months).toEqual(['2024-08', '2024-09', '2024-10']);
      expect(result[0].expenses).toHaveLength(3);
    });

    test('detects recurring expenses with minor amount variations (e.g. utility bills)', () => {
      const expenses = [
        {
          merchant: 'Tata Power',
          amount: 1200,
          category: 'Bills & Utilities',
          date: '2024-07-05',
        },
        {
          merchant: 'Tata Power',
          amount: 1250, // within 15% tolerance
          category: 'Bills & Utilities',
          date: '2024-08-05',
        },
      ];

      const result = detectRecurring(expenses);

      expect(result).toHaveLength(1);
      expect(result[0].merchant).toBe('Tata Power');
      expect(result[0].averageAmount).toBe(1225);
      expect(result[0].distinctMonthsCount).toBe(2);
    });

    test('falls back to title when merchant field is omitted', () => {
      const expenses = [
        { title: 'Spotify Subscription', amount: 119, date: '2024-09-01' },
        { title: 'Spotify Subscription', amount: 119, date: '2024-10-01' },
      ];

      const result = detectRecurring(expenses);

      expect(result).toHaveLength(1);
      expect(result[0].merchant).toBe('Spotify Subscription');
      expect(result[0].averageAmount).toBe(119);
    });

    test('does NOT flag multiple orders in the same calendar month as recurring monthly', () => {
      const expenses = [
        { merchant: 'Swiggy', amount: 350, date: '2024-10-02' },
        { merchant: 'Swiggy', amount: 350, date: '2024-10-08' },
        { merchant: 'Swiggy', amount: 350, date: '2024-10-15' },
      ];

      // All 3 happened in October 2024 (1 distinct month). Not a monthly recurrence.
      expect(detectRecurring(expenses)).toEqual([]);
    });

    test('does NOT flag same merchant when amounts differ substantially (e.g. random shopping)', () => {
      const expenses = [
        { merchant: 'Amazon', amount: 299, date: '2024-08-10' },
        { merchant: 'Amazon', amount: 45000, date: '2024-09-10' }, // 45k laptop vs 299 cable
      ];

      expect(detectRecurring(expenses)).toEqual([]);
    });

    test('handles empty or malformed inputs without crashing', () => {
      expect(detectRecurring([])).toEqual([]);
      expect(detectRecurring(null)).toEqual([]);
      expect(detectRecurring(undefined)).toEqual([]);
      expect(detectRecurring([{}, { amount: -50 }])).toEqual([]);
    });
  });

  // ─── 3. forecastMonthEnd ────────────────────────────────────────────────────
  describe('forecastMonthEnd(expenses, referenceDate)', () => {
    test('projects month-end spending correctly at mid-month in a 30-day month (e.g. June 15)', () => {
      const referenceDate = new Date(2024, 5, 15); // June 15, 2024 (June has 30 days)

      const expenses = [
        { amount: 5000, date: '2024-06-03', type: 'debit' },
        { amount: 4000, date: '2024-06-08', type: 'debit' },
        { amount: 6000, date: '2024-06-14', type: 'debit' },
      ];
      // Total spent = 15,000 on Day 15
      // Daily pace = 15,000 / 15 = 1,000 / day
      // 30 days in June => projectedTotal = 1,000 * 30 = 30,000
      // Projected remaining = 30,000 - 15,000 = 15,000

      const result = forecastMonthEnd(expenses, referenceDate);

      expect(result.year).toBe(2024);
      expect(result.month).toBe(6); // June (1-indexed)
      expect(result.daysInMonth).toBe(30);
      expect(result.currentDay).toBe(15);
      expect(result.daysRemaining).toBe(15);
      expect(result.spentSoFar).toBe(15000);
      expect(result.dailyPace).toBe(1000);
      expect(result.projectedTotal).toBe(30000);
      expect(result.projectedRemaining).toBe(15000);
    });

    test('projects accurately in a 31-day month (e.g. October 10)', () => {
      const referenceDate = new Date(2024, 9, 10); // October 10, 2024 (31 days)

      const expenses = [
        { amount: 3100, date: '2024-10-05', type: 'debit' },
      ];
      // Day 10. Total spent = 3100.
      // Pace = 310 / day.
      // Projected total = 310 * 31 = 9610.
      // Projected remaining = 9610 - 3100 = 6510.

      const result = forecastMonthEnd(expenses, referenceDate);

      expect(result.daysInMonth).toBe(31);
      expect(result.currentDay).toBe(10);
      expect(result.daysRemaining).toBe(21);
      expect(result.spentSoFar).toBe(3100);
      expect(result.dailyPace).toBe(310);
      expect(result.projectedTotal).toBe(9610);
      expect(result.projectedRemaining).toBe(6510);
    });

    test('accurately handles the last day of the month (daysRemaining = 0)', () => {
      const referenceDate = new Date(2024, 1, 29); // Feb 29, 2024 (Leap year, 29 days)

      const expenses = [
        { amount: 14500, date: '2024-02-20', type: 'debit' },
      ];

      const result = forecastMonthEnd(expenses, referenceDate);

      expect(result.daysInMonth).toBe(29);
      expect(result.currentDay).toBe(29);
      expect(result.daysRemaining).toBe(0);
      expect(result.spentSoFar).toBe(14500);
      expect(result.projectedTotal).toBe(14500);
      expect(result.projectedRemaining).toBe(0);
    });

    test('only includes expenses from the target month/year and excludes credits/income', () => {
      const referenceDate = new Date(2024, 9, 15); // October 15, 2024

      const expenses = [
        // Included: October debits
        { amount: 1000, date: '2024-10-02', type: 'debit' },
        { amount: 500, date: '2024-10-10', type: 'debit' },

        // Excluded: October credit / income
        { amount: 50000, date: '2024-10-01', type: 'credit' },

        // Excluded: September expense
        { amount: 12000, date: '2024-09-25', type: 'debit' },

        // Excluded: November expense
        { amount: 4000, date: '2024-11-01', type: 'debit' },
      ];

      const result = forecastMonthEnd(expenses, referenceDate);

      // Only 1000 + 500 = 1500 should be counted
      expect(result.spentSoFar).toBe(1500);
      expect(result.dailyPace).toBe(100); // 1500 / 15
      expect(result.projectedTotal).toBe(3100); // 100 * 31
    });

    test('handles zero spending or empty expenses gracefully', () => {
      const referenceDate = new Date(2024, 9, 15);
      const result = forecastMonthEnd([], referenceDate);

      expect(result.spentSoFar).toBe(0);
      expect(result.dailyPace).toBe(0);
      expect(result.projectedTotal).toBe(0);
      expect(result.projectedRemaining).toBe(0);
    });

    test('defaults to current date when referenceDate is omitted', () => {
      const result = forecastMonthEnd([]);

      expect(result).toHaveProperty('year');
      expect(result).toHaveProperty('month');
      expect(result).toHaveProperty('daysInMonth');
      expect(result).toHaveProperty('currentDay');
      expect(result).toHaveProperty('projectedTotal');
    });
  });
});
