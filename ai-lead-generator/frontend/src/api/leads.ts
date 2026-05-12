import apiClient from './client';
import { ApiResponse, LeadSearchResponse, LeadListResponse, Lead } from '../types';

export const searchLeads = async (keyword: string, limit: number = 20): Promise<ApiResponse<LeadSearchResponse>> => {
  const response = await apiClient.post('/leads/search', { keyword, limit });
  return response.data;
};

export const getLeads = async (params: { page?: number; limit?: number; status?: string; industry?: string }): Promise<ApiResponse<LeadListResponse>> => {
  const response = await apiClient.get('/leads', { params });
  return response.data;
};

export const getLead = async (leadId: string): Promise<ApiResponse<{ lead: Lead }>> => {
  const response = await apiClient.get(`/leads/${leadId}`);
  return response.data;
};

export const updateLead = async (leadId: string, data: Partial<Lead>): Promise<ApiResponse<{ lead: Lead }>> => {
  const response = await apiClient.put(`/leads/${leadId}`, data);
  return response.data;
};

export const generateSuggestion = async (leadId: string): Promise<ApiResponse<{ lead: Lead }>> => {
  const response = await apiClient.post(`/leads/${leadId}/suggestion`);
  return response.data;
};

export const batchUpdateStatus = async (leadIds: string[], status: string): Promise<ApiResponse<{ updated_count: number }>> => {
  const response = await apiClient.post('/leads/batch-status', { lead_ids: leadIds, status });
  return response.data;
};

export const exportLeads = async (params: { status?: string; industry?: string }): Promise<Blob> => {
  const response = await apiClient.get('/leads/export', { params, responseType: 'blob' });
  return response.data;
};