/**
 * useSettings Hook
 * Manages user settings and preferences with React Query
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userService } from '@/services/api/user.service'
import { UpdateProfileRequest, UpdatePreferencesRequest } from '@/types/api/user.types'
import { useAuth } from '@/contexts/AuthContext'
import toast from 'react-hot-toast'

// Query keys
const QUERY_KEYS = {
  profile: (userId: string) => ['user', userId, 'profile'] as const,
  preferences: (userId: string) => ['user', userId, 'preferences'] as const,
}

/**
 * Hook for fetching and updating user profile
 */
export function useUserProfile() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.username || ''

  const profileQuery = useQuery({
    queryKey: QUERY_KEYS.profile(userId),
    queryFn: () => userService.getProfile(),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const updateProfileMutation = useMutation({
    mutationFn: (updates: UpdateProfileRequest) => userService.updateProfile(updates),
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.profile(userId), data)
      toast.success('Profile updated successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to update profile: ${error.message}`)
    },
  })

  return {
    profile: profileQuery.data,
    isLoading: profileQuery.isLoading,
    error: profileQuery.error,
    updateProfile: updateProfileMutation.mutate,
    isUpdating: updateProfileMutation.isPending,
  }
}

/**
 * Hook for fetching and updating user preferences
 */
export function useUserPreferences() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const userId = user?.username || ''

  const preferencesQuery = useQuery({
    queryKey: QUERY_KEYS.preferences(userId),
    queryFn: () => userService.getPreferences(),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const updatePreferencesMutation = useMutation({
    mutationFn: (updates: UpdatePreferencesRequest) => userService.updatePreferences(updates),
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.preferences(userId), data)

      // Apply theme immediately if it was changed
      if (data.displayPreferences?.theme) {
        applyTheme(data.displayPreferences.theme)
      }

      toast.success('Preferences updated successfully')
    },
    onError: (error: Error) => {
      toast.error(`Failed to update preferences: ${error.message}`)
    },
  })

  return {
    preferences: preferencesQuery.data,
    isLoading: preferencesQuery.isLoading,
    error: preferencesQuery.error,
    updatePreferences: updatePreferencesMutation.mutate,
    isUpdating: updatePreferencesMutation.isPending,
  }
}

/**
 * Combined hook for both profile and preferences
 */
export function useSettings() {
  const profile = useUserProfile()
  const preferences = useUserPreferences()

  return {
    profile: profile.profile,
    preferences: preferences.preferences,
    isLoading: profile.isLoading || preferences.isLoading,
    error: profile.error || preferences.error,
    updateProfile: profile.updateProfile,
    updatePreferences: preferences.updatePreferences,
    isUpdating: profile.isUpdating || preferences.isUpdating,
  }
}

/**
 * Apply theme to document
 */
function applyTheme(theme: 'light' | 'dark' | 'auto') {
  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', prefersDark)
  } else {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }
}

// Helper function to get available timezones
export function getTimezones() {
  return [
    { value: 'UTC', label: 'UTC' },
    { value: 'America/New_York', label: 'Eastern Time (New York)' },
    { value: 'America/Chicago', label: 'Central Time (Chicago)' },
    { value: 'America/Denver', label: 'Mountain Time (Denver)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
    { value: 'Europe/London', label: 'London' },
    { value: 'Europe/Paris', label: 'Paris' },
    { value: 'Europe/Berlin', label: 'Berlin' },
    { value: 'Asia/Tokyo', label: 'Tokyo' },
    { value: 'Asia/Shanghai', label: 'Shanghai' },
    { value: 'Asia/Singapore', label: 'Singapore' },
    { value: 'Australia/Sydney', label: 'Sydney' },
  ]
}

// Helper function to get available date formats
export function getDateFormats() {
  return [
    { value: 'MM/DD/YYYY', label: '03/15/2024', example: '03/15/2024' },
    { value: 'DD/MM/YYYY', label: '15/03/2024', example: '15/03/2024' },
    { value: 'YYYY-MM-DD', label: '2024-03-15', example: '2024-03-15' },
    { value: 'MMM DD, YYYY', label: 'Mar 15, 2024', example: 'Mar 15, 2024' },
    { value: 'DD MMM YYYY', label: '15 Mar 2024', example: '15 Mar 2024' },
  ]
}

// Helper function to get available currencies
export function getCurrencies() {
  return [
    { value: 'USD', label: 'US Dollar ($)', symbol: '$' },
    { value: 'EUR', label: 'Euro (€)', symbol: '€' },
    { value: 'GBP', label: 'British Pound (£)', symbol: '£' },
    { value: 'JPY', label: 'Japanese Yen (¥)', symbol: '¥' },
    { value: 'CAD', label: 'Canadian Dollar (C$)', symbol: 'C$' },
    { value: 'AUD', label: 'Australian Dollar (A$)', symbol: 'A$' },
    { value: 'CHF', label: 'Swiss Franc (CHF)', symbol: 'CHF' },
  ]
}

export default useSettings