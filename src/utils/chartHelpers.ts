import { Trade } from '@/types/execution.types'
import { format } from 'date-fns'

export interface EquityCurveDataPoint {
  date: string
  pl: number
  cumulative: number
  trades: number
}

export interface MonthlyPerformanceDataPoint {
  month: string
  pl: number
  trades: number
  winRate: number
}

export interface DistributionDataPoint {
  range: string
  count: number
  percentage: number
}

export function getEquityCurveData(trades: Trade[], showGrossPL: boolean = false): EquityCurveDataPoint[] {
  const sortedTrades = [...trades].sort((a, b) =>
    (a.exitDate?.getTime() || 0) - (b.exitDate?.getTime() || 0)
  )

  let cumulative = 0
  const dataPoints: EquityCurveDataPoint[] = []

  sortedTrades.forEach((trade) => {
    if (trade.exitDate) {
      // If showGrossPL, add back commission to get gross P&L
      const effectivePL = showGrossPL ? trade.pl - trade.commission : trade.pl
      cumulative += effectivePL
      dataPoints.push({
        date: format(trade.exitDate, 'MMM d, yyyy'),
        pl: effectivePL,
        cumulative: cumulative,
        trades: dataPoints.length + 1,
      })
    }
  })

  return dataPoints
}

export function getMonthlyPerformanceData(trades: Trade[]): MonthlyPerformanceDataPoint[] {
  const monthlyData = new Map<string, {
    pl: number
    trades: Trade[]
    wins: number
  }>()

  trades.forEach((trade) => {
    if (trade.exitDate) {
      const monthKey = format(trade.exitDate, 'yyyy-MM')
      const existing = monthlyData.get(monthKey) || { pl: 0, trades: [], wins: 0 }

      existing.pl += trade.pl
      existing.trades.push(trade)
      if (trade.pl > 0) existing.wins++

      monthlyData.set(monthKey, existing)
    }
  })

  return Array.from(monthlyData.entries())
    .sort((a, b) => a[0].localeCompare(b[0])) // Sort by yyyy-MM format for chronological order
    .map(([month, data]) => ({
      month: format(new Date(month + '-01'), 'MMM yyyy'),
      pl: data.pl,
      trades: data.trades.length,
      winRate: data.trades.length > 0 ? (data.wins / data.trades.length) * 100 : 0,
    }))
}

export function getWinLossDistribution(trades: Trade[]): DistributionDataPoint[] {
  const ranges = [
    { min: -Infinity, max: -1000, label: '< -$1000' },
    { min: -1000, max: -500, label: '-$1000 to -$500' },
    { min: -500, max: -100, label: '-$500 to -$100' },
    { min: -100, max: -50, label: '-$100 to -$50' },
    { min: -50, max: 0, label: '-$50 to $0' },
    { min: 0, max: 50, label: '$0 to $50' },
    { min: 50, max: 100, label: '$50 to $100' },
    { min: 100, max: 500, label: '$100 to $500' },
    { min: 500, max: 1000, label: '$500 to $1000' },
    { min: 1000, max: Infinity, label: '> $1000' },
  ]

  const distribution = ranges.map((range) => {
    const count = trades.filter(
      (trade) => trade.pl > range.min && trade.pl <= range.max
    ).length
    return {
      range: range.label,
      count,
      percentage: trades.length > 0 ? (count / trades.length) * 100 : 0,
    }
  })

  return distribution.filter((d) => d.count > 0)
}

export function getSymbolPerformanceData(trades: Trade[]) {
  const symbolData = new Map<string, {
    pl: number
    trades: number
    wins: number
    grossPL: number
    commission: number
  }>()

  trades.forEach((trade) => {
    const existing = symbolData.get(trade.symbol) || {
      pl: 0,
      trades: 0,
      wins: 0,
      grossPL: 0,
      commission: 0,
    }

    existing.pl += trade.pl
    existing.trades++
    if (trade.pl > 0) existing.wins++
    existing.grossPL += trade.pl - trade.commission
    existing.commission += trade.commission

    symbolData.set(trade.symbol, existing)
  })

  return Array.from(symbolData.entries())
    .map(([symbol, data]) => ({
      symbol,
      pl: data.pl,
      trades: data.trades,
      winRate: (data.wins / data.trades) * 100,
      grossPL: data.grossPL,
      commission: data.commission,
    }))
    .sort((a, b) => b.pl - a.pl)
}
