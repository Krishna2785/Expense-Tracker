// client/src/components/Navbar.jsx
// Clean, mobile-responsive navigation bar with active route indicators, user badge, and logout.

import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    setMobileMenuOpen(false);
    logout();
    navigate('/login');
  };

  const closeMenu = () => {
    setMobileMenuOpen(false);
  };

  // Extract initials for avatar
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <header className="navbar">
      <div className="navbar-container">
        {/* Brand */}
        <NavLink to="/" className="navbar-brand" onClick={closeMenu}>
          <span className="brand-icon">💳</span>
          <span className="brand-title">Smart Expense Tracker</span>
        </NavLink>

        {/* Mobile Hamburger Toggle Button */}
        <button
          className={`mobile-menu-btn ${mobileMenuOpen ? 'open' : ''}`}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={mobileMenuOpen}
        >
          <span className="hamburger-bar"></span>
          <span className="hamburger-bar"></span>
          <span className="hamburger-bar"></span>
        </button>

        {/* Navigation Links and User Controls */}
        <div className={`navbar-collapse ${mobileMenuOpen ? 'show' : ''}`}>
          <nav className="navbar-links">
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              onClick={closeMenu}
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/expenses"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              onClick={closeMenu}
            >
              Expenses
            </NavLink>
            <NavLink
              to="/budgets"
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              onClick={closeMenu}
            >
              Budgets
            </NavLink>
          </nav>

          <div className="navbar-user">
            <div className="user-profile-badge">
              <span className="user-avatar">{initials}</span>
              <span className="user-greeting">
                Hello, <strong>{user?.name || 'User'}</strong>
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="btn-logout"
              title="Sign out of your account"
            >
              <span className="logout-icon">🚪</span>
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
