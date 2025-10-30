import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import { BlockedUser, UsersResponse, Stats, SearchParams, AuthResponse, SuggestionsResponse, User } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Supabase client (frontend)
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY as string;
export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : (null as any);

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
    return Promise.reject(error);
  }
);

// Auth service
export const authService = {
  register: async (username: string, email: string, password: string): Promise<AuthResponse> => {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
    if (error) throw error;
    const session = data.session;
    if (!session) throw new Error('Registration requires email confirmation');
    localStorage.setItem('token', session.access_token);
    const user: User = { id: 0, username, email, role: 'admin' };
    localStorage.setItem('user', JSON.stringify(user));
    return { message: 'Registered', token: session.access_token, user };
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const session = data.session;
    if (!session) throw new Error('No session');
    localStorage.setItem('token', session.access_token);
    const profileUsername = (data.user?.user_metadata as any)?.username || (data.user?.email?.split('@')[0] ?? 'user');
    const user: User = { id: 0, username: profileUsername, email: data.user?.email || '', role: 'admin' };
    localStorage.setItem('user', JSON.stringify(user));
    return { message: 'Login successful', token: session.access_token, user };
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
    const response = await api.get('/users', { params });
    return response.data;
  },

  // Get user by ID
  getUser: async (id: number): Promise<BlockedUser> => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  // Add new user
  addUser: async (username: string, profile_url: string): Promise<BlockedUser> => {
    const response = await api.post('/users', { username, profile_url });
    return response.data;
  },

  // Update user
  updateUser: async (id: number, username: string, profile_url: string): Promise<BlockedUser> => {
    const response = await api.put(`/users/${id}`, { username, profile_url });
    return response.data;
  },

  // Delete user
  deleteUser: async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`);
  },

  // Get statistics
  getStats: async (): Promise<Stats> => {
    const response = await api.get('/stats');
    return response.data;
  },

  // Import users from JSON file
  importUsers: async (file: File): Promise<{ imported: number; errors: number; total: number }> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await api.post('/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    return response.data;
  },
};

export default api;
