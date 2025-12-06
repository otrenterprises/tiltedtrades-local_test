/**
 * Public Leaderboard Page
 * Displays top performing traders with filtering and sorting
 */

import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNavigation } from '@/contexts/NavigationContext'
import { useLeaderboard } from '../../hooks/useLeaderboard'
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner'
import { ErrorMessage } from '../../components/feedback/ErrorMessage'
import { EmptyState } from '../../components/feedback/EmptyState'
import { formatCurrency, formatPercent, formatNumber } from '../../utils/formatting'
import { Trophy, TrendingUp, Target, Activity, Award, Medal } from 'lucide-react'

type SortField = 'totalPL' | 'winRate' | 'profitFactor' | 'totalTrades' | 'sharpeRatio'
type TimeFilter = 'all' | 'month' | 'quarter' | 'year'

export const Leaderboard: React.FC = () => {
  const navigate = useNavigate()
  const { isExpanded } = useNavigation()

  const [sortField, setSortField] = useState<SortField>('totalPL')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month')
  const [showOnlyVerified, setShowOnlyVerified] = useState(false)

  // Fetch leaderboard data
  const { data: leaderboard, isLoading, error, refetch } = useLeaderboard({
    sortBy: sortField,
    timeframe: timeFilter,
    limit: 100
  })

  // Filter and sort data
  const processedData = useMemo(() => {
    if (!leaderboard) return []

    let filtered = [...leaderboard]

    if (showOnlyVerified) {
      filtered = filtered.filter(trader => trader.isVerified)
    }

    return filtered
  }, [leaderboard, showOnlyVerified])

  // Get rank badge based on position
  const getRankBadge = (rank: number) => {
    if (rank === 1) return { icon: Trophy, color: 'text-yellow-400', bg: 'bg-yellow-400/10' }
    if (rank === 2) return { icon: Medal, color: 'text-tertiary', bg: 'bg-gray-400/10' }
    if (rank === 3) return { icon: Award, color: 'text-orange-400', bg: 'bg-orange-400/10' }
    return null
  }

  if (isLoading) {
    return <LoadingSpinner fullScreen />
  }

  if (error) {
    return (
      <ErrorMessage
        title="Failed to Load Leaderboard"
        message="Unable to fetch leaderboard data. Please try again."
        onRetry={() => refetch()}
        fullScreen
      />
    )
  }

  return (
    <div className={`min-h-screen bg-primary py-8 px-4 transition-all duration-300 ${isExpanded ? 'ml-60' : 'ml-16'}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
              <Trophy className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Trading Leaderboard</h1>
          <p className="text-tertiary">Compete with traders worldwide and track your ranking</p>
        </div>

        {/* Filters */}
        <div className="bg-secondary rounded-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Time Filter */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Time Period
              </label>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
                className="w-full px-4 py-2 bg-tertiary text-white rounded-lg border border-theme focus:border-blue-500 focus:outline-none"
              >
                <option value="month">This Month</option>
                <option value="quarter">This Quarter</option>
                <option value="year">This Year</option>
                <option value="all">All Time</option>
              </select>
            </div>

            {/* Sort Field */}
            <div>
              <label className="block text-sm font-medium text-secondary mb-2">
                Sort By
              </label>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="w-full px-4 py-2 bg-tertiary text-white rounded-lg border border-theme focus:border-blue-500 focus:outline-none"
              >
                <option value="totalPL">Total P&L</option>
                <option value="winRate">Win Rate</option>
                <option value="profitFactor">Profit Factor</option>
                <option value="totalTrades">Total Trades</option>
                <option value="sharpeRatio">Sharpe Ratio</option>
              </select>
            </div>

            {/* Verified Filter */}
            <div className="flex items-end">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyVerified}
                  onChange={(e) => setShowOnlyVerified(e.target.checked)}
                  className="mr-2 w-4 h-4 text-blue-600 bg-tertiary border-theme rounded focus:ring-blue-500"
                />
                <span className="text-secondary">Show only verified traders</span>
              </label>
            </div>
          </div>
        </div>

        {/* Top 3 Podium */}
        {processedData.length >= 3 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {/* 2nd Place */}
            <div className="order-1 md:order-1">
              <div className="bg-gradient-to-b from-gray-700 to-gray-800 rounded-lg p-6 text-center transform hover:scale-105 transition">
                <div className="flex justify-center mb-3">
                  <div className="w-12 h-12 bg-gray-400/20 rounded-full flex items-center justify-center">
                    <Medal className="w-6 h-6 text-tertiary" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-tertiary mb-2">2nd</div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  {processedData[1].username}
                </h3>
                <p className={`text-xl font-bold mb-2 ${
                  processedData[1].totalPL >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {formatCurrency(processedData[1].totalPL)}
                </p>
                <p className="text-sm text-tertiary">
                  {formatPercent(processedData[1].winRate)} Win Rate
                </p>
              </div>
            </div>

            {/* 1st Place */}
            <div className="order-2 md:order-2">
              <div className="bg-gradient-to-b from-yellow-600 to-yellow-700 rounded-lg p-6 text-center transform hover:scale-105 transition shadow-xl">
                <div className="flex justify-center mb-3">
                  <div className="w-16 h-16 bg-yellow-400/20 rounded-full flex items-center justify-center animate-pulse">
                    <Trophy className="w-8 h-8 text-yellow-400" />
                  </div>
                </div>
                <div className="text-4xl font-bold text-yellow-400 mb-2">1st</div>
                <h3 className="text-xl font-semibold text-white mb-1">
                  {processedData[0].username}
                </h3>
                <p className={`text-2xl font-bold mb-2 ${
                  processedData[0].totalPL >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {formatCurrency(processedData[0].totalPL)}
                </p>
                <p className="text-sm text-yellow-200">
                  {formatPercent(processedData[0].winRate)} Win Rate
                </p>
              </div>
            </div>

            {/* 3rd Place */}
            <div className="order-3 md:order-3">
              <div className="bg-gradient-to-b from-orange-700 to-orange-800 rounded-lg p-6 text-center transform hover:scale-105 transition">
                <div className="flex justify-center mb-3">
                  <div className="w-12 h-12 bg-orange-400/20 rounded-full flex items-center justify-center">
                    <Award className="w-6 h-6 text-orange-400" />
                  </div>
                </div>
                <div className="text-3xl font-bold text-orange-400 mb-2">3rd</div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  {processedData[2].username}
                </h3>
                <p className={`text-xl font-bold mb-2 ${
                  processedData[2].totalPL >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {formatCurrency(processedData[2].totalPL)}
                </p>
                <p className="text-sm text-tertiary">
                  {formatPercent(processedData[2].winRate)} Win Rate
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard Table */}
        {processedData.length === 0 ? (
          <EmptyState
            title="No Traders Found"
            description="No traders match your current filters. Try adjusting your search criteria."
          />
        ) : (
          <div className="bg-secondary rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-primary">
                    <th className="px-6 py-4 text-left text-xs font-medium text-tertiary uppercase tracking-wider">
                      Rank
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-tertiary uppercase tracking-wider">
                      Trader
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-tertiary uppercase tracking-wider">
                      Total P&L
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-tertiary uppercase tracking-wider">
                      Win Rate
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-tertiary uppercase tracking-wider">
                      Profit Factor
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-tertiary uppercase tracking-wider">
                      Total Trades
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-tertiary uppercase tracking-wider">
                      Sharpe Ratio
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-tertiary uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {processedData.map((trader, index) => {
                    const rank = index + 1
                    const badge = getRankBadge(rank)

                    return (
                      <tr
                        key={trader.userId}
                        className="hover:bg-gray-750 transition cursor-pointer"
                        onClick={() => navigate(`/app/profile/${trader.userId}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            {badge ? (
                              <div className={`w-8 h-8 ${badge.bg} rounded-full flex items-center justify-center mr-2`}>
                                <badge.icon className={`w-4 h-4 ${badge.color}`} />
                              </div>
                            ) : (
                              <span className="text-tertiary font-medium mr-2">#{rank}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mr-3">
                              <span className="text-white font-bold text-sm">
                                {trader.username.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="text-white font-medium flex items-center">
                                {trader.username}
                                {trader.isVerified && (
                                  <svg className="w-4 h-4 text-blue-400 ml-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                              {trader.bio && (
                                <p className="text-sm text-tertiary truncate max-w-xs">
                                  {trader.bio}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-right font-medium ${
                          trader.totalPL >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {formatCurrency(trader.totalPL)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-secondary">
                          {formatPercent(trader.winRate)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-secondary">
                          {trader.profitFactor ? trader.profitFactor.toFixed(2) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-secondary">
                          {formatNumber(trader.totalTrades, 0)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-secondary">
                          {trader.sharpeRatio ? trader.sharpeRatio.toFixed(2) : 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/app/profile/${trader.userId}`)
                            }}
                            className="text-blue-400 hover:text-blue-300 font-medium"
                          >
                            View Profile
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Stats Summary */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-secondary rounded-lg p-4 text-center">
            <Activity className="w-6 h-6 text-blue-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">{processedData.length}</p>
            <p className="text-sm text-tertiary">Active Traders</p>
          </div>

          <div className="bg-secondary rounded-lg p-4 text-center">
            <TrendingUp className="w-6 h-6 text-green-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">
              {processedData.filter(t => t.totalPL > 0).length}
            </p>
            <p className="text-sm text-tertiary">Profitable Traders</p>
          </div>

          <div className="bg-secondary rounded-lg p-4 text-center">
            <Target className="w-6 h-6 text-yellow-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">
              {formatPercent(
                processedData.reduce((sum, t) => sum + t.winRate, 0) / processedData.length
              )}
            </p>
            <p className="text-sm text-tertiary">Average Win Rate</p>
          </div>

          <div className="bg-secondary rounded-lg p-4 text-center">
            <Trophy className="w-6 h-6 text-orange-400 mx-auto mb-2" />
            <p className="text-2xl font-bold text-white">
              {formatCurrency(
                processedData.reduce((sum, t) => sum + t.totalPL, 0)
              )}
            </p>
            <p className="text-sm text-tertiary">Combined P&L</p>
          </div>
        </div>
      </div>
    </div>
  )
}