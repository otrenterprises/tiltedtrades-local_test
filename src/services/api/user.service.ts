/**
 * User Service - AWS API Gateway Implementation
 *
 * Handles user profile and preferences API calls.
 */

import { apiClient } from './client'
import {
  UserProfile,
  UserPreferences,
  UpdateProfileRequest,
  UpdatePreferencesRequest,
  PublicProfile,
  LeaderboardEntry,
} from '@/types/api/user.types'

// API Endpoints - :userId is replaced by the API client interceptor
const ENDPOINTS = {
  profile: '/api/users/:userId/profile',
  preferences: '/api/users/:userId/preferences',
  publicProfiles: '/api/public/profiles',
}

export const userService = {
  /**
   * Get current user's profile
   */
  async getProfile(): Promise<UserProfile | null> {
    console.log('📡 API: getProfile called')

    try {
      const response = await apiClient.get<UserProfile>(ENDPOINTS.profile)
      return response
    } catch (error) {
      console.error('❌ Error fetching profile:', error)
      return null
    }
  },

  /**
   * Update current user's profile
   */
  async updateProfile(data: UpdateProfileRequest): Promise<UserProfile | null> {
    console.log('📡 API: updateProfile called', data)

    try {
      const response = await apiClient.put<UserProfile>(ENDPOINTS.profile, data)
      return response
    } catch (error) {
      console.error('❌ Error updating profile:', error)
      throw error
    }
  },

  /**
   * Get current user's preferences
   */
  async getPreferences(): Promise<UserPreferences | null> {
    console.log('📡 API: getPreferences called')

    try {
      const response = await apiClient.get<UserPreferences>(ENDPOINTS.preferences)
      return response
    } catch (error) {
      console.error('❌ Error fetching preferences:', error)
      return null
    }
  },

  /**
   * Update current user's preferences
   */
  async updatePreferences(data: UpdatePreferencesRequest): Promise<UserPreferences | null> {
    console.log('📡 API: updatePreferences called', data)

    try {
      const response = await apiClient.put<UserPreferences>(ENDPOINTS.preferences, data)
      return response
    } catch (error) {
      console.error('❌ Error updating preferences:', error)
      throw error
    }
  },

  /**
   * Get a public user profile by ID
   */
  async getPublicProfile(userId: string): Promise<PublicProfile | null> {
    console.log('📡 API: getPublicProfile called for', userId)

    try {
      const response = await apiClient.get<PublicProfile>(`${ENDPOINTS.publicProfiles}/${userId}`)
      return response
    } catch (error) {
      console.error('❌ Error fetching public profile:', error)
      return null
    }
  },

  /**
   * Get public leaderboard (no auth required)
   */
  async getLeaderboard(params?: {
    limit?: number
    sortBy?: 'totalPL' | 'winRate' | 'totalTrades' | 'profitFactor'
    offset?: number
  }): Promise<LeaderboardEntry[]> {
    console.log('📡 API: getLeaderboard called', params)

    try {
      const queryParams: Record<string, string> = {}
      if (params?.limit) queryParams.limit = String(params.limit)
      if (params?.sortBy) queryParams.sortBy = params.sortBy
      if (params?.offset) queryParams.offset = String(params.offset)

      const response = await apiClient.get<LeaderboardEntry[] | { profiles: LeaderboardEntry[] }>(
        ENDPOINTS.publicProfiles,
        Object.keys(queryParams).length > 0 ? queryParams : undefined
      )

      // Handle both array and wrapped response
      if (Array.isArray(response)) {
        return response
      }
      return response.profiles || []
    } catch (error) {
      console.error('❌ Error fetching leaderboard:', error)
      return []
    }
  },

  // Legacy method aliases for backwards compatibility
  async getSettings(): Promise<UserPreferences | null> {
    return this.getPreferences()
  },

  async updateSettings(data: UpdatePreferencesRequest): Promise<UserPreferences | null> {
    return this.updatePreferences(data)
  },
}
