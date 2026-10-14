// client/src/context/AuthContext.jsx
// React Context providing global user authentication state across the application.

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [loading, setLoading] = useState(true);

  // When the app first loads, verify if the stored token is still valid with the backend
  useEffect(() => {
    const checkAuthStatus = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          // Verify with backend /api/auth/profile
          const res = await api.get('/auth/profile');
          if (res.data.success) {
            setUser(res.data.user);
            localStorage.setItem('user', JSON.stringify(res.data.user));
          }
        } catch (error) {
          console.error('[AuthContext] Session expired or invalid token:', error.message);
          logout();
        }
      }
      setLoading(false);
    };

    checkAuthStatus();
  }, []);

  /**
   * Logs in an existing user with email and password.
   */
  const login = async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.success) {
        const { user: userData, token: jwtToken } = res.data;
        setUser(userData);
        setToken(jwtToken);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', jwtToken);
        return { success: true };
      }
    } catch (error) {
      const message =
        error.response?.data?.message || 'Login failed. Please check your credentials.';
      return { success: false, error: message };
    }
  };

  /**
   * Registers a new user account.
   */
  const register = async (name, email, password) => {
    try {
      const res = await api.post('/auth/register', { name, email, password });
      if (res.data.success) {
        const { user: userData, token: jwtToken } = res.data;
        setUser(userData);
        setToken(jwtToken);
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', jwtToken);
        return { success: true };
      }
    } catch (error) {
      const message =
        error.response?.data?.message || 'Registration failed. Please try again.';
      return { success: false, error: message };
    }
  };

  /**
   * Logs out the user and clears stored credentials.
   */
  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!user && !!token,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to consume the AuthContext easily in components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
