// client/src/services/api.js
// Central Axios instance with automated JWT authentication headers.

import axios from 'axios';

// Create an Axios client configured with the backend API base URL
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Automatically attach the JWT token to every outgoing request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Catch global response errors (such as 401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If the server responded with 401 Unauthorized (token expired or invalid)
    if (error.response && error.response.status === 401) {
      // Clear expired credentials from storage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export default api;
