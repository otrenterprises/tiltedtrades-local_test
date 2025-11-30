/**
 * useProfile Hook
 * React Query hooks for user profile and preferences
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { userService } from '@/services/api/user.service'
import { UpdateProfileRequest, UpdatePreferencesRequest } from '@/types/api/user.types'
import toast from 'react-hot-toast'

/**
 * Hook to fetch user profile
 */
export const useProfile = () => {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => userService.getProfile(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  })
}

/**
 * Hook to update user profile
 */
export const useUpdateProfile = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (updates: UpdateProfileRequest) => userService.updateProfile(updates),
    onSuccess: (data) => {
      queryClient.setQueryData(['profile'], data)
      toast.success('Profile updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update profile')
    }
  })
}

/**
 * Hook to fetch user preferences
 */
export const usePreferences = () => {
  return useQuery({
    queryKey: ['preferences'],
    queryFn: () => userService.getPreferences(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  })
}

/**
 * Hook to update user preferences
 */
export const useUpdatePreferences = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (updates: UpdatePreferencesRequest) => userService.updatePreferences(updates),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(['preferences'], data)

      // If calculation method changed, invalidate trade and stats queries
      if (variables.calculationMethod) {
        queryClient.invalidateQueries({ queryKey: ['trades'] })
        queryClient.invalidateQueries({ queryKey: ['stats'] })
      }

      toast.success('Preferences updated successfully')
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update preferences')
    }
  })
}

/**
 * Hook to fetch public profile
 */
export const usePublicProfile = (userId: string) => {
  return useQuery({
    queryKey: ['publicProfile', userId],
    queryFn: () => userService.getPublicProfile(userId),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime in v4)
  })
}

/**
 * Hook to fetch leaderboard
 */
export const useLeaderboard = (params?: {
  limit?: number
  sortBy?: 'totalPL' | 'winRate' | 'totalTrades' | 'profitFactor'
  offset?: number
}) => {
  return useQuery({
    queryKey: ['leaderboard', params],
    queryFn: () => userService.getLeaderboard(params),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}