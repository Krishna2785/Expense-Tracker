// client/src/pages/Expenses.jsx
// Full Expense Management page: Table view, Add/Edit modal, SMS paste panel,
// category/date filters, and sorting.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

// Common categories for selection
const DEFAULT_CATEGORIES = [
  'Food',
  'Groceries',
  'Transportation',
  'Entertainment',
  'Bills & Utilities',
  'Healthcare',
  'Shopping',
  'Education',
  'Salary',
  'General',
];

const Expenses = () => {
  // --- Data State ---
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({ totalDebit: 0, totalCredit: 0, balance: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // --- Filter & Sort State ---
  const [filters, setFilters] = useState({
    category: '',
    month: '',
    year: '',
    sortBy: 'date',
    order: 'desc',
  });

  // --- Add/Edit Modal State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: 'Food',
    type: 'debit',
    source: 'manual',
    date: todayStr,
    note: '',
  });

  // --- SMS Paste Panel State ---
  const [isSmsOpen, setIsSmsOpen] = useState(false);
  const [smsText, setSmsText] = useState('');
  const [smsParsing, setSmsParsing] = useState(false);
  const [smsError, setSmsError] = useState('');
  // When parsed successfully, show editable pre-filled form
  const [smsPreview, setSmsPreview] = useState(null); // { title, amount, category, type, source, date, note }
  const [smsPreviewError, setSmsPreviewError] = useState('');
  const [smsPreviewSubmitting, setSmsPreviewSubmitting] = useState(false);
  const smsTextareaRef = useRef(null);

  /**
   * Fetch expenses from the backend with current filter and sort params
   */
  const fetchExpenses = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = {};
      if (filters.category) params.category = filters.category;
      if (filters.month) params.month = filters.month;
      if (filters.year) params.year = filters.year;
      if (filters.sortBy) params.sortBy = filters.sortBy;
      if (filters.order) params.order = filters.order;

      const res = await api.get('/expenses', { params });
      if (res.data.success) {
        setExpenses(res.data.data);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err) {
      console.error('[Expenses] Fetch error:', err);
      setError(err.response?.data?.message || 'Failed to load expenses. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  // --- Filter Handlers ---
  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const handleClearFilters = () => {
    setFilters({ category: '', month: '', year: '', sortBy: 'date', order: 'desc' });
  };

  // --- Add/Edit Modal Handlers ---
  const openCreateModal = () => {
    setEditingExpense(null);
    setFormError('');
    setFormData({
      title: '',
      amount: '',
      category: 'Food',
      type: 'debit',
      source: 'manual',
      date: todayStr,
      note: '',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (expense) => {
    setEditingExpense(expense);
    setFormError('');
    setFormData({
      title: expense.title,
      amount: expense.amount,
      category: expense.category,
      type: expense.type,
      source: expense.source,
      date: expense.date ? expense.date.split('T')[0] : todayStr,
      note: expense.note || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
    setFormError('');
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (formError) setFormError('');
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const trimmedTitle = formData.title ? formData.title.trim() : '';
    if (!trimmedTitle || formData.amount === '' || formData.amount === null || formData.amount === undefined) {
      setFormError('Please provide both a valid title and amount.');
      return;
    }
    const numAmount = Number(formData.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('Amount must be a valid positive number greater than 0.');
      return;
    }
    try {
      setFormSubmitting(true);
      setFormError('');
      if (editingExpense) {
        await api.put(`/expenses/${editingExpense._id}`, formData);
      } else {
        await api.post('/expenses', formData);
      }
      closeModal();
      fetchExpenses();
    } catch (err) {
      console.error('[Expenses] Save error:', err);
      setFormError(err.response?.data?.message || 'Failed to save expense.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // --- Delete Handler ---
  const handleDelete = async (expense) => {
    if (!window.confirm(`Are you sure you want to delete "${expense.title}"?`)) return;
    try {
      await api.delete(`/expenses/${expense._id}`);
      fetchExpenses();
    } catch (err) {
      console.error('[Expenses] Delete error:', err);
      alert(err.response?.data?.message || 'Failed to delete expense.');
    }
  };

  // ─── SMS Paste Panel Handlers ───────────────────────────────────────────────

  const openSmsPanel = () => {
    setSmsText('');
    setSmsError('');
    setSmsPreview(null);
    setSmsPreviewError('');
    setIsSmsOpen(true);
    // Focus textarea after render
    setTimeout(() => smsTextareaRef.current?.focus(), 50);
  };

  const closeSmsPanel = () => {
    setIsSmsOpen(false);
    setSmsText('');
    setSmsError('');
    setSmsPreview(null);
    setSmsPreviewError('');
  };

  /**
   * POST /api/expenses/parse-sms → returns parsed fields or error.
   * Does NOT save the expense.
   */
  const handleSmsParse = async () => {
    if (!smsText.trim()) {
      setSmsError('Please paste the SMS text first.');
      return;
    }
    try {
      setSmsParsing(true);
      setSmsError('');
      setSmsPreview(null);

      const res = await api.post('/expenses/parse-sms', { text: smsText });
      if (res.data.success) {
        setSmsPreview({ ...res.data.data });
        setSmsPreviewError('');
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        'Could not parse this SMS. Try another format or enter manually.';
      setSmsError(msg);
      setSmsPreview(null);
    } finally {
      setSmsParsing(false);
    }
  };

  /** User edits the pre-filled SMS form before confirming */
  const handleSmsPreviewChange = (e) => {
    setSmsPreview({ ...smsPreview, [e.target.name]: e.target.value });
    if (smsPreviewError) setSmsPreviewError('');
  };

  /** Save the confirmed SMS-parsed expense (source: 'sms') */
  const handleSmsPreviewSave = async (e) => {
    e.preventDefault();
    const trimmedTitle = smsPreview?.title ? String(smsPreview.title).trim() : '';
    if (!trimmedTitle || smsPreview?.amount === '' || smsPreview?.amount === null || smsPreview?.amount === undefined) {
      setSmsPreviewError('Title and amount are required.');
      return;
    }
    const numAmount = Number(smsPreview.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setSmsPreviewError('Amount must be a valid positive number greater than 0.');
      return;
    }
    try {
      setSmsPreviewSubmitting(true);
      setSmsPreviewError('');
      await api.post('/expenses', { ...smsPreview, source: 'sms' });
      closeSmsPanel();
      fetchExpenses();
    } catch (err) {
      setSmsPreviewError(err.response?.data?.message || 'Failed to save expense.');
    } finally {
      setSmsPreviewSubmitting(false);
    }
  };

  /** Discard parsed result and let user fill in the form manually */
  const handleSmsManualEntry = () => {
    const draft = smsPreview || {};
    setFormData({
      title: draft.title || '',
      amount: draft.amount || '',
      category: draft.category || 'General',
      type: draft.type || 'debit',
      source: 'manual',
      date: draft.date || todayStr,
      note: draft.note || '',
    });
    closeSmsPanel();
    setIsModalOpen(true);
  };

  // Dynamic category list for the filter dropdown
  const categoryOptions = Array.from(
    new Set([...DEFAULT_CATEGORIES, ...expenses.map((e) => e.category)])
  ).filter(Boolean);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Expense Management</h1>
          <p className="page-subtitle">
            Track, filter, and review all your income and expense transactions.
          </p>
        </div>
        <div className="page-actions">
          <button
            id="btn-paste-sms"
            onClick={openSmsPanel}
            className="btn-secondary"
            title="Import from bank/UPI SMS alert"
          >
            📩 Paste SMS
          </button>
          <button id="btn-add-expense" onClick={openCreateModal} className="btn-primary">
            + Add Expense
          </button>
        </div>
      </div>

      {/* ── SMS Paste Panel ───────────────────────────────────────────────────── */}
      {isSmsOpen && (
        <div className="sms-panel">
          <div className="sms-panel-header">
            <div className="sms-panel-title">
              <span>📩</span>
              <h3>Import from Bank / UPI SMS</h3>
            </div>
            <button
              type="button"
              className="modal-close-btn"
              onClick={closeSmsPanel}
              aria-label="Close SMS panel"
            >
              &times;
            </button>
          </div>

          {/* Step 1: Paste area */}
          {!smsPreview && (
            <div className="sms-panel-body">
              <p className="sms-panel-hint">
                Paste a bank or UPI transaction SMS below. Personal account details are
                safe — they are never stored or sent elsewhere.
              </p>
              <textarea
                id="sms-paste-input"
                ref={smsTextareaRef}
                className="sms-textarea"
                rows={4}
                placeholder={
                  'e.g. "Sent Rs.450.00 from HDFC Bank A/C **1234 to SWIGGY on 10-OCT-24. UPI Ref: 1234567890."'
                }
                value={smsText}
                onChange={(e) => {
                  setSmsText(e.target.value);
                  if (smsError) setSmsError('');
                }}
              />

              {smsError && (
                <div className="sms-error-block">
                  <span className="sms-error-icon">⚠️</span>
                  <div>
                    <p className="sms-error-msg">{smsError}</p>
                    <button
                      type="button"
                      className="sms-link-btn"
                      onClick={handleSmsManualEntry}
                    >
                      Enter details manually instead →
                    </button>
                  </div>
                </div>
              )}

              <div className="sms-panel-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={closeSmsPanel}
                >
                  Cancel
                </button>
                <button
                  id="btn-parse-sms"
                  type="button"
                  className="btn-primary"
                  onClick={handleSmsParse}
                  disabled={smsParsing || !smsText.trim()}
                >
                  {smsParsing ? '🔍 Parsing…' : '🔍 Parse SMS'}
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Parsed preview — editable confirmation form */}
          {smsPreview && (
            <form className="sms-panel-body" onSubmit={handleSmsPreviewSave}>
              <div className="sms-preview-banner">
                <span>✅</span>
                <div>
                  <strong>Parsed successfully!</strong> Review the details below,
                  make any changes, then click &ldquo;Save Expense&rdquo; to confirm.
                </div>
              </div>

              {smsPreviewError && (
                <div className="alert-error">{smsPreviewError}</div>
              )}

              {/* Title */}
              <div className="form-group">
                <label htmlFor="sms-title">Transaction Title *</label>
                <input
                  id="sms-title"
                  type="text"
                  name="title"
                  className="form-input"
                  value={smsPreview.title}
                  onChange={handleSmsPreviewChange}
                  required
                />
              </div>

              {/* Amount + Category */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="sms-amount">Amount (₹) *</label>
                  <input
                    id="sms-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    name="amount"
                    className="form-input"
                    value={smsPreview.amount}
                    onChange={handleSmsPreviewChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="sms-category">Category *</label>
                  <input
                    id="sms-category"
                    type="text"
                    name="category"
                    className="form-input"
                    list="sms-category-suggestions"
                    value={smsPreview.category}
                    onChange={handleSmsPreviewChange}
                    required
                  />
                  <datalist id="sms-category-suggestions">
                    {DEFAULT_CATEGORIES.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  <span className="sms-category-hint">
                    💡 Changing this will remember the category for <strong>{smsPreview.merchant || 'this merchant'}</strong> next time.
                  </span>
                </div>
              </div>

              {/* Type + Date */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="sms-type">Type</label>
                  <select
                    id="sms-type"
                    name="type"
                    className="form-input"
                    value={smsPreview.type}
                    onChange={handleSmsPreviewChange}
                  >
                    <option value="debit">Debit (Money Out)</option>
                    <option value="credit">Credit (Money In)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="sms-date">Transaction Date</label>
                  <input
                    id="sms-date"
                    type="date"
                    name="date"
                    className="form-input"
                    value={smsPreview.date}
                    onChange={handleSmsPreviewChange}
                    required
                  />
                </div>
              </div>

              {/* Note */}
              <div className="form-group">
                <label htmlFor="sms-note">Note (Optional)</label>
                <input
                  id="sms-note"
                  type="text"
                  name="note"
                  className="form-input"
                  placeholder="Short reminder..."
                  value={smsPreview.note}
                  onChange={handleSmsPreviewChange}
                  maxLength={250}
                />
              </div>

              {/* source is always 'sms' here — display only */}
              <p className="sms-source-note">
                🏷️ This expense will be tagged as <strong>source: SMS</strong>
              </p>

              <div className="sms-panel-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSmsPreview(null)}
                >
                  ← Re-paste
                </button>
                <button
                  type="button"
                  className="sms-link-btn"
                  style={{ marginRight: 'auto' }}
                  onClick={handleSmsManualEntry}
                >
                  Switch to manual
                </button>
                <button
                  type="submit"
                  id="btn-save-sms-expense"
                  className="btn-primary"
                  disabled={smsPreviewSubmitting}
                >
                  {smsPreviewSubmitting ? 'Saving…' : '💾 Save Expense'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Financial Summary Bar */}
      <div className="expense-summary-bar">
        <div className="summary-pill">
          <span className="label">Total Spent (Debits):</span>
          <span className="amount amount-debit">${summary.totalDebit.toFixed(2)}</span>
        </div>
        <div className="summary-pill">
          <span className="label">Total Income (Credits):</span>
          <span className="amount amount-credit">${summary.totalCredit.toFixed(2)}</span>
        </div>
        <div className="summary-pill">
          <span className="label">Net Balance:</span>
          <span className={`amount ${summary.balance >= 0 ? 'amount-credit' : 'amount-debit'}`}>
            ${summary.balance.toFixed(2)}
          </span>
        </div>
        <div className="summary-pill">
          <span className="label">Records Count:</span>
          <span className="amount">{expenses.length}</span>
        </div>
      </div>

      {/* Filter and Sort Toolbar */}
      <div className="filters-toolbar">
        <div className="filter-group">
          <label htmlFor="category">Category</label>
          <select
            id="category"
            name="category"
            value={filters.category}
            onChange={handleFilterChange}
          >
            <option value="">All Categories</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="month">Month</label>
          <select id="month" name="month" value={filters.month} onChange={handleFilterChange}>
            <option value="">All Months</option>
            <option value="1">January (1)</option>
            <option value="2">February (2)</option>
            <option value="3">March (3)</option>
            <option value="4">April (4)</option>
            <option value="5">May (5)</option>
            <option value="6">June (6)</option>
            <option value="7">July (7)</option>
            <option value="8">August (8)</option>
            <option value="9">September (9)</option>
            <option value="10">October (10)</option>
            <option value="11">November (11)</option>
            <option value="12">December (12)</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="year">Year</label>
          <select id="year" name="year" value={filters.year} onChange={handleFilterChange}>
            <option value="">All Years</option>
            <option value="2027">2027</option>
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="sortBy">Sort By</label>
          <select
            id="sortBy"
            name="sortBy"
            value={`${filters.sortBy}-${filters.order}`}
            onChange={(e) => {
              const [sortBy, order] = e.target.value.split('-');
              setFilters({ ...filters, sortBy, order });
            }}
          >
            <option value="date-desc">Date (Newest First)</option>
            <option value="date-asc">Date (Oldest First)</option>
            <option value="amount-desc">Amount (Highest First)</option>
            <option value="amount-asc">Amount (Lowest First)</option>
          </select>
        </div>

        <button type="button" onClick={handleClearFilters} className="btn-secondary" title="Reset all filters">
          Reset Filters
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={fetchExpenses} className="btn-secondary" style={{ height: '30px', padding: '0 0.5rem' }}>
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="loading-container" style={{ minHeight: '300px' }}>
          <div className="spinner"></div>
          <p>Loading transactions...</p>
        </div>
      ) : (
        /* Expenses Table */
        <div className="table-wrapper">
          <div className="table-responsive">
            <table className="expense-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Source</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan="7">
                      <div className="empty-state">
                        <div className="empty-state-icon">🧾</div>
                        <h4>No transactions found</h4>
                        <p>
                          Try clearing filters, click &ldquo;+ Add Expense&rdquo; to record
                          manually, or use &ldquo;📩 Paste SMS&rdquo; to import from a bank
                          alert.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  expenses.map((item) => (
                    <tr key={item._id}>
                      <td>
                        <div className="expense-title-cell">
                          <span className="expense-title-main">{item.title}</span>
                          {item.note && <span className="expense-title-note">{item.note}</span>}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-category">{item.category}</span>
                      </td>
                      <td>
                        <span className={item.type === 'credit' ? 'amount-credit' : 'amount-debit'}>
                          {item.type === 'credit' ? '+' : '-'}${Number(item.amount).toFixed(2)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${item.type === 'credit' ? 'badge-credit' : 'badge-debit'}`}>
                          {item.type}
                        </span>
                      </td>
                      <td>
                        {item.date
                          ? new Date(item.date).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })
                          : 'N/A'}
                      </td>
                      <td>
                        <span className={`badge ${item.source === 'sms' ? 'badge-sms' : 'badge-source'}`}>
                          {item.source === 'sms' ? '📩 SMS' : item.source}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="actions-cell" style={{ justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => openEditModal(item)}
                            className="btn-action edit"
                            title="Edit transaction"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="btn-action delete"
                            title="Delete transaction"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Expense Modal Dialog */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingExpense ? 'Edit Transaction' : 'Record New Expense'}</h3>
              <button onClick={closeModal} className="modal-close-btn" aria-label="Close modal">
                &times;
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className="modal-body">
                {formError && <div className="alert-error">{formError}</div>}

                <div className="form-group">
                  <label htmlFor="modal-title">Transaction Title *</label>
                  <input
                    id="modal-title"
                    type="text"
                    name="title"
                    placeholder="e.g. Weekly Groceries, Movie Ticket"
                    value={formData.title}
                    onChange={handleFormChange}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="modal-amount">Amount ($) *</label>
                    <input
                      id="modal-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      name="amount"
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="modal-category">Category *</label>
                    <input
                      id="modal-category"
                      type="text"
                      name="category"
                      list="category-suggestions"
                      placeholder="e.g. Food, Bills"
                      value={formData.category}
                      onChange={handleFormChange}
                      required
                    />
                    <datalist id="category-suggestions">
                      {DEFAULT_CATEGORIES.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="modal-type">Type</label>
                    <select id="modal-type" name="type" value={formData.type} onChange={handleFormChange}>
                      <option value="debit">Debit (Expense - Money Out)</option>
                      <option value="credit">Credit (Income - Money In)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="modal-source">Source</label>
                    <select id="modal-source" name="source" value={formData.source} onChange={handleFormChange}>
                      <option value="manual">Manual Entry</option>
                      <option value="sms">SMS Notification</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="modal-date">Transaction Date</label>
                  <input
                    id="modal-date"
                    type="date"
                    name="date"
                    value={formData.date}
                    onChange={handleFormChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="modal-note">Note (Optional)</label>
                  <input
                    id="modal-note"
                    type="text"
                    name="note"
                    placeholder="Short description or reminder..."
                    value={formData.note}
                    onChange={handleFormChange}
                    maxLength={250}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={closeModal} className="btn-secondary" disabled={formSubmitting}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={formSubmitting}>
                  {formSubmitting ? 'Saving...' : editingExpense ? 'Update Expense' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
