/**
 * Public Profile Page
 * Displays a trader's public profile and statistics
 */

import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useNavigation } from '@/contexts/NavigationContext'
import { usePublicProfile } from '../../hooks/useLeaderboard'
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner'
import { ErrorMessage } from '../../components/feedback/ErrorMessage'
import { formatCurrency, formatPercent, formatDate } from '../../utils/formatting'
import {
  Trophy,
  TrendingUp,
  Target,
  Activity,
  Calendar,
  Award,
  ChevronLeft,
  ExternalLink
} from 'lucide-react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts'

export const PublicProfile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { isExpanded } = useNavigation()

  const { data: profile, isLoading, error } = usePublicProfile(userId || '')

  if (isLoading) {
    return <LoadingSpinner fullScreen />
  }

  if (error || !profile) {
    return (
      <ErrorMessage
        title="Profile Not Found"
        message="This trader's profile could not be found or is not public."
        onRetry={() => navigate('/app/leaderboard')}
        fullScreen
      />
    )
  }

  // Mock equity curve data (would come from API)
  const equityCurve = Array.from({ length: 30 }, (_, i) => ({
    day: i + 1,
    value: Math.random() * 10000 + i * 100
  }))

  const stats = profile.stats || {
    totalPL: 0,
    totalTrades: 0,
    winRate: 0,
    profitFactor: 0,
    returnPercent: 0,
    averageWin: 0,
    averageLoss: 0,
    largestWin: 0,
    largestLoss: 0,
    maxDrawdown: 0,
    sharpeRatio: 0,
    avgWin: 0,
    avgLoss: 0,
    winLossRatio: 0,
    winningTrades: 0,
    losingTrades: 0,
    avgHoldTime: 0
  }

  return (
    <div className={`min-h-screen bg-primary py-8 px-4 transition-all duration-300 ${isExpanded ? 'ml-60' : 'ml-16'}`}>
      <div className="max-w-6xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate('/app/leaderboard')}
          className="flex items-center text-tertiary hover:text-primary mb-6"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          Back to Leaderboard
        </button>

        {/* Profile Header */}
        <div className="bg-secondary rounded-lg p-8 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center">
              {/* Avatar */}
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-6">
                <span className="text-primary font-bold text-2xl">
                  {profile.username?.charAt(0).toUpperCase() || 'T'}
                </span>
              </div>

              {/* Profile Info */}
              <div>
                <div className="flex items-center mb-2">
                  <h1 className="text-2xl font-bold text-primary mr-3">
                    {profile.username || `Trader${userId?.slice(-4)}`}
                  </h1>
                  {profile.isVerified && (
                    <div className="flex items-center bg-blue-500/20 px-2 py-1 rounded">
                      <svg className="w-4 h-4 text-blue-400 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-xs text-blue-400">Verified</span>
                    </div>
                  )}
                </div>

                {profile.bio && (
                  <p className="text-tertiary mb-3 max-w-2xl">{profile.bio}</p>
                )}

                <div className="flex items-center space-x-4 text-sm text-muted">
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    Joined {formatDate(profile.createdAt || new Date())}
                  </div>
                  {profile.location && (
                    <div className="flex items-center">
                      <ExternalLink className="w-4 h-4 mr-1" />
                      {profile.location}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Rank Badge */}
            {profile.rank && profile.rank <= 3 && (
              <div className="flex flex-col items-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                  profile.rank === 1 ? 'bg-yellow-400/20' :
                  profile.rank === 2 ? 'bg-gray-400/20' :
                  'bg-orange-400/20'
                }`}>
                  <Trophy className={`w-8 h-8 ${
                    profile.rank === 1 ? 'text-yellow-400' :
                    profile.rank === 2 ? 'text-gray-400' :
                    'text-orange-400'
                  }`} />
                </div>
                <p className="text-sm text-tertiary mt-2">Rank #{profile.rank}</p>
              </div>
            )}
          </div>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-secondary rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <TrendingUp className="w-5 h-5 text-blue-400" />
              <span className={`text-sm ${stats.totalPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {stats.totalPL >= 0 ? '+' : ''}{formatPercent(stats.returnPercent || 0)}
              </span>
            </div>
            <p className="text-sm text-tertiary mb-1">Total P&L</p>
            <p className={`text-xl font-bold ${stats.totalPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(stats.totalPL || 0)}
            </p>
          </div>

          <div className="bg-secondary rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <Target className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-sm text-tertiary mb-1">Win Rate</p>
            <p className="text-xl font-bold text-primary">
              {formatPercent(stats.winRate || 0)}
            </p>
          </div>

          <div className="bg-secondary rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <Activity className="w-5 h-5 text-yellow-400" />
            </div>
            <p className="text-sm text-tertiary mb-1">Profit Factor</p>
            <p className="text-xl font-bold text-primary">
              {stats.profitFactor?.toFixed(2) || 'N/A'}
            </p>
          </div>

          <div className="bg-secondary rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <Award className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-sm text-tertiary mb-1">Total Trades</p>
            <p className="text-xl font-bold text-primary">
              {stats.totalTrades || 0}
            </p>
          </div>
        </div>

        {/* Performance Chart */}
        <div className="bg-secondary rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold text-primary mb-4">Equity Curve (Last 30 Days)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={equityCurve}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="day" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                labelStyle={{ color: '#9CA3AF' }}
                formatter={(value: any) => formatCurrency(value)}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#3B82F6"
                fill="#3B82F6"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Detailed Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Performance Metrics */}
          <div className="bg-secondary rounded-lg p-6">
            <h3 className="text-lg font-semibold text-primary mb-4">Performance Metrics</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-tertiary">Average Win</span>
                <span className="text-green-400">
                  {formatCurrency(stats.avgWin || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-tertiary">Average Loss</span>
                <span className="text-red-400">
                  {formatCurrency(stats.avgLoss || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-tertiary">Win/Loss Ratio</span>
                <span className="text-primary">
                  {stats.winLossRatio?.toFixed(2) || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-tertiary">Sharpe Ratio</span>
                <span className="text-primary">
                  {stats.sharpeRatio?.toFixed(2) || 'N/A'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-tertiary">Max Drawdown</span>
                <span className="text-red-400">
                  {formatCurrency(stats.maxDrawdown || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Trading Activity */}
          <div className="bg-secondary rounded-lg p-6">
            <h3 className="text-lg font-semibold text-primary mb-4">Trading Activity</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-tertiary">Winning Trades</span>
                <span className="text-green-400">{stats.winningTrades || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tertiary">Losing Trades</span>
                <span className="text-red-400">{stats.losingTrades || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-tertiary">Avg Hold Time</span>
                <span className="text-primary">
                  {stats.avgHoldTime?.toFixed(1) || 0} days
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-tertiary">Best Trade</span>
                <span className="text-green-400">
                  {formatCurrency(stats.largestWin || 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-tertiary">Worst Trade</span>
                <span className="text-red-400">
                  {formatCurrency(stats.largestLoss || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Trading Style */}
        {profile.tradingStyle && (
          <div className="bg-secondary rounded-lg p-6 mt-6">
            <h3 className="text-lg font-semibold text-primary mb-4">Trading Style</h3>
            <div className="flex flex-wrap gap-2">
              {profile.tradingStyle.split(',').map((style: string, index: number) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm"
                >
                  {style.trim()}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}