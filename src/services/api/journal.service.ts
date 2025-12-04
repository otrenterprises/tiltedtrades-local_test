/**
 * Journal Service - AWS API Gateway Implementation
 *
 * Handles trade journal CRUD operations via API Gateway.
 * Chart uploads use presigned S3 URLs via the upload service.
 */

import { apiClient } from './client'
import { uploadService } from './upload.service'
import {
  TradeJournal,
  CreateJournalRequest,
  UpdateJournalRequest,
  JournalQueryParams,
  ChartReference,
  CommissionOverride,
} from '@/types/api/journal.types'

// API Endpoints - :userId is replaced by the API client interceptor
const ENDPOINTS = {
  journals: '/api/users/:userId/journals',
  journal: (tradeId: string) => `/api/users/:userId/trades/${tradeId}/journal`,
  charts: (tradeId: string) => `/api/users/:userId/trades/${tradeId}/journal/charts`,
  chart: (tradeId: string, chartId: string) => `/api/users/:userId/trades/${tradeId}/journal/charts/${chartId}`,
}

export const journalService = {
  /**
   * Get all journals for the user
   */
  async getJournals(
    userId: string,
    params?: JournalQueryParams
  ): Promise<TradeJournal[]> {
    console.log('📡 API: getJournals called', params)

    try {
      const queryParams: Record<string, string> = {}
      if (params?.tags) queryParams.tags = params.tags.join(',')
      if (params?.symbol) queryParams.symbol = params.symbol
      if (params?.calculationMethod) queryParams.calculationMethod = params.calculationMethod
      if (params?.startDate) queryParams.startDate = params.startDate
      if (params?.endDate) queryParams.endDate = params.endDate
      if (params?.limit) queryParams.limit = String(params.limit)
      if (params?.nextToken) queryParams.nextToken = params.nextToken

      const response = await apiClient.get<TradeJournal[] | { journals: TradeJournal[] }>(
        ENDPOINTS.journals,
        Object.keys(queryParams).length > 0 ? queryParams : undefined
      )

      // Handle both array and wrapped response
      if (Array.isArray(response)) {
        return response
      }
      return response.journals || []
    } catch (error) {
      console.error('❌ Error fetching journals:', error)
      return []
    }
  },

  /**
   * Get journal for a specific trade
   * @param calculationMethod - 'fifo' or 'perPosition' to get the correct journal
   */
  async getJournal(userId: string, tradeId: string, calculationMethod?: 'fifo' | 'perPosition'): Promise<TradeJournal | null> {
    console.log('📡 API: getJournal called', { tradeId, calculationMethod })

    try {
      const queryParams: Record<string, string> = {}
      if (calculationMethod) {
        queryParams.method = calculationMethod
      }
      const response = await apiClient.get<TradeJournal>(
        ENDPOINTS.journal(tradeId),
        Object.keys(queryParams).length > 0 ? queryParams : undefined
      )
      return response
    } catch (error: any) {
      // 404 is expected when no journal exists - return null without logging error
      if (error?.status === 404 || error?.code === 'NOT_FOUND' || error?.message?.toLowerCase().includes('not found')) {
        return null
      }
      console.error('❌ Error fetching journal:', error)
      return null
    }
  },

  /**
   * Create or update a journal entry
   */
  async saveJournal(
    userId: string,
    tradeId: string,
    data: CreateJournalRequest | UpdateJournalRequest
  ): Promise<TradeJournal> {
    console.log('📡 API: saveJournal called', { tradeId, data })

    try {
      // POST creates or updates (upsert)
      const response = await apiClient.post<TradeJournal>(ENDPOINTS.journal(tradeId), data)
      return response
    } catch (error) {
      console.error('❌ Error saving journal:', error)
      throw error
    }
  },

  /**
   * Delete a journal entry
   * @param calculationMethod - 'fifo' or 'perPosition' to delete the correct journal
   */
  async deleteJournal(userId: string, tradeId: string, calculationMethod?: 'fifo' | 'perPosition'): Promise<void> {
    console.log('📡 API: deleteJournal called', { tradeId, calculationMethod })

    try {
      let url = ENDPOINTS.journal(tradeId)
      if (calculationMethod) {
        url += `?method=${calculationMethod}`
      }
      await apiClient.delete(url)
    } catch (error) {
      console.error('❌ Error deleting journal:', error)
      throw error
    }
  },

  /**
   * Upload a chart image for a journal
   */
  async uploadChart(
    userId: string,
    tradeId: string,
    file: File,
    caption?: string
  ): Promise<ChartReference> {
    console.log('📡 API: uploadChart called', { tradeId, fileName: file.name })

    try {
      // Use the upload service to get presigned URL and upload
      const s3Key = await uploadService.uploadChart(tradeId, file, caption)

      // Return chart reference
      return {
        chartId: s3Key.split('/').pop() || s3Key,
        chartType: 'uploaded',
        s3Key,
        caption,
        uploadedAt: new Date().toISOString(),
      }
    } catch (error) {
      console.error('❌ Error uploading chart:', error)
      throw error
    }
  },

  /**
   * Delete a chart from a journal
   * @param calculationMethod - 'fifo' or 'perPosition' to identify the correct journal
   */
  async deleteChart(userId: string, tradeId: string, chartId: string, calculationMethod?: 'fifo' | 'perPosition'): Promise<void> {
    console.log('📡 API: deleteChart called', { tradeId, chartId, calculationMethod })

    try {
      let url = ENDPOINTS.chart(tradeId, chartId)
      if (calculationMethod) {
        url += `?method=${calculationMethod}`
      }
      await apiClient.delete(url)
    } catch (error) {
      console.error('❌ Error deleting chart:', error)
      throw error
    }
  },

  /**
   * Search journals by tag
   */
  async searchByTag(userId: string, tag: string): Promise<TradeJournal[]> {
    return this.getJournals(userId, { tags: [tag] })
  },

  /**
   * Get journals by date range
   */
  async getJournalsByDateRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<TradeJournal[]> {
    return this.getJournals(userId, { startDate, endDate })
  },

  /**
   * Get all unique tags used in journals
   */
  async getAllTags(userId: string): Promise<string[]> {
    console.log('📡 API: getAllTags called')

    try {
      // Fetch all journals and extract unique tags
      const journals = await this.getJournals(userId)
      const tagSet = new Set<string>()
      journals.forEach(journal => {
        journal.tags?.forEach(tag => tagSet.add(tag))
      })
      return Array.from(tagSet).sort()
    } catch (error) {
      console.error('❌ Error fetching tags:', error)
      return []
    }
  },

  /**
   * Check if a journal exists for a trade
   * @param calculationMethod - 'fifo' or 'perPosition' to check the correct journal
   */
  async hasJournal(tradeId: string, calculationMethod?: 'fifo' | 'perPosition'): Promise<boolean> {
    try {
      const journal = await this.getJournal('', tradeId, calculationMethod)
      return journal !== null
    } catch {
      return false
    }
  },

  /**
   * Get journals for multiple trades (batch operation)
   * @deprecated Use trade.hasJournal from the trades API instead for better performance
   */
  async getJournalsForTrades(tradeIds: string[]): Promise<Map<string, TradeJournal>> {
    const result = new Map<string, TradeJournal>()

    // Fetch all journals (Lambda now paginates through all results)
    const journals = await this.getJournals('')

    journals.forEach(journal => {
      if (tradeIds.includes(journal.tradeId)) {
        result.set(journal.tradeId, journal)
      }
    })

    return result
  },

  // Legacy method aliases for backwards compatibility with hooks
  async createJournal(
    userId: string,
    tradeId: string,
    data: {
      notes: string
      tags?: string[]
      calculationMethod?: 'FIFO' | 'Per Position'
      executionIds?: string[]
    }
  ): Promise<TradeJournal> {
    return this.saveJournal(userId, tradeId, {
      journalText: data.notes,
      tags: data.tags,
    })
  },

  async updateJournal(
    userId: string,
    tradeId: string,
    data: { notes?: string; tags?: string[] }
  ): Promise<TradeJournal> {
    return this.saveJournal(userId, tradeId, {
      journalText: data.notes || '',
      tags: data.tags,
    })
  },

  // Alias for direct chart upload (no presigned URL step)
  async uploadChartDirect(
    userId: string,
    tradeId: string,
    file: File,
    description?: string
  ): Promise<ChartReference> {
    return this.uploadChart(userId, tradeId, file, description)
  },

  /**
   * Save a commission override for a trade via the journal entry
   * This creates/updates a journal with the commission override info
   * and triggers a stats recalculation on the backend
   * @param modifiedDate - Optional ISO date string to use as lastModified (e.g., trade exit date)
   */
  async saveCommissionOverride(
    userId: string,
    tradeId: string,
    overrideCommission: number,
    reason?: string,
    existingJournalText?: string,
    calculationMethod?: 'fifo' | 'perPosition',
    modifiedDate?: string
  ): Promise<TradeJournal> {
    console.log('📡 API: saveCommissionOverride called', { tradeId, overrideCommission, reason, calculationMethod, modifiedDate })

    const data: CreateJournalRequest = {
      journalText: existingJournalText || reason || `Commission adjusted to ${overrideCommission}`,
      commissionOverride: {
        overrideCommission,
        reason,
        lastModified: modifiedDate || new Date().toISOString(),
      },
      calculationMethod,
    }

    return this.saveJournal(userId, tradeId, data)
  },

  /**
   * Check if a trade has a commission override
   * @param calculationMethod - 'fifo' or 'perPosition' to get the correct override
   */
  async getCommissionOverride(
    userId: string,
    tradeId: string,
    calculationMethod?: 'fifo' | 'perPosition'
  ): Promise<CommissionOverride | null> {
    const journal = await this.getJournal(userId, tradeId, calculationMethod)
    return journal?.commissionOverride || null
  },
}
