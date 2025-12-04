/**
 * User API Types
 * Types for user profile and preferences
 */

export interface UserProfile {
  userId: string
  email: string
  displayName?: string
  bio?: string
  isPublic: boolean
  createdAt: string
  lastLoginAt?: string
  totalTrades?: number
  totalPL?: number
  winRate?: number
  profitFactor?: number
  avatarUrl?: string
}

export interface UserPreferences {
  userId: string
  calculationMethod: 'fifo' | 'perPosition'
  commissionTier: 'standard' | 'professional' | 'retail'
  timezone: string
  dateFormat: string
  currency: string
  notifications: {
    email: boolean
    uploadComplete: boolean
    weeklyReport: boolean
    monthlyReport: boolean
  }
  privacySettings: {
    showOnLeaderboard: boolean
    showRealName: boolean
    showStats: boolean
  }
  displayPreferences: {
    defaultView: 'overview' | 'trades' | 'stats'
    chartsPerPage: number
    theme: 'light' | 'dark' | 'auto'
  }
  riskSettings?: {
    defaultRiskPerTrade?: number
    maxDailyLoss?: number
  }
  createdAt: string
  updatedAt: string
}

export interface UpdateProfileRequest {
  displayName?: string
  bio?: string
  isPublic?: boolean
}

export interface UpdatePreferencesRequest {
  calculationMethod?: 'fifo' | 'perPosition'
  commissionTier?: 'standard' | 'professional' | 'retail'
  timezone?: string
  dateFormat?: string
  currency?: string
  notifications?: Partial<UserPreferences['notifications']>
  privacySettings?: Partial<UserPreferences['privacySettings']>
  displayPreferences?: Partial<UserPreferences['displayPreferences']>
  riskSettings?: Partial<UserPreferences['riskSettings']>
}

export interface PublicProfileStats {
  totalPL: number
  totalTrades: number
  winRate: number
  profitFactor: number
  returnPercent?: number
  averageWin?: number
  averageLoss?: number
  largestWin?: number
  largestLoss?: number
  maxDrawdown?: number
  sharpeRatio?: number
  avgWin?: number
  avgLoss?: number
  winLossRatio?: number
  winningTrades?: number
  losingTrades?: number
  avgHoldTime?: number
}

export interface PublicProfile {
  userId: string
  displayName: string
  username?: string
  bio?: string
  totalTrades: number
  totalPL: number
  winRate: number
  profitFactor: number
  sharpeRatio?: number
  maxDrawdown?: number
  joinedDate: string
  createdAt?: string
  avatarUrl?: string
  isVerified?: boolean
  location?: string
  rank?: number
  tradingStyle?: string
  stats?: PublicProfileStats
}

export interface LeaderboardEntry extends PublicProfile {
  rank: number
}