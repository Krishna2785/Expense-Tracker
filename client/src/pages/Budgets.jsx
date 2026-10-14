// client/src/pages/Budgets.jsx
// Monthly Category Budgets management page with real-time spending progress and threshold warnings.

import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

// Predefined categories for quick selection
const PRESET_CATEGORIES = [
  'Food',
  'Groceries',
  'Transportation',
  'Entertainment',
  'Bills & Utilities',
  'Healthcare',
  'Shopping',
  'Education',
  'General',
];

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Currency formatter
const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);

/**
 * Determine progress threshold status:
 * - 'safe' (green): below 70%
 * - 'warning' (orange): 70% to 100%
 * - 'danger' (red): above 100%
 */
const getBudgetStatus = (percentage) => {
  if (percentage > 100) return 'danger';
  if (percentage >= 70) return 'warning';
  return 'safe';
};

const Budgets = () => {
  // Current month and year defaults
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  // Data states
  const [budgets, setBudgets] = useState([]);
  const [expenseSummary, setExpenseSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal & Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState(null);
  const [formData, setFormData] = useState({
    category: 'Food',
    customCategory: '',
    monthlyLimit: '',
  });
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation modal state
  const [deletingBudget, setDeletingBudget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Year options for dropdown (5 years past to current)
  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  /**
   * Fetch both /api/budgets and /api/expenses/summary concurrently
   */
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = { month: selectedMonth, year: selectedYear };

      const [budgetRes, summaryRes] = await Promise.all([
        api.get('/budgets', { params }),
        api.get('/expenses/summary', { params }),
      ]);

      if (budgetRes.data?.success) {
        setBudgets(budgetRes.data.data || []);
      }

      if (summaryRes.data?.success) {
        setExpenseSummary(summaryRes.data);
      }
    } catch (err) {
      setError(
        err.response?.data?.message || 'Failed to load budgets and expense summary.'
      );
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Handlers for Create / Edit Modal ---

  const handleOpenCreateModal = (prefilledCategory = '') => {
    setEditingBudget(null);
    setFormError('');

    if (prefilledCategory) {
      const isPreset = PRESET_CATEGORIES.includes(prefilledCategory);
      setFormData({
        category: isPreset ? prefilledCategory : 'Other',
        customCategory: isPreset ? '' : prefilledCategory,
        monthlyLimit: '',
      });
    } else {
      setFormData({
        category: 'Food',
        customCategory: '',
        monthlyLimit: '',
      });
    }

    setIsModalOpen(true);
  };

  const handleOpenEditModal = (budget) => {
    setEditingBudget(budget);
    setFormError('');

    const isPreset = PRESET_CATEGORIES.includes(budget.category);
    setFormData({
      category: isPreset ? budget.category : 'Other',
      customCategory: isPreset ? '' : budget.category,
      monthlyLimit: budget.monthlyLimit.toString(),
    });

    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBudget(null);
    setFormError('');
  };

  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setFormError('');

    const targetCategory =
      formData.category === 'Other'
        ? formData.customCategory.trim()
        : formData.category.trim();

    if (!targetCategory) {
      setFormError('Please select or specify a category.');
      return;
    }

    const limitVal = parseFloat(formData.monthlyLimit);
    if (isNaN(limitVal) || limitVal <= 0) {
      setFormError('Monthly limit must be a valid positive number greater than 0.');
      return;
    }

    try {
      setSubmitting(true);

      if (editingBudget) {
        // PUT /api/budgets/:id
        await api.put(`/budgets/${editingBudget._id}`, {
          category: targetCategory,
          monthlyLimit: limitVal,
        });
      } else {
        // POST /api/budgets
        await api.post('/budgets', {
          category: targetCategory,
          monthlyLimit: limitVal,
        });
      }

      handleCloseModal();
      await fetchData();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Error saving budget limit.');
    } finally {
      setSubmitting(false);
    }
  };

  // --- Delete Handler ---

  const handleDeleteBudget = async () => {
    if (!deletingBudget) return;
    try {
      setDeleteLoading(true);
      await api.delete(`/budgets/${deletingBudget._id}`);
      setDeletingBudget(null);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete budget.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // --- Computed Metrics ---

  const totalMonthlyBudget = budgets.reduce((acc, b) => acc + (b.monthlyLimit || 0), 0);
  const totalBudgetedSpent = budgets.reduce((acc, b) => acc + (b.currentSpent || 0), 0);
  const totalRemainingBudget = totalMonthlyBudget - totalBudgetedSpent;

  // Categories status breakdown
  const overBudgetCategories = budgets.filter((b) => (b.percentageUsed || 0) > 100);
  const nearLimitCategories = budgets.filter(
    (b) => (b.percentageUsed || 0) >= 70 && (b.percentageUsed || 0) <= 100
  );

  // Identify categories from /api/expenses/summary that do not have a budget yet
  const budgetedCategoryNames = new Set(
    budgets.map((b) => b.category.toLowerCase().trim())
  );
  const unbudgetedCategoriesWithSpend = (expenseSummary?.categoryBreakdown || []).filter(
    (c) => !budgetedCategoryNames.has(c.category.toLowerCase().trim())
  );

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Monthly Budgets</h1>
          <p className="page-subtitle">
            Set category limits and stay on track with real-time threshold progress tracking.
          </p>
        </div>
        <div className="page-actions">
          <button
            id="btn-set-budget"
            className="btn-primary"
            onClick={() => handleOpenCreateModal()}
          >
            + Set Category Budget
          </button>
        </div>
      </div>

      {/* Month & Year Toolbar */}
      <div className="dashboard-filters">
        <label htmlFor="budget-month" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Period:
        </label>
        <select
          id="budget-month"
          className="filter-select"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
        >
          {MONTH_NAMES.map((m, i) => (
            <option key={m} value={i + 1}>
              {m}
            </option>
          ))}
        </select>
        <select
          id="budget-year"
          className="filter-select"
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <button
          className="btn-secondary"
          onClick={fetchData}
          disabled={loading}
          title="Refresh budgets and summary"
        >
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {/* Global Error Banner */}
      {error && <div className="error-banner">{error}</div>}

      {/* Top Metrics Cards */}
      <div className="dashboard-grid">
        <div className="metric-card">
          <span className="metric-label">Total Category Budget</span>
          <span className="metric-value accent">{fmt(totalMonthlyBudget)}</span>
          <span className="metric-hint">
            Sum of limits across {budgets.length} {budgets.length === 1 ? 'category' : 'categories'}
          </span>
        </div>

        <div className="metric-card">
          <span className="metric-label">
            Spent in {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
          </span>
          <span className={`metric-value ${totalBudgetedSpent > totalMonthlyBudget ? 'debit' : 'safe'}`}>
            {fmt(totalBudgetedSpent)}
          </span>
          <span className="metric-hint">
            {totalMonthlyBudget > 0
              ? `${((totalBudgetedSpent / totalMonthlyBudget) * 100).toFixed(1)}% of total allocated limit`
              : 'No limits set yet'}
          </span>
        </div>

        <div className="metric-card">
          <span className="metric-label">Remaining Safe Budget</span>
          <span className={`metric-value ${totalRemainingBudget < 0 ? 'debit' : 'safe'}`}>
            {fmt(totalRemainingBudget)}
          </span>
          <span className="metric-hint">
            {totalRemainingBudget >= 0
              ? 'Available across your budgeted targets'
              : 'Overall budget currently exceeded'}
          </span>
        </div>
      </div>

      {/* Warning Summary Banner (if any category is close to or over limit) */}
      {(overBudgetCategories.length > 0 || nearLimitCategories.length > 0) && (
        <div
          className={`budget-alert-banner ${
            overBudgetCategories.length > 0 ? 'has-danger' : ''
          }`}
        >
          <span className="budget-alert-icon">
            {overBudgetCategories.length > 0 ? '🚨' : '⚠️'}
          </span>
          <div className="budget-alert-content">
            <h4 className="budget-alert-title">
              {overBudgetCategories.length > 0
                ? `${overBudgetCategories.length} ${
                    overBudgetCategories.length === 1 ? 'Category' : 'Categories'
                  } Exceeded Monthly Limit!`
                : `${nearLimitCategories.length} ${
                    nearLimitCategories.length === 1 ? 'Category' : 'Categories'
                  } Approaching Spending Limit`}
            </h4>
            <p className="budget-alert-desc">
              {overBudgetCategories.length > 0 && (
                <span>
                  Over limit:{' '}
                  <strong>
                    {overBudgetCategories.map((b) => b.category).join(', ')}
                  </strong>
                  .{' '}
                </span>
              )}
              {nearLimitCategories.length > 0 && (
                <span>
                  Close to limit (&gt;= 70%):{' '}
                  <strong>
                    {nearLimitCategories.map((b) => b.category).join(', ')}
                  </strong>
                  .
                </span>
              )}
            </p>
          </div>
        </div>
      )}

      {/* Main Budget Cards Content */}
      {loading ? (
        <div className="empty-state">
          <span className="empty-icon">⏳</span>
          <p>Loading your budget limits and spending progress…</p>
        </div>
      ) : budgets.length === 0 ? (
        <div className="content-card empty-state">
          <div className="empty-state-icon">🎯</div>
          <h4>No Monthly Budgets Configured Yet</h4>
          <p style={{ maxWidth: '460px', margin: '0 auto 1.25rem', lineHeight: '1.5' }}>
            Set monthly spending caps on categories like Food, Utilities, or Entertainment.
            Visual progress bars will alert you at 70% and highlight any overspending.
          </p>
          <button
            className="btn-primary"
            onClick={() => handleOpenCreateModal()}
          >
            + Set Your First Category Budget
          </button>
        </div>
      ) : (
        <div className="budget-grid">
          {budgets.map((b) => {
            const percentage = b.percentageUsed ?? 0;
            const status = getBudgetStatus(percentage);
            const remaining = b.remaining ?? (b.monthlyLimit - b.currentSpent);
            const isOver = status === 'danger';
            const isWarning = status === 'warning';

            return (
              <div
                key={b._id}
                className={`budget-card status-${status}`}
              >
                {/* Header */}
                <div className="budget-card-header">
                  <div className="budget-category-info">
                    <span className="budget-category-title">{b.category}</span>
                    <span className={`budget-badge ${status}`}>
                      {status === 'safe' && '🟢 On Track'}
                      {status === 'warning' && '🟠 Near Limit'}
                      {status === 'danger' && '🔴 Over Budget'}
                      {' '}({percentage.toFixed(1)}%)
                    </span>
                  </div>

                  <div className="budget-actions">
                    <button
                      className="btn-action edit"
                      title="Edit Budget Limit"
                      onClick={() => handleOpenEditModal(b)}
                    >
                      ✏️ Edit
                    </button>
                    <button
                      className="btn-action delete"
                      title="Delete Budget"
                      onClick={() => setDeletingBudget(b)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* Amounts Spent vs Limit */}
                <div className="budget-amounts">
                  <div>
                    <span className="budget-spent">{fmt(b.currentSpent)}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '0.35rem' }}>
                      spent
                    </span>
                  </div>
                  <div className="budget-limit">
                    Limit: <strong>{fmt(b.monthlyLimit)}</strong>
                  </div>
                </div>

                {/* Progress Bar (green <70%, orange 70-100%, red >100%) */}
                <div className="budget-progress-track">
                  <div
                    className={`budget-progress-bar ${status}`}
                    style={{
                      width: `${Math.min(percentage, 100)}%`,
                    }}
                  />
                </div>

                {/* Footer Metrics */}
                <div className="budget-stats-footer">
                  <span>
                    {isOver ? 'Exceeded by:' : 'Remaining:'}
                  </span>
                  <span className={`budget-remaining-text ${status}`}>
                    {isOver ? `+${fmt(Math.abs(remaining))}` : fmt(remaining)}
                  </span>
                </div>

                {/* Warning / Alert Callout Message */}
                {isOver && (
                  <div className="budget-warning-notice danger">
                    <span>🚨</span>
                    <span>
                      Exceeded budget by {fmt(Math.abs(remaining))} ({percentage.toFixed(1)}% of limit)
                    </span>
                  </div>
                )}

                {isWarning && (
                  <div className="budget-warning-notice warning">
                    <span>⚠️</span>
                    <span>
                      Approaching limit: {percentage.toFixed(1)}% used ({fmt(remaining)} left)
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Unbudgeted Active Spending Callout (from /api/expenses/summary) */}
      {!loading && unbudgetedCategoriesWithSpend.length > 0 && (
        <div className="unbudgeted-callout">
          <h4>💡 Unbudgeted Spending in {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</h4>
          <p>
            You have active expenses in categories without a monthly target. Click any category to set a budget limit:
          </p>
          <div className="unbudgeted-tags">
            {unbudgetedCategoriesWithSpend.map((cat) => (
              <button
                key={cat.category}
                className="unbudgeted-tag-btn"
                onClick={() => handleOpenCreateModal(cat.category)}
              >
                <span>+</span>
                <strong>{cat.category}</strong>
                <span>({fmt(cat.totalAmount)})</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================================
          Create / Edit Budget Modal
         ====================================================================== */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={handleCloseModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingBudget ? 'Edit Monthly Budget' : 'Set Category Monthly Budget'}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseModal}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitForm}>
              <div className="modal-body">
                {formError && <div className="error-banner">{formError}</div>}

                {/* Category Selection */}
                <div className="form-group">
                  <label htmlFor="budget-form-category" className="form-label">
                    Category <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <select
                    id="budget-form-category"
                    className="form-input"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    disabled={!!editingBudget} // category cannot be changed on edit to avoid index clashes
                  >
                    {PRESET_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                    <option value="Other">Other (Custom Category)</option>
                  </select>
                  {editingBudget && (
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      Category name cannot be changed once created. Create a new budget for other categories.
                    </small>
                  )}
                </div>

                {/* Custom Category Input if "Other" is chosen */}
                {formData.category === 'Other' && !editingBudget && (
                  <div className="form-group">
                    <label htmlFor="budget-form-custom-category" className="form-label">
                      Custom Category Name <span style={{ color: 'var(--danger)' }}>*</span>
                    </label>
                    <input
                      id="budget-form-custom-category"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Fitness, Pets, Subscriptions"
                      value={formData.customCategory}
                      onChange={(e) =>
                        setFormData({ ...formData, customCategory: e.target.value })
                      }
                      required
                    />
                  </div>
                )}

                {/* Monthly Limit Amount */}
                <div className="form-group">
                  <label htmlFor="budget-form-limit" className="form-label">
                    Monthly Limit ($) <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>
                  <input
                    id="budget-form-limit"
                    type="number"
                    step="0.01"
                    min="0"
                    className="form-input"
                    placeholder="e.g. 500.00"
                    value={formData.monthlyLimit}
                    onChange={(e) =>
                      setFormData({ ...formData, monthlyLimit: e.target.value })
                    }
                    required
                  />
                  <small style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '0.35rem' }}>
                    Threshold warnings will automatically appear at 70% and above 100%.
                  </small>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCloseModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting
                    ? 'Saving…'
                    : editingBudget
                    ? 'Update Budget'
                    : 'Create Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================================
          Delete Confirmation Modal
         ====================================================================== */}
      {deletingBudget && (
        <div
          className="modal-backdrop"
          onClick={() => !deleteLoading && setDeletingBudget(null)}
        >
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Budget</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !deleteLoading && setDeletingBudget(null)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                Are you sure you want to delete the monthly budget for{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {deletingBudget.category}
                </strong>{' '}
                ({fmt(deletingBudget.monthlyLimit)})? This will not delete your past
                expenses in this category.
              </p>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeletingBudget(null)}
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-action delete"
                style={{ padding: '0.6rem 1.25rem', fontSize: '0.88rem' }}
                onClick={handleDeleteBudget}
                disabled={deleteLoading}
              >
                {deleteLoading ? 'Deleting…' : 'Delete Budget'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Budgets;
