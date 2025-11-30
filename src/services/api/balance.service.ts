/**
 * Balance Service - AWS API Gateway Implementation
 *
 * Fetches and manages balance entries and recurring fee templates from AWS API Gateway.
 * Server handles recurring fee generation and running balance calculation.
 */

import { apiClient } from './client'
import {
  ApiBalanceEntry,
  ApiRecurringTemplate,
  BalanceResponse,
  TemplatesResponse,
  CreateBalanceEntryRequest,
  UpdateBalanceEntryRequest,
  CreateTemplateRequest,
  UpdateTemplateRequest,
} from '@/types/api/balance.types'

// API Endpoints - :userId is replaced by the API client interceptor
const ENDPOINTS = {
  balance: '/api/users/:userId/balance',
  templates: '/api/users/:userId/balance/templates',
}

export const balanceService = {
  /**
   * Fetch all balance entries including auto-generated recurring fees
   * Also returns templates and running balance
   */
  async getBalance(): Promise<BalanceResponse> {
    console.log('📡 API: getBalance called')
    const response = await apiClient.get<BalanceResponse>(ENDPOINTS.balance)
    return response
  },

  /**
   * Create a new balance entry
   */
  async createEntry(data: CreateBalanceEntryRequest): Promise<ApiBalanceEntry> {
    console.log('📡 API: createEntry called', data)
    const response = await apiClient.post<ApiBalanceEntry>(ENDPOINTS.balance, data)
    return response
  },

  /**
   * Update an existing balance entry
   */
  async updateEntry(entryId: string, data: UpdateBalanceEntryRequest): Promise<ApiBalanceEntry> {
    console.log('📡 API: updateEntry called', { entryId, data })
    const url = `${ENDPOINTS.balance}/${encodeURIComponent(entryId)}`
    const response = await apiClient.put<ApiBalanceEntry>(url, data)
    return response
  },

  /**
   * Delete a balance entry
   */
  async deleteEntry(entryId: string): Promise<void> {
    console.log('📡 API: deleteEntry called', { entryId })
    const url = `${ENDPOINTS.balance}/${encodeURIComponent(entryId)}`
    await apiClient.delete(url)
  },

  /**
   * Fetch all recurring fee templates
   */
  async getTemplates(): Promise<ApiRecurringTemplate[]> {
    console.log('📡 API: getTemplates called')
    const response = await apiClient.get<TemplatesResponse>(ENDPOINTS.templates)
    return response.templates || []
  },

  /**
   * Create a new recurring fee template
   */
  async createTemplate(data: CreateTemplateRequest): Promise<ApiRecurringTemplate> {
    console.log('📡 API: createTemplate called', data)
    const response = await apiClient.post<ApiRecurringTemplate>(ENDPOINTS.templates, data)
    return response
  },

  /**
   * Update an existing recurring fee template
   */
  async updateTemplate(templateId: string, data: UpdateTemplateRequest): Promise<ApiRecurringTemplate> {
    console.log('📡 API: updateTemplate called', { templateId, data })
    const url = `${ENDPOINTS.templates}/${encodeURIComponent(templateId)}`
    const response = await apiClient.put<ApiRecurringTemplate>(url, data)
    return response
  },

  /**
   * Delete a recurring fee template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    console.log('📡 API: deleteTemplate called', { templateId })
    const url = `${ENDPOINTS.templates}/${encodeURIComponent(templateId)}`
    await apiClient.delete(url)
  },

  /**
   * Get current running balance
   */
  async getCurrentBalance(): Promise<number> {
    const response = await this.getBalance()
    return response.runningBalance
  },

  /**
   * Get balance at a specific date
   */
  async getBalanceAtDate(date: string): Promise<number> {
    const response = await this.getBalance()
    let balance = 0
    for (const entry of response.entries) {
      if (entry.date <= date) {
        balance = entry.balance || balance
      } else {
        break
      }
    }
    return balance
  },

  /**
   * Get balance history for charting
   */
  async getBalanceHistory(): Promise<Array<{ date: string; balance: number }>> {
    const response = await this.getBalance()
    return response.entries.map(entry => ({
      date: entry.date,
      balance: entry.balance || 0
    }))
  },
}
