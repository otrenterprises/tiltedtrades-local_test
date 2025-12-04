import { useMemo } from 'react'
import { TrendingUp, DollarSign, Target, Activity } from 'lucide-react'
import { CalculationMethod } from '@/utils/calculations/tradeMatching'
import { StatisticsCalculator } from '@/utils/calculations/statistics'
import { formatCurrency } from '@/utils/formatting/currency'
import { formatPercentage } from '@/utils/formatting/number'
import { MetricCard } from '@/components/common/MetricCard'
import { EquityCurve } from '@/components/charts/EquityCurve'
import { MonthlyPerformance } from '@/components/charts/MonthlyPerformance'
import { WinLossDistribution } from '@/components/charts/WinLossDistribution'
import { SymbolPerformance } from '@/components/charts/SymbolPerformance'
import { PageLayout } from '@/components/layout/PageLayout'
import { useTrades, useStats } from '@/hooks/useTrades'
import {
  getEquityCurveData,
  getMonthlyPerformanceData,
  getWinLossDistribution,
  getSymbolPerformanceData,
} from '@/utils/chartHelpers'

interface DashboardProps {
  calculationMethod: CalculationMethod
  showGrossPL: boolean
}

export function DashboardNew({ calculationMethod, showGrossPL }: DashboardProps) {

  // Fetch trades from API
  const { data: tradesData, isLoading: isLoadingTrades, error: tradesError } = useTrades({
    method: calculationMethod,
  })

  // Fetch stats from API (pre-calculated on server)
  const { data: apiStats, isLoading: isLoadingStats } = useStats({ period: 'ALL' })

  const trades = tradesData?.trades || []

  // Calculate client-side metrics from trades (respects Net/Gross toggle for win/loss/breakeven)
  const metrics = useMemo(() => {
    if (trades.length === 0) return null

    // Calculate client-side metrics with gross/net mode for accurate win/loss/breakeven counts
    const clientMetrics = StatisticsCalculator.calculateMetrics(trades, showGrossPL)

    // Client metrics are calculated from trades which include commission overrides
    // API stats (TradingStats table) don't have commission overrides applied to P&L
    // So we use client-side values for P&L totals
    return clientMetrics
  }, [trades, showGrossPL])

  // Loading state
  if (isLoadingTrades || isLoadingStats) {
    return (
      <PageLayout title="Dashboard" subtitle="Loading your trading data...">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-400">Loading trades...</p>
          </div>
        </div>
      </PageLayout>
    )
  }

  // Error state
  if (tradesError) {
    return (
      <PageLayout title="Dashboard">
        <div className="text-center text-red-400 p-8">
          <p>Error loading trades: {tradesError.message}</p>
          <p className="text-sm text-slate-500 mt-2">Please check your connection and try again.</p>
        </div>
      </PageLayout>
    )
  }

  // Empty state
  if (trades.length === 0) {
    return (
      <PageLayout title="Dashboard" subtitle="No trading data yet">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-slate-400">No trades found. Upload your trading data to get started.</p>
          </div>
        </div>
      </PageLayout>
    )
  }

  if (!metrics) {
    return (
      <PageLayout title="Dashboard">
        <div className="text-center text-slate-400">Calculating metrics...</div>
      </PageLayout>
    )
  }

  // Generate chart data with commission toggle support
  const equityCurveData = getEquityCurveData(trades, showGrossPL)
  const monthlyData = getMonthlyPerformanceData(trades)
  const distributionData = getWinLossDistribution(trades)
  const symbolData = getSymbolPerformanceData(trades)

  // Get displayed P&L based on toggle
  const displayedPL = showGrossPL ? metrics.grossPL : metrics.totalPL

  return (
    <PageLayout
      title="Dashboard"
      subtitle="Your trading performance at a glance"
    >
      <div className="space-y-6">
        {/* Key Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
          <MetricCard
            title={showGrossPL ? 'Gross P&L' : 'Net P&L'}
            value={formatCurrency(displayedPL)}
            subtitle={`${metrics.totalTrades} trades`}
            color={displayedPL >= 0 ? 'profit' : 'loss'}
            icon={<DollarSign className="w-5 h-5" />}
          />
          <MetricCard
            title="Win Rate"
            value={formatPercentage(metrics.winRate)}
            subtitle={`${metrics.winningTrades} wins / ${metrics.losingTrades} losses`}
            color="accent"
            icon={<Target className="w-5 h-5" />}
          />
          <MetricCard
            title="Profit Factor"
            value={metrics.profitFactor === Infinity ? '∞' : metrics.profitFactor.toFixed(2)}
            subtitle={`${formatCurrency(metrics.grossProfit)} / ${formatCurrency(Math.abs(metrics.grossLoss))}`}
            color="premium"
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <MetricCard
            title="Expectancy"
            value={formatCurrency(metrics.expectancy)}
            subtitle="Average per trade"
            color={metrics.expectancy >= 0 ? 'profit' : 'loss'}
            icon={<Activity className="w-5 h-5" />}
          />
        </div>

        {/* Equity Curve - Full Width */}
        <EquityCurve data={equityCurveData} />

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MonthlyPerformance data={monthlyData} />
          <WinLossDistribution data={distributionData} />
        </div>

        {/* Performance Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
          <MetricCard
            title="Average Win"
            value={formatCurrency(metrics.averageWin)}
            subtitle={`Largest: ${formatCurrency(metrics.largestWin)}`}
            color="profit"
          />
          <MetricCard
            title="Average Loss"
            value={formatCurrency(metrics.averageLoss)}
            subtitle={`Largest: ${formatCurrency(metrics.largestLoss)}`}
            color="loss"
          />
          <MetricCard
            title="Max Drawdown"
            value={formatCurrency(metrics.maxDrawdown)}
            subtitle={formatPercentage(metrics.maxDrawdownPercent)}
            color="caution"
          />
        </div>

        {/* Symbol Performance */}
        <SymbolPerformance data={symbolData} />

        {/* Additional Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          <div className="bg-dark-secondary border border-dark-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">Commission Analysis</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Total Commission</span>
                <span className="text-sm font-semibold text-loss">{formatCurrency(metrics.totalCommission)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Gross P&L</span>
                <span className={`text-sm font-semibold ${metrics.grossPL >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {formatCurrency(metrics.grossPL)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-dark-border">
                <span className="text-sm text-slate-400">Net P&L</span>
                <span className={`text-lg font-bold ${metrics.totalPL >= 0 ? 'text-profit' : 'text-loss'}`}>
                  {formatCurrency(metrics.totalPL)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Avg Commission/Trade</span>
                <span className="text-xs font-semibold text-slate-400">
                  {formatCurrency(metrics.totalCommission / metrics.totalTrades)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-dark-secondary border border-dark-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">Trade Breakdown</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Total Trades</span>
                <span className="text-sm font-semibold text-slate-200">{metrics.totalTrades}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Winning Trades</span>
                <span className="text-sm font-semibold text-profit">{metrics.winningTrades} ({formatPercentage(metrics.winRate)})</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Losing Trades</span>
                <span className="text-sm font-semibold text-loss">{metrics.losingTrades}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-400">Breakeven Trades</span>
                <span className="text-sm font-semibold text-slate-400">{metrics.breakevenTrades}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  )
}
