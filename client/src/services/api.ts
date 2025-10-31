import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { BlockedUser, UsersResponse, Stats, SearchParams, AuthResponse, SuggestionsResponse, User } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // Increased to 60 seconds for slow database queries
});

// Supabase client (frontend)
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY as string;
export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : (null as any);

// Retry logic helper
async function retryRequest(requestFn: () => Promise<any>, retries = 3, delay = 1000): Promise<any> {
  try {
    return await requestFn();
  } catch (error: any) {
    if (retries > 0 && (error.code === 'ECONNABORTED' || error.message?.includes('timeout'))) {
      console.log(`Request timeout, retrying... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryRequest(requestFn, retries - 1, delay * 2); // Exponential backoff
    }
    throw error;
  }
}

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`Making ${config.method?.toUpperCase()} request to ${config.url}`);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    // Add more detailed error information
    if (error.code === 'ECONNABORTED') {
      console.error('Request timeout - the server is taking too long to respond');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('Connection refused - is the server running?');
    } else if (!error.response) {
      console.error('Network error - no response from server');
    }
    return Promise.reject(error);
  }
);

// Auth service
export const authService = {
  register: async (username: string, email: string, password: string): Promise<AuthResponse> => {
    // Koristi backend API umesto Supabase
    const response = await api.post('/auth/register', { username, email, password });
    return response.data;
  },

  login: async (username: string, password: string): Promise<AuthResponse> => {
    // Koristi backend API umesto Supabase
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },

  getCurrentUser: (): User | null => {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as User) : null;
  },

  logout: async () => {
    if (supabase) await supabase.auth.signOut();
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  isAuthenticated: (): boolean => {
    const token = localStorage.getItem('token');
    return !!token;
  }
};

// Suggestion service
export const suggestionService = {
  // Submit multiple suggestions (auth required)
  submitSuggestions: async (items: { username: string; profile_url: string }[], captchaToken?: string): Promise<{ inserted: number; errors: number; total: number }> => {
    const response = await api.post('/suggestions', { suggestions: items, captchaToken }, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    return response.data;
  },

  // Get suggestions (admin only)
  getSuggestions: async (status: string = 'pending', page: number = 1, limit: number = 20): Promise<SuggestionsResponse> => {
    const response = await api.get('/admin/suggestions', { 
      params: { status, page, limit },
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    return response.data;
  },

  // Approve suggestion (admin only)
  approveSuggestion: async (id: number): Promise<{ message: string; addedToBlocked: boolean }> => {
    const response = await api.put(`/admin/suggestions/${id}/approve`, {}, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    return response.data;
  },

  // Reject suggestion (admin only)
  rejectSuggestion: async (id: number): Promise<{ message: string }> => {
    const response = await api.put(`/admin/suggestions/${id}/reject`, {}, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    return response.data;
  }
};

export const userService = {
  // Get users with search and pagination
  getUsers: async (params: SearchParams = {}): Promise<UsersResponse> => {
    return retryRequest(() => api.get('/users', { params }).then(res => res.data));
  },

  // Get user by ID
  getUser: async (id: number): Promise<BlockedUser> => {
    return retryRequest(() => api.get(`/users/${id}`).then(res => res.data));
  },

  // Add new user
  addUser: async (username: string, profile_url: string): Promise<BlockedUser> => {
    const response = await api.post('/users', { username, profile_url }, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    return response.data;
  },

  // Update user
  updateUser: async (id: number, username: string, profile_url: string): Promise<BlockedUser> => {
    const response = await api.put(`/users/${id}`, { username, profile_url }, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    return response.data;
  },

  // Delete user
  deleteUser: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
  },

  // Get statistics
  getStats: async (): Promise<Stats> => {
    return retryRequest(() => api.get('/stats').then(res => res.data));
  },

  // Import users from JSON file
  importUsers: async (file: File): Promise<{ imported: number; errors: number; total: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
    });
    
    return response.data;
  },
};

// Admin service
export const adminService = {
  // Get audit logs
  getAuditLogs: async (page: number = 1, limit: number = 20): Promise<{ logs: any[]; pagination: any }> => {
    const response = await api.get('/admin/audit', {
      params: { page, limit },
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
    });
    return response.data;
  },
};

export default api;
