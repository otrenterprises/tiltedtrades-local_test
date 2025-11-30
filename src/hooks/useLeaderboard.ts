/**
 * useLeaderboard Hook
 * Fetches public leaderboard data
 */

import { useQuery } from '@tanstack/react-query'
import { userService } from '../services/api/user.service'

interface LeaderboardParams {
  sortBy?: 'totalPL' | 'winRate' | 'profitFactor' | 'totalTrades' | 'sharpeRatio'
  timeframe?: 'all' | 'month' | 'quarter' | 'year'
  limit?: number
}

interface LeaderboardEntry {
  userId: string
  username: string
  bio?: string
  avatarUrl?: string
  isVerified?: boolean
  totalPL: number
  winRate: number
  profitFactor?: number
  totalTrades: number
  sharpeRatio?: number
  rank?: number
}

/**
 * Hook to fetch leaderboard data
 */
export function useLeaderboard(params: LeaderboardParams = {}) {
  return useQuery({
    queryKey: ['leaderboard', params],
    queryFn: async () => {
      // Fetch leaderboard from public endpoint
      const response = await userService.getLeaderboard()

      // Process and sort the data based on params
      let processed: LeaderboardEntry[] = response.map((user: any, index: number) => ({
        userId: user.userId,
        username: user.username || `Trader${user.userId.slice(-4)}`,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        isVerified: user.isVerified || false,
        totalPL: user.stats?.totalPL || 0,
        winRate: user.stats?.winRate || 0,
        profitFactor: user.stats?.profitFactor,
        totalTrades: user.stats?.totalTrades || 0,
        sharpeRatio: user.stats?.sharpeRatio,
        rank: index + 1
      }))

      // Sort by specified field
      if (params.sortBy) {
        processed.sort((a, b) => {
          const aVal = a[params.sortBy!] || 0
          const bVal = b[params.sortBy!] || 0
          return typeof aVal === 'number' && typeof bVal === 'number'
            ? bVal - aVal
            : 0
        })
      }

      // Update ranks after sorting
      processed = processed.map((entry, index) => ({
        ...entry,
        rank: index + 1
      }))

      return processed
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2
  })
}

/**
 * Hook to fetch a public profile
 */
export function usePublicProfile(userId: string) {
  return useQuery({
    queryKey: ['publicProfile', userId],
    queryFn: async () => {
      // This would call a public profile endpoint
      // For now, we'll use the user service
      const profile = await userService.getPublicProfile(userId)
      return profile
    },
    enabled: !!userId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1
  })
}