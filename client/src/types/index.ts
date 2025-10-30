export interface BlockedUser {
  id: number;
  username: string;
  profile_url: string;
  created_at: string;
  updated_at: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface UsersResponse {
  users: BlockedUser[];
  pagination: Pagination;
}

export interface Stats {
  totalUsers: number;
  lastUpdated: string;
}

export interface SearchParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: 'username' | 'created_at' | 'updated_at';
  order?: 'ASC' | 'DESC';
  dateRange?: 'all' | 'today' | '7d' | '30d';
}

export interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface UserSuggestion {
  id: number;
  username: string;
  profile_url: string;
  reason: string;
  suggested_by: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
}

export interface SuggestionsResponse {
  suggestions: UserSuggestion[];
  pagination: Pagination;
}
