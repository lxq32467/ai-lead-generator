export interface User {
  id: string;
  email: string;
  name: string;
  role: 'salesperson' | 'admin';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  user_id: string;
  company_name: string;
  industry: string;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  source: string;
  status: 'new' | 'interested' | 'contacted' | 'invalid';
  ai_suggestion?: string;
  created_at: string;
  updated_at: string;
}

export interface SearchHistory {
  id: string;
  user_id: string;
  keyword: string;
  result_count: number;
  created_at: string;
}

export interface SystemConfig {
  id: string;
  key: string;
  value: string;
  updated_by: string;
  updated_at: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface LeadSearchResponse {
  leads: Lead[];
  search_history: SearchHistory;
}

export interface LeadListResponse {
  leads: Lead[];
  pagination: Pagination;
}

export interface UserListResponse {
  users: User[];
  pagination: Pagination;
}

export interface AdminStats {
  total_searches: number;
  total_leads: number;
  active_users: number;
}

export interface ConfigListResponse {
  configs: SystemConfig[];
}