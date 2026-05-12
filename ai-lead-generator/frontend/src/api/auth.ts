import apiClient from './client';
import { ApiResponse, AuthResponse } from '../types';

export const register = async (email: string, password: string, name: string): Promise<ApiResponse<AuthResponse>> => {
  const response = await apiClient.post('/auth/register', { email, password, name });
  return response.data;
};

export const login = async (email: string, password: string): Promise<ApiResponse<AuthResponse>> => {
  const response = await apiClient.post('/auth/login', { email, password });
  return response.data;
};

export const getMe = async (): Promise<ApiResponse<{ user: import('../types').User }>> => {
  const response = await apiClient.get('/auth/me');
  return response.data;
};