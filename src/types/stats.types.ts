export interface TradingMetrics {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  breakevenTrades: number
  winRate: number
  averageWin: number
  averageLoss: number
  largestWin: number
  largestLoss: number
  profitFactor: number
  expectancy: number
  totalPL: number  // Net P&L (includes commission)
  grossPL: number  // Gross P&L (before commission)
  grossProfit: number
  grossLoss: number
  totalCommission: number  // Total commission paid
  maxDrawdown: number
  maxDrawdownPercent: number
  consecutiveWins?: number  // Optional: current winning streak
  consecutiveLosses?: number  // Optional: current losing streak
}

export interface DailyPL {
  date: Date
  pl: number
  trades: number
}

export interface SymbolPerformance {
  symbol: string
  totalTrades: number
  winRate: number
  totalPL: number
  averageWin: number
  averageLoss: number
}
