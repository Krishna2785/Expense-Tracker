// client/src/App.jsx
// Main application router and context wrapper.

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

// Page components
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Budgets from './pages/Budgets';

/**
 * Layout wrapper that renders the Navbar above protected content
 */
const AppLayout = ({ children }) => {
  return (
    <div className="app-layout">
      <Navbar />
      <main className="main-content">{children}</main>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Authentication Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected Routes (Require valid JWT) */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/expenses"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Expenses />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/budgets"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Budgets />
                </AppLayout>
              </ProtectedRoute>
            }
          />

          {/* Catch-all route: Redirect unknown paths to / */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
