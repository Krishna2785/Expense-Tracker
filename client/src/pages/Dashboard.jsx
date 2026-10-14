// client/src/pages/Dashboard.jsx
// Main application dashboard with real-time charts powered by Recharts
// and intelligent financial insights (unusual spending, recurring bills, and month-end pace).

import React, { useState, useEffect, useCallback } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

// Colour palette for category slices
const CHART_COLORS = [
  '#6C63FF', '#FF6584', '#43CFAB', '#FFC75F', '#F97316',
  '#3B82F6', '#EC4899', '#10B981', '#F59E0B', '#8B5CF6',
];

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0);

const PieTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const { name, value, payload: p } = payload[0];
    return (
      <div className="chart-tooltip">
        <span className="tooltip-label">{name}</span>
        <span className="tooltip-value">{fmt(value)}</span>
        <span className="tooltip-percent">{p.percent}%</span>
      </div>
    );
  }
  return null;
};

const BarTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <span className="tooltip-label">{label}</span>
        <span className="tooltip-value">{fmt(payload[0].value)}</span>
      </div>
    );
  }
  return null;
};

const Dashboard = () => {
  const { user } = useAuth();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Financial Insights State
  const [insights, setInsights] = useState(null);
  const [insightsLoading, setInsightsLoading] = useState(false);

  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { month: selectedMonth, year: selectedYear };
      const { data } = await api.get('/expenses/summary', { params });
      if (data.success) {
        setSummary(data);
      } else {
        setError('Could not load summary data.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  const fetchInsights = useCallback(async () => {
    try {
      setInsightsLoading(true);
      const { data } = await api.get('/insights');
      if (data.success) {
        setInsights(data.data);
      }
    } catch (err) {
      console.error('[Dashboard] Insights error:', err);
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const handleRefresh = () => {
    fetchSummary();
    fetchInsights();
  };

  const pieData = (summary?.categoryBreakdown || []).map((c) => ({
    name: c.category,
    value: c.totalAmount,
    percent: c.percent,
  }));

  const barData = (summary?.monthlyBreakdown || []).map((m) => ({
    name: MONTH_NAMES[m.month - 1],
    Total: m.totalAmount,
  }));

  const totalSpent = summary?.totalSpent ?? 0;
  const hasCategories = pieData.length > 0;
  const hasMonthly = barData.length > 0;

  const forecast = insights?.forecast || null;
  const unusual = insights?.unusual || [];
  const recurring = insights?.recurring || [];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Welcome back, {user?.name || 'Explorer'} 👋</h1>
          <p className="page-subtitle">Here is a quick overview of your financial activity.</p>
        </div>
        <div className="page-actions">
          <Link to="/expenses" className="btn-primary">+ New Expense</Link>
        </div>
      </div>

      <div className="dashboard-filters">
        <select
          id="dash-month"
          className="filter-select"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
        >
          {MONTH_NAMES.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <select
          id="dash-year"
          className="filter-select"
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
        <button className="btn-secondary" onClick={handleRefresh} disabled={loading || insightsLoading}>
          {loading || insightsLoading ? 'Loading…' : '↻ Refresh'}
        </button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {loading && (
        <div className="empty-state">
          <span className="empty-icon">⏳</span>
          <p>Fetching your financial data…</p>
        </div>
      )}

      {!loading && (
        <>
          {/* Key Metric Highlights */}
          <div className="dashboard-grid">
            <div className="metric-card highlight">
              <span className="metric-label">Total Spent — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</span>
              <span className="metric-value debit">{fmt(totalSpent)}</span>
              <span className="metric-hint">Sum of all debit transactions this period</span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Top Category</span>
              <span className="metric-value accent">
                {hasCategories ? pieData[0].name : '—'}
              </span>
              <span className="metric-hint">
                {hasCategories ? fmt(pieData[0].value) : 'No data yet'}
              </span>
            </div>
            <div className="metric-card">
              <span className="metric-label">Active Categories</span>
              <span className="metric-value safe">{pieData.length}</span>
              <span className="metric-hint">Distinct spending categories this period</span>
            </div>
          </div>

          {/* ================================================================
              Financial Insights Section
              ================================================================ */}
          <div className="insights-section">
            <div className="insights-header">
              <h2 className="insights-title">💡 Financial Insights</h2>
              <p className="insights-subtitle">
                Automated pattern detection and pacing projections for your accounts
              </p>
            </div>

            <div className="insights-grid">
              {/* Card 1: Month-End Forecast */}
              <div className="insight-card">
                <div className="insight-card-header">
                  <span className="insight-card-title">🔮 Month-End Forecast</span>
                  <span className="insight-badge info">
                    {forecast ? `${forecast.daysRemaining} days left` : 'Pacing'}
                  </span>
                </div>
                <div className="insight-card-body">
                  {forecast ? (
                    <>
                      <div className="forecast-stats">
                        <div className="forecast-stat-box">
                          <div className="forecast-stat-label">Projected Total</div>
                          <div className="forecast-stat-value primary">
                            {fmt(forecast.projectedTotal)}
                          </div>
                        </div>
                        <div className="forecast-stat-box">
                          <div className="forecast-stat-label">Daily Pace</div>
                          <div className="forecast-stat-value">
                            {fmt(forecast.dailyPace)}/day
                          </div>
                        </div>
                        <div className="forecast-stat-box">
                          <div className="forecast-stat-label">Spent So Far</div>
                          <div className="forecast-stat-value">
                            {fmt(forecast.spentSoFar)}
                          </div>
                        </div>
                        <div className="forecast-stat-box">
                          <div className="forecast-stat-label">Projected Left</div>
                          <div className="forecast-stat-value">
                            {fmt(forecast.projectedRemaining)}
                          </div>
                        </div>
                      </div>
                      <p className="forecast-note">
                        {forecast.spentSoFar > 0
                          ? `📈 At your current pace through Day ${forecast.currentDay}, spending will reach ${fmt(forecast.projectedTotal)} by month-end.`
                          : 'No spending recorded yet for the current calendar month.'}
                      </p>
                    </>
                  ) : (
                    <div className="insight-empty">
                      <span className="insight-empty-icon">⏳</span>
                      <span>Calculating month-end projection…</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 2: Unusual Expenses */}
              <div className="insight-card">
                <div className="insight-card-header">
                  <span className="insight-card-title">⚠️ Unusual Expenses</span>
                  <span className={`insight-badge ${unusual.length > 0 ? 'warning' : 'success'}`}>
                    {unusual.length > 0 ? `${unusual.length} flagged` : 'All normal'}
                  </span>
                </div>
                <div className="insight-card-body">
                  {unusual.length > 0 ? (
                    <div className="insight-list">
                      {unusual.slice(0, 4).map((exp, idx) => (
                        <div key={exp._id || idx} className="insight-item">
                          <div className="insight-item-left">
                            <span className="insight-item-title">{exp.title}</span>
                            <span className="insight-item-meta">
                              <span>{exp.category}</span>
                              <span>•</span>
                              <span>
                                {exp.date ? new Date(exp.date).toLocaleDateString() : 'Recent'}
                              </span>
                            </span>
                          </div>
                          <div className="insight-item-right">
                            <span className="insight-item-amount alert">{fmt(exp.amount)}</span>
                            <span className="insight-item-sub">
                              {exp.multiplier ? `${exp.multiplier}x avg` : '>2x avg'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="insight-empty">
                      <span className="insight-empty-icon">✅</span>
                      <span>
                        No unusual spending spikes detected! All expenses are within 2x of their category average.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 3: Recurring Payments */}
              <div className="insight-card">
                <div className="insight-card-header">
                  <span className="insight-card-title">🔄 Recurring Payments</span>
                  <span className={`insight-badge ${recurring.length > 0 ? 'info' : 'success'}`}>
                    {recurring.length > 0 ? `${recurring.length} active` : 'None detected'}
                  </span>
                </div>
                <div className="insight-card-body">
                  {recurring.length > 0 ? (
                    <div className="insight-list">
                      {recurring.slice(0, 4).map((rec, idx) => (
                        <div key={idx} className="insight-item">
                          <div className="insight-item-left">
                            <span className="insight-item-title">{rec.merchant}</span>
                            <span className="insight-item-meta">
                              <span>{rec.category}</span>
                              <span>•</span>
                              <span>{rec.distinctMonthsCount} months</span>
                            </span>
                          </div>
                          <div className="insight-item-right">
                            <span className="insight-item-amount">~{fmt(rec.averageAmount)}</span>
                            <span className="insight-item-sub">monthly</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="insight-empty">
                      <span className="insight-empty-icon">🔄</span>
                      <span>
                        No recurring subscriptions detected yet. Regular monthly payments will appear here automatically.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Visual Charts */}
          <div className="charts-grid">
            <div className="content-card chart-card">
              <h3 className="chart-title">Spending by Category</h3>
              <p className="chart-subtitle">{MONTH_NAMES[selectedMonth - 1]} {selectedYear}</p>
              {hasCategories ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={70}
                      outerRadius={110}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                    <Legend
                      formatter={(value) => (
                        <span style={{ color: 'var(--text-primary)', fontSize: '0.8rem' }}>
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state small">
                  <span className="empty-icon">🍩</span>
                  <p>No expenses recorded for this period.</p>
                  <Link to="/expenses" className="btn-primary" style={{ marginTop: '0.75rem' }}>
                    Add your first expense
                  </Link>
                </div>
              )}
            </div>

            <div className="content-card chart-card">
              <h3 className="chart-title">Monthly Totals</h3>
              <p className="chart-subtitle">Full year {selectedYear} breakdown</p>
              {hasMonthly ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={barData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(108,99,255,0.1)' }} />
                    <Bar dataKey="Total" fill="#6C63FF" radius={[6, 6, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state small">
                  <span className="empty-icon">📊</span>
                  <p>No monthly data available for {selectedYear}.</p>
                </div>
              )}
            </div>
          </div>

          {hasCategories && (
            <div className="content-card">
              <h3 className="chart-title">Category Breakdown</h3>
              <table className="expense-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Total Spent</th>
                    <th>Share</th>
                    <th>Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {pieData.map((row, i) => (
                    <tr key={row.name}>
                      <td>
                        <span
                          className="category-dot"
                          style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
                        />
                        {row.name}
                      </td>
                      <td>{fmt(row.value)}</td>
                      <td>
                        <div className="progress-bar-wrap">
                          <div
                            className="progress-bar-fill"
                            style={{
                              width: `${row.percent}%`,
                              background: CHART_COLORS[i % CHART_COLORS.length],
                            }}
                          />
                          <span>{row.percent}%</span>
                        </div>
                      </td>
                      <td>{summary.categoryBreakdown[i]?.count ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
