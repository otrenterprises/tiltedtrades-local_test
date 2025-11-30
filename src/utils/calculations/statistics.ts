import { Trade } from '@/types/execution.types'
import { TradingMetrics } from '@/types/stats.types'

export class StatisticsCalculator {
  /**
   * Calculate comprehensive trading metrics
   * @param trades - Array of trades to calculate metrics for
   * @param useGrossPL - If true, calculate win/loss/breakeven based on gross P&L (before commission)
   */
  static calculateMetrics(trades: Trade[], useGrossPL: boolean = false): TradingMetrics {
    const closedTrades = trades.filter(t => t.status === 'closed')

    if (closedTrades.length === 0) {
      return this.getEmptyMetrics()
    }

    // Get effective P&L for each trade based on mode
    const getEffectivePL = (trade: Trade): number => {
      return useGrossPL ? trade.pl - trade.commission : trade.pl
    }

    const winners = closedTrades.filter(t => getEffectivePL(t) > 0)
    const losers = closedTrades.filter(t => getEffectivePL(t) < 0)
    const breakeven = closedTrades.filter(t => getEffectivePL(t) === 0)

    // Calculate totals using effective P&L (respects gross/net mode for winners/losers classification)
    const totalWins = winners.reduce((sum, t) => sum + getEffectivePL(t), 0)
    const totalLosses = losers.reduce((sum, t) => sum + getEffectivePL(t), 0) // Negative value

    // Gross P&L totals (before commission) - always calculated for profit factor
    const grossProfitTotal = winners.reduce((sum, t) => sum + (t.pl - t.commission), 0)
    const grossLossTotal = losers.reduce((sum, t) => sum + (t.pl - t.commission), 0) // Negative value

    // Calculate commission and gross P&L
    const totalCommission = closedTrades.reduce((sum, t) => sum + t.commission, 0)
    const totalNetPL = closedTrades.reduce((sum, t) => sum + t.pl, 0)
    const totalGrossPL = totalNetPL - totalCommission  // Gross = Net - Commission (commission is negative)

    return {
      totalTrades: closedTrades.length,
      winningTrades: winners.length,
      losingTrades: losers.length,
      breakevenTrades: breakeven.length,
      winRate: closedTrades.length > 0 ? (winners.length / closedTrades.length) * 100 : 0,
      averageWin: winners.length > 0 ? totalWins / winners.length : 0,
      averageLoss: losers.length > 0 ? totalLosses / losers.length : 0, // Negative value
      largestWin: winners.length > 0 ? Math.max(...winners.map(t => getEffectivePL(t))) : 0,
      largestLoss: losers.length > 0 ? Math.min(...losers.map(t => getEffectivePL(t))) : 0,
      profitFactor: grossLossTotal < 0 ? grossProfitTotal / Math.abs(grossLossTotal) : grossProfitTotal > 0 ? Infinity : 0,
      expectancy: closedTrades.length > 0 ? (useGrossPL ? totalGrossPL : totalNetPL) / closedTrades.length : 0,
      totalPL: totalNetPL,  // Net P&L (includes commission)
      grossPL: totalGrossPL,  // Gross P&L (before commission)
      grossProfit: grossProfitTotal,  // Gross profit (before commission)
      grossLoss: grossLossTotal,  // Gross loss (before commission, negative value)
      totalCommission: totalCommission,  // Total commission paid (negative)
      maxDrawdown: this.calculateMaxDrawdown(closedTrades, useGrossPL),
      maxDrawdownPercent: this.calculateMaxDrawdownPercent(closedTrades, useGrossPL)
    }
  }

  /**
   * Calculate maximum drawdown in dollars
   */
  private static calculateMaxDrawdown(trades: Trade[], useGrossPL: boolean = false): number {
    let peak = 0
    let maxDrawdown = 0
    let runningPL = 0

    for (const trade of trades) {
      const effectivePL = useGrossPL ? trade.pl - trade.commission : trade.pl
      runningPL += effectivePL
      if (runningPL > peak) {
        peak = runningPL
      }
      const drawdown = peak - runningPL
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown
      }
    }

    return maxDrawdown
  }

  /**
   * Calculate maximum drawdown as percentage
   */
  private static calculateMaxDrawdownPercent(trades: Trade[], useGrossPL: boolean = false): number {
    const maxDD = this.calculateMaxDrawdown(trades, useGrossPL)
    const totalPL = trades.reduce((sum, t) => {
      return sum + (useGrossPL ? t.pl - t.commission : t.pl)
    }, 0)

    if (totalPL <= 0) return 0

    return (maxDD / (totalPL + maxDD)) * 100
  }

  /**
   * Get cumulative P&L over time
   */
  static getCumulativePL(trades: Trade[]): Array<{ date: Date; pl: number }> {
    let cumulativePL = 0
    return trades.map(trade => {
      cumulativePL += trade.pl
      return {
        date: trade.exitDate || trade.entryDate,
        pl: cumulativePL
      }
    })
  }

  /**
   * Get daily P&L aggregation
   */
  static getDailyPL(trades: Trade[]): Array<{ date: string; pl: number; trades: number }> {
    const dailyMap = new Map<string, { pl: number; count: number }>()

    for (const trade of trades) {
      const date = (trade.exitDate || trade.entryDate).toISOString().split('T')[0]
      const existing = dailyMap.get(date) || { pl: 0, count: 0 }
      dailyMap.set(date, {
        pl: existing.pl + trade.pl,
        count: existing.count + 1
      })
    }

    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        pl: data.pl,
        trades: data.count
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * Get performance by symbol
   */
  static getPerformanceBySymbol(trades: Trade[]) {
    const symbolMap = new Map<string, Trade[]>()

    for (const trade of trades) {
      if (!symbolMap.has(trade.symbol)) {
        symbolMap.set(trade.symbol, [])
      }
      symbolMap.get(trade.symbol)!.push(trade)
    }

    return Array.from(symbolMap.entries()).map(([symbol, symbolTrades]) => {
      const winners = symbolTrades.filter(t => t.pl > 0)
      const losers = symbolTrades.filter(t => t.pl < 0)
      return {
        symbol,
        totalTrades: symbolTrades.length,
        winRate: symbolTrades.length > 0 ? (winners.length / symbolTrades.length) * 100 : 0,
        totalPL: symbolTrades.reduce((sum, t) => sum + t.pl, 0),
        averageWin: winners.length > 0
          ? winners.reduce((sum, t) => sum + t.pl, 0) / winners.length
          : 0,
        averageLoss: losers.length > 0
          ? losers.reduce((sum, t) => sum + t.pl, 0) / losers.length
          : 0
      }
    }).sort((a, b) => b.totalPL - a.totalPL)
  }

  /**
   * Return empty metrics structure
   */
  private static getEmptyMetrics(): TradingMetrics {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      breakevenTrades: 0,
      winRate: 0,
      averageWin: 0,
      averageLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      profitFactor: 0,
      expectancy: 0,
      totalPL: 0,
      grossPL: 0,
      grossProfit: 0,
      grossLoss: 0,
      totalCommission: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0
    }
  }
}
