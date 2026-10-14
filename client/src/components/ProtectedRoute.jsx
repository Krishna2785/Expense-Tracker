// client/src/components/ProtectedRoute.jsx
// Route wrapper that guards private pages, redirecting unauthenticated users to /login.

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  // Show a clean loading indicator while checking authentication status
  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Verifying authentication...</p>
      </div>
    );
  }

  // If the user is not authenticated, redirect them to the Login page
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If authenticated, render the child route/component
  return children ? children : <Outlet />;
};

export default ProtectedRoute;
