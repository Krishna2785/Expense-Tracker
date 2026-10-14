// server/utils/insights.js
// Pure analytical functions for financial insights and pattern detection.
// No external AI APIs or database queries — deterministic, testable logic.

'use strict';

/**
 * 1. detectUnusual(expenses)
 *
 * Flags expenses that exceed 2x their category average.
 *
 * Algorithm:
 *  - Filters to valid positive debit expenses.
 *  - Calculates the arithmetic mean (average) for each category.
 *  - Compares each individual expense in that category to 2 * categoryAverage.
 *  - Any expense where amount > 2 * categoryAverage is flagged.
 *
 * @param {Array<object>} expenses - List of expense objects
 * @returns {Array<object>} Flagged unusual expense objects with calculation details
 */
const detectUnusual = (expenses) => {
  if (!Array.isArray(expenses) || expenses.length === 0) {
    return [];
  }

  // Filter valid positive debit transactions
  const validExpenses = expenses.filter(
    (e) => e && typeof e === 'object' && Number(e.amount) > 0 && e.type !== 'credit'
  );

  if (validExpenses.length === 0) {
    return [];
  }

  // Group expenses and compute category sums and counts
  const categoryStats = {};
  for (const exp of validExpenses) {
    const category = (exp.category && String(exp.category).trim()) || 'General';
    const amount = Number(exp.amount);

    if (!categoryStats[category]) {
      categoryStats[category] = { total: 0, count: 0, items: [] };
    }
    categoryStats[category].total += amount;
    categoryStats[category].count += 1;
    categoryStats[category].items.push(exp);
  }

  const flagged = [];

  for (const [category, stats] of Object.entries(categoryStats)) {
    // If only 1 transaction exists in the category, amount > 2 * amount is false,
    // which naturally requires at least multiple transactions to establish a baseline.
    const average = stats.total / stats.count;
    const threshold = 2 * average;

    for (const exp of stats.items) {
      const amount = Number(exp.amount);
      if (amount > threshold) {
        flagged.push({
          ...exp,
          category,
          categoryAverage: Math.round(average * 100) / 100,
          threshold: Math.round(threshold * 100) / 100,
          multiplier: Math.round((amount / average) * 100) / 100,
        });
      }
    }
  }

  return flagged;
};

/**
 * 2. detectRecurring(expenses, options)
 *
 * Detects recurring monthly transactions: same merchant with similar amounts
 * repeating across at least 2 distinct calendar months.
 *
 * Algorithm:
 *  - Normalizes merchant name (falls back to title).
 *  - Groups transactions by merchant.
 *  - Clusters amounts within a similarity tolerance (default 15% variation allowed).
 *  - Checks if the cluster spans >= 2 distinct calendar months (YYYY-MM).
 *
 * @param {Array<object>} expenses - List of expense objects
 * @param {object} [options]
 * @param {number} [options.tolerance=0.15] - Allowed amount variation ratio (e.g. 0.15 = 15%)
 * @param {number} [options.minMonths=2] - Minimum number of distinct months required
 * @returns {Array<object>} Detected recurring subscriptions/charges
 */
const detectRecurring = (expenses, options = {}) => {
  if (!Array.isArray(expenses) || expenses.length === 0) {
    return [];
  }

  const tolerance = typeof options.tolerance === 'number' ? options.tolerance : 0.15;
  const minMonths = typeof options.minMonths === 'number' ? options.minMonths : 2;

  // Filter valid expenses
  const validExpenses = expenses.filter(
    (e) => e && typeof e === 'object' && Number(e.amount) > 0 && e.type !== 'credit' && e.date
  );

  // Group by normalized merchant / payee
  const merchantGroups = {};
  for (const exp of validExpenses) {
    const rawMerchant = exp.merchant || exp.title || '';
    const normMerchant = String(rawMerchant).trim().toLowerCase();
    if (!normMerchant) continue;

    if (!merchantGroups[normMerchant]) {
      merchantGroups[normMerchant] = {
        displayName: String(rawMerchant).trim(),
        items: [],
      };
    }
    merchantGroups[normMerchant].items.push(exp);
  }

  const recurringList = [];

  for (const { displayName, items } of Object.values(merchantGroups)) {
    if (items.length < minMonths) continue;

    // Cluster items by similar amounts
    const clusters = [];

    for (const exp of items) {
      const amount = Number(exp.amount);
      const expDate = new Date(exp.date);
      if (isNaN(expDate.getTime())) continue;

      const monthKey = `${expDate.getFullYear()}-${String(expDate.getMonth() + 1).padStart(2, '0')}`;

      let addedToCluster = false;
      for (const cluster of clusters) {
        const clusterAvg = cluster.totalAmount / cluster.items.length;
        const diffRatio = Math.abs(amount - clusterAvg) / clusterAvg;

        if (diffRatio <= tolerance) {
          cluster.items.push(exp);
          cluster.totalAmount += amount;
          cluster.months.add(monthKey);
          addedToCluster = true;
          break;
        }
      }

      if (!addedToCluster) {
        clusters.push({
          items: [exp],
          totalAmount: amount,
          months: new Set([monthKey]),
        });
      }
    }

    // Evaluate clusters meeting the distinct months threshold
    for (const cluster of clusters) {
      if (cluster.months.size >= minMonths) {
        const avgAmount = Math.round((cluster.totalAmount / cluster.items.length) * 100) / 100;
        const sortedMonths = Array.from(cluster.months).sort();

        recurringList.push({
          merchant: displayName,
          category: cluster.items[0].category || 'General',
          averageAmount: avgAmount,
          frequency: 'monthly',
          distinctMonthsCount: cluster.months.size,
          months: sortedMonths,
          expenses: cluster.items,
        });
      }
    }
  }

  return recurringList;
};

/**
 * 3. forecastMonthEnd(expenses, referenceDate)
 *
 * Projects month-end spending based on current daily spending pace.
 *
 * Formula:
 *  - daysInMonth = total days in reference month
 *  - currentDay = day of month (1..daysInMonth)
 *  - spentSoFar = sum of debit expenses in the reference month
 *  - dailyPace = spentSoFar / currentDay
 *  - projectedTotal = dailyPace * daysInMonth
 *  - projectedRemaining = max(0, projectedTotal - spentSoFar)
 *
 * @param {Array<object>} expenses - List of expense objects
 * @param {Date|string} [referenceDate=new Date()] - Date to anchor the pace and current day
 * @returns {object} Month-end projection analysis
 */
const forecastMonthEnd = (expenses, referenceDate = new Date()) => {
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const validRef = !isNaN(ref.getTime()) ? ref : new Date();

  const year = validRef.getFullYear();
  const monthIndex = validRef.getMonth(); // 0-indexed
  const currentDay = validRef.getDate(); // 1-31

  // Total days in this calendar month (day 0 of next month gives last day of current)
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const daysRemaining = Math.max(0, daysInMonth - currentDay);

  let spentSoFar = 0;

  if (Array.isArray(expenses)) {
    for (const exp of expenses) {
      if (!exp || typeof exp !== 'object') continue;
      if (exp.type === 'credit') continue;

      const amount = Number(exp.amount);
      if (isNaN(amount) || amount <= 0) continue;

      if (!exp.date) continue;
      const d = new Date(exp.date);
      if (isNaN(d.getTime())) continue;

      // Match target month and year
      if (d.getFullYear() === year && d.getMonth() === monthIndex) {
        spentSoFar += amount;
      }
    }
  }

  const safeSpent = Math.round(spentSoFar * 100) / 100;
  const dailyPace = currentDay > 0 ? Math.round((spentSoFar / currentDay) * 100) / 100 : 0;
  const projectedTotal = Math.round(dailyPace * daysInMonth * 100) / 100;
  const projectedRemaining = Math.max(0, Math.round((projectedTotal - safeSpent) * 100) / 100);

  return {
    year,
    month: monthIndex + 1, // 1-indexed for human readability (1 = Jan, 10 = Oct)
    daysInMonth,
    currentDay,
    daysRemaining,
    spentSoFar: safeSpent,
    dailyPace,
    projectedTotal,
    projectedRemaining,
  };
};

module.exports = {
  detectUnusual,
  detectRecurring,
  forecastMonthEnd,
};
