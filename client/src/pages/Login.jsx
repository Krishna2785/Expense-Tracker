// client/src/pages/Login.jsx
// User Login Page.

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedEmail = formData.email.trim();
    if (!trimmedEmail || !formData.password) {
      setError('Please provide both email and password.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address (e.g. name@example.com).');
      return;
    }

    try {
      setSubmitting(true);
      setError('');
      const result = await login(trimmedEmail, formData.password);
      if (result?.success) {
        navigate('/');
      } else {
        setError(result?.error || 'Login failed. Please check your credentials.');
      }
    } catch (err) {
      setError('An unexpected error occurred during login. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">💳</div>
          <h2>Welcome Back</h2>
          <p>Log in to access your Smart Expense Tracker</p>
        </div>

        {error && <div className="alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="name@example.com"
              value={formData.email}
              onChange={handleChange}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              name="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Logging in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account yet? <Link to="/register">Create an account</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
