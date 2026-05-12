import apiClient from './client';
import { ApiResponse, UserListResponse, AdminStats, ConfigListResponse, SystemConfig } from '../types';

export const getUsers = async (params: { page?: number; limit?: number }): Promise<ApiResponse<UserListResponse>> => {
  const response = await apiClient.get('/admin/users', { params });
  return response.data;
};

export const updateUserStatus = async (userId: string, isActive: boolean): Promise<ApiResponse<{ user: import('../types').User }>> => {
  const response = await apiClient.put(`/admin/users/${userId}/status`, { is_active: isActive });
  return response.data;
};

export const getStats = async (): Promise<ApiResponse<AdminStats>> => {
  const response = await apiClient.get('/admin/stats');
  return response.data;
};

export const getConfigs = async (): Promise<ApiResponse<ConfigListResponse>> => {
  const response = await apiClient.get('/admin/config');
  return response.data;
};

export const updateConfig = async (key: string, value: string): Promise<ApiResponse<{ config: SystemConfig }>> => {
  const response = await apiClient.put('/admin/config', { key, value });
  return response.data;
};