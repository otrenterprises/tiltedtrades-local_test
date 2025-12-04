/**
 * Analytics Page with API Data
 * Displays comprehensive trading analytics using API-fetched trades
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { CalculationMethod } from '@/utils/calculations/tradeMatching'
import { StatisticsCalculator } from '@/utils/calculations/statistics'
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner'
import { formatCurrency, formatPercent } from '../../utils/formatting'
import { useNavigation } from '@/contexts/NavigationContext'
import { useTrades, useStats } from '@/hooks/useTrades'
import { MobileSettingsToggle } from '@/components/layout/MobileSettingsToggle'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { format, startOfMonth, eachDayOfInterval, parseISO } from 'date-fns'

interface AnalyticsAPIProps {
  calculationMethod: CalculationMethod
  showGrossPL: boolean
}

export const AnalyticsAPI: React.FC<AnalyticsAPIProps> = ({ calculationMethod, showGrossPL }) => {
  const { isExpanded } = useNavigation()

  // Fetch trades from API
  const { data: tradesData, isLoading, error } = useTrades({
    method: calculationMethod,
  })

  // Fetch backend stats (includes bulk commission adjustments)
  const { data: backendStats } = useStats()

  const trades = tradesData?.trades || []

  // Get min and max dates from trades for all-time range
  const allTimeDateRange = useMemo(() => {
    if (!trades || trades.length === 0) {
      return {
        start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
      }
    }
    const dates = trades.map(t => t.exitDate).filter((d): d is Date => d !== null).map(d => d.getTime())
    return {
      start: format(new Date(Math.min(...dates)), 'yyyy-MM-dd'),
      end: format(new Date(), 'yyyy-MM-dd') // Use today's date to include all trades
    }
  }, [trades])

  const [dateRange, setDateRange] = useState(allTimeDateRange)
  const [isInitialized, setIsInitialized] = useState(false)

  // Update dateRange only on initial load, not when calculationMethod changes
  useEffect(() => {
    if (trades && trades.length > 0 && !isInitialized) {
      setDateRange(allTimeDateRange)
      setIsInitialized(true)
    }
  }, [allTimeDateRange, trades, isInitialized])

  // Filter trades by date range
  const filteredTrades = useMemo(() => {
    if (!trades || trades.length === 0) return []

    // Parse dates and set to start/end of day
    const start = new Date(dateRange.start + 'T00:00:00')
    const end = new Date(dateRange.end + 'T23:59:59.999')

    return trades.filter(trade => {
      if (!trade.exitDate) return false

      const tradeTime = trade.exitDate.getTime()
      const startTime = start.getTime()
      const endTime = end.getTime()

      return tradeTime >= startTime && tradeTime <= endTime
    })
  }, [trades, dateRange])

  // Calculate statistics from filtered data (respects Net/Gross toggle for win/loss/breakeven)
  const stats = useMemo(() => {
    return StatisticsCalculator.calculateMetrics(filteredTrades, showGrossPL)
  }, [filteredTrades, showGrossPL])

  // Determine if viewing all trades (no filter applied)
  const isAllTimeView = filteredTrades.length === trades.length && trades.length > 0

  // Helper to get effective P&L based on toggle (gross adds back commission)
  const getEffectivePL = useCallback((pl: number, commission: number): number => {
    return showGrossPL ? pl - commission : pl
  }, [showGrossPL])

  // Get displayed P&L based on toggle
  // Always use client-side stats since trades include commission overrides
  // Backend stats (TradingStats table) don't have commission overrides applied
  const displayedPL = useMemo(() => {
    return showGrossPL ? stats.grossPL : stats.totalPL
  }, [showGrossPL, stats.grossPL, stats.totalPL])

  // Calculate total contracts traded (sum of quantity for each trade)
  const totalContracts = useMemo(() => {
    return filteredTrades.reduce((sum, trade) => sum + trade.quantity, 0)
  }, [filteredTrades])

  // Process data for charts
  const equityCurve = useMemo(() => {
    if (!filteredTrades || filteredTrades.length === 0) return []

    let runningPL = 0
    return filteredTrades
      .filter(t => t.exitDate !== null)
      .sort((a, b) => a.exitDate!.getTime() - b.exitDate!.getTime())
      .map(trade => {
        const effectivePL = getEffectivePL(trade.pl, trade.commission)
        runningPL += effectivePL
        return {
          date: format(trade.exitDate!, 'MMM dd, yyyy'),
          value: runningPL,
          trade: effectivePL
        }
      })
  }, [filteredTrades, getEffectivePL])

  const monthlyPerformance = useMemo(() => {
    if (!filteredTrades || filteredTrades.length === 0) return []

    const monthlyData: Record<string, { pnl: number; trades: number; wins: number }> = {}

    filteredTrades.forEach(trade => {
      if (!trade.exitDate) return
      const month = format(trade.exitDate, 'yyyy-MM')
      if (!monthlyData[month]) {
        monthlyData[month] = { pnl: 0, trades: 0, wins: 0 }
      }
      const effectivePL = getEffectivePL(trade.pl, trade.commission)
      monthlyData[month].pnl += effectivePL
      monthlyData[month].trades += 1
      if (effectivePL > 0) monthlyData[month].wins += 1
    })

    return Object.entries(monthlyData)
      .sort((a, b) => a[0].localeCompare(b[0])) // Sort by yyyy-MM key chronologically
      .slice(-12) // Last 12 months
      .map(([month, data]) => ({
        month: format(parseISO(month + '-01'), 'MMM yyyy'),
        pnl: data.pnl,
        trades: data.trades,
        winRate: (data.wins / data.trades) * 100
      }))
  }, [filteredTrades, getEffectivePL])

  const winLossDistribution = useMemo(() => {
    if (!stats) return []

    return [
      { name: 'Wins', value: stats.winningTrades, color: '#10B981' },
      { name: 'Losses', value: stats.losingTrades, color: '#EF4444' },
      { name: 'Breakeven', value: stats.breakevenTrades || 0, color: '#6B7280' }
    ]
  }, [stats])

  const symbolPerformance = useMemo(() => {
    if (!filteredTrades || filteredTrades.length === 0) return []

    const symbolStats: Record<string, { pnl: number; trades: number; wins: number; contracts: number }> = {}

    filteredTrades.forEach(trade => {
      if (!symbolStats[trade.symbol]) {
        symbolStats[trade.symbol] = { pnl: 0, trades: 0, wins: 0, contracts: 0 }
      }
      const effectivePL = getEffectivePL(trade.pl, trade.commission)
      symbolStats[trade.symbol].pnl += effectivePL
      symbolStats[trade.symbol].trades += 1
      symbolStats[trade.symbol].contracts += trade.quantity
      if (effectivePL > 0) symbolStats[trade.symbol].wins += 1
    })

    return Object.entries(symbolStats)
      .map(([symbol, stats]) => ({
        symbol,
        pnl: stats.pnl,
        trades: stats.trades,
        contracts: stats.contracts,
        winRate: (stats.wins / stats.trades) * 100
      }))
      .sort((a, b) => b.pnl - a.pnl)
      .slice(0, 10) // Top 10 symbols
  }, [filteredTrades, getEffectivePL])

  const dailyPL = useMemo(() => {
    if (!filteredTrades || filteredTrades.length === 0) return []

    const dailyData: Record<string, number> = {}

    filteredTrades.forEach(trade => {
      if (!trade.exitDate) return
      const date = format(trade.exitDate, 'yyyy-MM-dd')
      const effectivePL = getEffectivePL(trade.pl, trade.commission)
      dailyData[date] = (dailyData[date] || 0) + effectivePL
    })

    // Fill in missing days with 0
    const start = new Date(dateRange.start)
    const end = new Date(dateRange.end)
    const days = eachDayOfInterval({ start, end })

    return days.map(day => {
      const date = format(day, 'yyyy-MM-dd')
      return {
        date: format(day, 'MMM dd, yyyy'),
        pnl: dailyData[date] || 0
      }
    })
  }, [filteredTrades, dateRange, getEffectivePL])

  // Loading state
  if (isLoading) {
    return <LoadingSpinner fullScreen />
  }

  // Error state
  if (error) {
    return (
      <div className={`min-h-screen bg-dark transition-all duration-300 ml-0 ${isExpanded ? 'md:ml-60' : 'md:ml-16'} pb-20 md:pb-0`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-8">
          <div className="text-center text-red-400 p-8">
            <p>Error loading trades: {error.message}</p>
            <p className="text-sm text-gray-500 mt-2">Please check your connection and try again.</p>
          </div>
        </div>
      </div>
    )
  }

  // Empty state
  if (!trades || trades.length === 0) {
    return (
      <div className={`min-h-screen bg-dark transition-all duration-300 ml-0 ${isExpanded ? 'md:ml-60' : 'md:ml-16'} pb-20 md:pb-0`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-8">
          <div className="text-center text-gray-400 p-8">
            <p>No trades found. Upload your trading data to get started.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen bg-dark transition-all duration-300 ml-0 ${isExpanded ? 'md:ml-60' : 'md:ml-16'} pb-20 md:pb-0`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-8">
        {/* Header */}
        <div className="mb-4 md:mb-8">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 md:mb-2">Trading Analytics</h1>
              <p className="text-sm md:text-base text-gray-400">Comprehensive analysis of your trading performance ({calculationMethod === 'perPosition' ? 'POSITIONAL' : 'FIFO'})</p>
            </div>
            <div className="flex-shrink-0 pt-1">
              <MobileSettingsToggle showPLToggle showMethodToggle />
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-dark-secondary rounded-lg p-3 md:p-4 mb-4 md:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
            <div className="grid grid-cols-2 sm:flex sm:items-end gap-3 sm:gap-4">
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-tertiary text-white rounded-lg border border-dark-border focus:border-accent focus:ring-1 focus:ring-accent text-sm"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                  className="w-full px-3 py-2 bg-dark-tertiary text-white rounded-lg border border-dark-border focus:border-accent focus:ring-1 focus:ring-accent text-sm"
                />
              </div>
            </div>

            <button
              onClick={() => setDateRange(allTimeDateRange)}
              className="px-4 py-2 bg-accent hover:bg-accent/90 text-white rounded-lg transition-colors font-medium text-sm touch-target"
              title="Reset to all-time range"
            >
              All-Time
            </button>

            <div className="sm:ml-auto text-xs md:text-sm text-gray-400">
              Showing {filteredTrades.length} of {trades.length} trades
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4 mb-4 md:mb-8">
          <div className="bg-dark-secondary rounded-lg p-4 md:p-6">
            <p className="text-xs md:text-sm text-gray-400 mb-1 md:mb-2">{showGrossPL ? 'Gross P&L' : 'Net P&L'}</p>
            <p className={`text-lg md:text-2xl font-bold ${displayedPL >= 0 ? 'text-profit' : 'text-loss'}`}>
              {formatCurrency(displayedPL)}
            </p>
          </div>

          <div className="bg-dark-secondary rounded-lg p-4 md:p-6">
            <p className="text-xs md:text-sm text-gray-400 mb-1 md:mb-2">Win Rate</p>
            <p className="text-lg md:text-2xl font-bold text-white">
              {formatPercent(stats.winRate)}
            </p>
          </div>

          <div className="bg-dark-secondary rounded-lg p-4 md:p-6">
            <p className="text-xs md:text-sm text-gray-400 mb-1 md:mb-2">Profit Factor</p>
            <p className="text-lg md:text-2xl font-bold text-white">
              {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
            </p>
          </div>

          <div className="bg-dark-secondary rounded-lg p-4 md:p-6">
            <p className="text-xs md:text-sm text-gray-400 mb-1 md:mb-2">Total Trades</p>
            <p className="text-lg md:text-2xl font-bold text-white">
              {stats.totalTrades}
            </p>
          </div>

          <div className="bg-dark-secondary rounded-lg p-4 md:p-6 col-span-2 sm:col-span-1">
            <p className="text-xs md:text-sm text-gray-400 mb-1 md:mb-2">Contracts Traded</p>
            <p className="text-lg md:text-2xl font-bold text-white">
              {totalContracts.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 mb-4 md:mb-8">
          {/* Equity Curve */}
          <div className="bg-dark-secondary rounded-lg p-4 md:p-6">
            <h2 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">Equity Curve</h2>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={equityCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  stroke="#9CA3AF"
                  tickFormatter={(value) => {
                    // Strip year from display (e.g., "Nov 13, 2024" -> "Nov 13")
                    return value.replace(/, \d{4}$/, '')
                  }}
                />
                <YAxis
                  stroke="#9CA3AF"
                  width={80}
                  tickFormatter={(value) => formatCurrency(value)}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                  itemStyle={{ color: '#E5E7EB' }}
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

          {/* Win/Loss Distribution */}
          <div className="bg-dark-secondary rounded-lg p-4 md:p-6">
            <h2 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">Win/Loss Distribution</h2>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={winLossDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {winLossDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                  itemStyle={{ color: '#E5E7EB' }}
                  labelStyle={{ color: '#9CA3AF' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Daily P&L */}
          <div className="bg-dark-secondary rounded-lg p-4 md:p-6">
            <h2 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">Daily P&L</h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyPL}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="date"
                  stroke="#9CA3AF"
                  tickFormatter={(value) => {
                    // Strip year from display (e.g., "Nov 13, 2024" -> "Nov 13")
                    return value.replace(/, \d{4}$/, '')
                  }}
                />
                <YAxis
                  stroke="#9CA3AF"
                  width={80}
                  tickFormatter={(value) => formatCurrency(value)}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                  itemStyle={{ color: '#E5E7EB' }}
                  labelStyle={{ color: '#9CA3AF' }}
                  formatter={(value: any) => formatCurrency(value)}
                />
                <Bar dataKey="pnl">
                  {dailyPL.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? '#10B981' : '#EF4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Monthly Performance */}
          <div className="bg-dark-secondary rounded-lg p-4 md:p-6">
            <h2 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">Monthly Performance</h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={monthlyPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="month" stroke="#9CA3AF" />
                <YAxis
                  stroke="#9CA3AF"
                  width={80}
                  tickFormatter={(value) => formatCurrency(value)}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                  itemStyle={{ color: '#E5E7EB' }}
                  labelStyle={{ color: '#9CA3AF' }}
                  formatter={(value: any, name: string) =>
                    name === 'pnl' ? formatCurrency(value) : `${value.toFixed(1)}%`
                  }
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="pnl"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6' }}
                />
                <Line
                  type="monotone"
                  dataKey="winRate"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: '#10B981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Symbol Performance Table */}
        <div className="bg-dark-secondary rounded-lg p-4 md:p-6">
          <h2 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">Top Performing Symbols</h2>
          <div className="overflow-x-auto -mx-4 md:mx-0">
            <table className="w-full min-w-[500px]">
              <thead>
                <tr className="border-b border-dark-border">
                  <th className="text-left text-xs md:text-sm font-medium text-gray-400 pb-3 pl-4 md:pl-0">Symbol</th>
                  <th className="text-right text-xs md:text-sm font-medium text-gray-400 pb-3">P&L</th>
                  <th className="text-right text-xs md:text-sm font-medium text-gray-400 pb-3">Trades</th>
                  <th className="text-right text-xs md:text-sm font-medium text-gray-400 pb-3">Contracts</th>
                  <th className="text-right text-xs md:text-sm font-medium text-gray-400 pb-3 pr-4 md:pr-0">Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {symbolPerformance.map((symbol) => (
                  <tr key={symbol.symbol} className="border-b border-dark-border">
                    <td className="py-3 text-white font-medium text-sm pl-4 md:pl-0">{symbol.symbol}</td>
                    <td className={`py-3 text-right text-sm ${symbol.pnl >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {formatCurrency(symbol.pnl)}
                    </td>
                    <td className="py-3 text-right text-gray-300 text-sm">{symbol.trades}</td>
                    <td className="py-3 text-right text-gray-300 text-sm">{symbol.contracts.toLocaleString()}</td>
                    <td className="py-3 text-right text-gray-300 text-sm pr-4 md:pr-0">{formatPercent(symbol.winRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Additional Statistics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mt-4 md:mt-8">
          <div className="bg-dark-secondary rounded-lg p-4 md:p-6">
            <h3 className="text-sm md:text-md font-semibold text-white mb-3 md:mb-4">Risk Metrics</h3>
            <div className="space-y-2 md:space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Max Drawdown</span>
                <span className="text-loss">{formatCurrency(stats.maxDrawdown)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Max Drawdown %</span>
                <span className="text-loss">{stats.maxDrawdownPercent.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Expectancy</span>
                <span className={stats.expectancy >= 0 ? 'text-profit' : 'text-loss'}>
                  {formatCurrency(stats.expectancy)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-dark-secondary rounded-lg p-4 md:p-6">
            <h3 className="text-sm md:text-md font-semibold text-white mb-3 md:mb-4">Win/Loss Analysis</h3>
            <div className="space-y-2 md:space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Average Win</span>
                <span className="text-profit">{formatCurrency(stats.averageWin)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Average Loss</span>
                <span className="text-loss">{formatCurrency(stats.averageLoss)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Largest Win</span>
                <span className="text-profit">{formatCurrency(stats.largestWin)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Largest Loss</span>
                <span className="text-loss">{formatCurrency(stats.largestLoss)}</span>
              </div>
            </div>
          </div>

          <div className="bg-dark-secondary rounded-lg p-4 md:p-6 sm:col-span-2 md:col-span-1">
            <h3 className="text-sm md:text-md font-semibold text-white mb-3 md:mb-4">Trading Activity</h3>
            <div className="space-y-2 md:space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Winning Trades</span>
                <span className="text-profit">{stats.winningTrades}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Losing Trades</span>
                <span className="text-loss">{stats.losingTrades}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Breakeven Trades</span>
                <span className="text-gray-400">{stats.breakevenTrades}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Commissions</span>
                <span className="text-caution">
                  {formatCurrency(isAllTimeView && backendStats ? backendStats.totalCommission : stats.totalCommission)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
