import { Execution, Trade } from '@/types/execution.types'
import { CommissionCalculator } from './commission'
import { ContractSpecsCalculator } from './contractSpecs'
import { LocalBalanceService } from '@/services/LocalBalanceService'

export type CalculationMethod = 'fifo' | 'perPosition'

export class TradeMatchingEngine {
  /**
   * Create a Date object from date and time strings without timezone conversion
   * Handles both "YYYY-MM-DD" and "M/D/YYYY" date formats
   *
   * IMPORTANT: For futures trading, use TradingDay instead of Date field to properly
   * attribute trades to the correct trading session (e.g., Sunday night trades
   * attributed to Monday's session)
   */
  private static createLocalDate(dateStr: string, timeStr: string): Date {
    // Parse date components
    let year: number, month: number, day: number

    if (dateStr.includes('-')) {
      // ISO format: YYYY-MM-DD
      const [y, m, d] = dateStr.split('-').map(Number)
      year = y
      month = m - 1 // JS months are 0-indexed
      day = d
    } else {
      // US format: M/D/YYYY
      const [m, d, y] = dateStr.split('/').map(Number)
      year = y
      month = m - 1 // JS months are 0-indexed
      day = d
    }

    // Parse time components
    const [hours, minutes, seconds] = timeStr.split(':').map(Number)

    // Create date in local timezone
    return new Date(year, month, day, hours, minutes, seconds || 0)
  }
  /**
   * Match executions into complete trades
   * Supports two calculation methods:
   * - FIFO: Match trades chronologically (First In First Out)
   * - Per Position: Use broker's PnLPerPosition data
   *
   * Two-pass approach:
   * 1. Match trades and calculate gross P&L
   * 2. Initialize monthly volumes and calculate commissions (FIFO only)
   */
  static async matchTrades(executions: Execution[], method: CalculationMethod = 'fifo'): Promise<Trade[]> {
    // console.log(`🔧 TradeMatchingEngine.matchTrades() START - Method: ${method}, Executions: ${executions.length}`)
    // const startTime = performance.now()

    const trades: Trade[] = []
    const symbolGroups = this.groupBySymbol(executions)
    // console.log(`  ✓ Grouped into ${symbolGroups.size} symbols`)

    // First pass: Match trades based on calculation method
    // const matchStartTime = performance.now()
    for (const [symbol, execs] of symbolGroups.entries()) {
      const symbolTrades = method === 'fifo'
        ? await this.matchSymbolTrades(symbol, execs)
        : await this.matchSymbolTradesPerPosition(symbol, execs)
      trades.push(...symbolTrades)
    }
    // console.log(`  ✓ Matched ${trades.length} trades in ${(performance.now() - matchStartTime).toFixed(2)}ms`)

    // Sort trades by entry date
    trades.sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime())


    // Second pass: Initialize monthly volumes and calculate commissions for ALL methods
    // This ensures consistent commission calculation between FIFO and Per Position
    // const commissionStartTime = performance.now()
    CommissionCalculator.initializeMonthlyVolumes(
      trades.map(t => ({
        exitDate: t.exitDate!,
        quantity: t.quantity
      }))
    )

    // Third pass: Update commissions for all trades using calculated commission
    for (const trade of trades) {
      if (trade.exitDate) {
        const commission = CommissionCalculator.calculateCommission(
          trade.symbol,
          trade.quantity,
          trade.exitDate
        )

        // Recalculate P&L with commission
        const grossPL = trade.pl - trade.commission // Remove old commission (broker fees or previous calc)
        trade.commission = commission
        trade.pl = grossPL + commission // Add new calculated commission
      }
    }
    // console.log(`  ✓ Calculated commissions in ${(performance.now() - commissionStartTime).toFixed(2)}ms`)

    // const totalTime = performance.now() - startTime
    // console.log(`🔧 TradeMatchingEngine.matchTrades() COMPLETE - ${totalTime.toFixed(2)}ms`)
    return trades
  }

  /**
   * Group executions by symbol and sort by DBKey (chronological order)
   */
  private static groupBySymbol(executions: Execution[]): Map<string, Execution[]> {
    const groups = new Map<string, Execution[]>()

    for (const exec of executions) {
      const symbol = exec.TickerConversion
      if (!groups.has(symbol)) {
        groups.set(symbol, [])
      }
      groups.get(symbol)!.push(exec)
    }

    // Sort each group by DBKey (transaction ID) for proper chronological order
    for (const execs of groups.values()) {
      execs.sort((a, b) => {
        // DBKey is the authoritative chronological order
        const dbKeyA = typeof a.DBKey === 'number' ? a.DBKey : Number(a.DBKey)
        const dbKeyB = typeof b.DBKey === 'number' ? b.DBKey : Number(b.DBKey)
        return dbKeyA - dbKeyB
      })
    }

    return groups
  }

  /**
   * Match trades for a specific symbol using FIFO based on PositionEffect
   */
  private static async matchSymbolTrades(symbol: string, executions: Execution[]): Promise<Trade[]> {
    const trades: Trade[] = []
    let tradeCounter = 0 // Counter to ensure unique IDs

    // Track open positions with remaining quantity
    // We need to handle both long and short positions:
    // - Buy to Open Long: PositionEffect > 0, Side = Buy → Add to queue
    // - Sell to Close Long: PositionEffect < 0, Side = Sell → Match from queue
    // - Sell to Open Short: PositionEffect < 0, Side = Sell → Add to queue (if no open longs)
    // - Buy to Close Short: PositionEffect > 0, Side = Buy → Match from queue (if open shorts exist)
    const openPositions: Array<{ exec: Execution; remainingQty: number }> = []

    for (const exec of executions) {
      const positionChange = exec.PositionEffect
      const quantity = Math.abs(positionChange)

      if (positionChange > 0) {
        // PositionEffect positive: could be opening long OR closing short
        if (openPositions.length > 0 && openPositions[0].exec.Side === 'Sell') {
          // We have open SHORT positions, this BUY is closing them
          let remainingToClose = quantity
          const closeExecution = exec

          while (remainingToClose > 0 && openPositions.length > 0) {
            const openPos = openPositions[0]
            const closeQuantity = Math.min(remainingToClose, openPos.remainingQty)

            const isLong = false // Closing a short = short trade
            const entryPrice = openPos.exec.ExecutionPrice
            const exitPrice = closeExecution.ExecutionPrice
            const exitDate = this.createLocalDate(closeExecution.TradingDay, closeExecution.Time)

            const commission = CommissionCalculator.calculateCommission(symbol, closeQuantity, exitDate)
            const grossPL = this.calculatePL(entryPrice, exitPrice, closeQuantity, symbol, isLong)

            const entryDate = this.createLocalDate(openPos.exec.TradingDay, openPos.exec.Time)
            const exitDateForTrade = this.createLocalDate(closeExecution.TradingDay, closeExecution.Time)

            const netPL = grossPL + commission
            const plPercent = await this.calculatePLPercent(netPL, entryDate)

            const trade: Trade = {
              id: `${openPos.exec.OrderExecID}_${closeExecution.OrderExecID}_${tradeCounter++}`,
              symbol: symbol,
              side: 'Short',
              entryDate: entryDate,
              exitDate: exitDateForTrade,
              entryPrice: entryPrice,
              exitPrice: exitPrice,
              quantity: closeQuantity,
              pl: netPL,  // Net P&L = Gross P&L + Commission (commission is negative)
              plPercent: plPercent,
              duration: this.calculateDuration(entryDate, exitDateForTrade),
              executions: [openPos.exec, closeExecution],
              commission: commission,
              status: 'closed'
            }

            trades.push(trade)
            remainingToClose -= closeQuantity
            openPos.remainingQty -= closeQuantity

            if (openPos.remainingQty === 0) {
              openPositions.shift()
            }
          }

          // If still have quantity left after closing shorts, open a long
          if (remainingToClose > 0) {
            openPositions.push({ exec: exec, remainingQty: remainingToClose })
          }
        } else {
          // Opening a LONG position
          openPositions.push({ exec: exec, remainingQty: quantity })
        }
      } else if (positionChange < 0) {
        // PositionEffect negative: could be closing long OR opening short
        if (openPositions.length > 0 && openPositions[0].exec.Side === 'Buy') {
          // We have open LONG positions, this SELL is closing them
          let remainingToClose = quantity
          const closeExecution = exec

          while (remainingToClose > 0 && openPositions.length > 0) {
            const openPos = openPositions[0]
            const closeQuantity = Math.min(remainingToClose, openPos.remainingQty)

            const isLong = true // Closing a long = long trade
            const entryPrice = openPos.exec.ExecutionPrice
            const exitPrice = closeExecution.ExecutionPrice
            const exitDate = this.createLocalDate(closeExecution.TradingDay, closeExecution.Time)

            const commission = CommissionCalculator.calculateCommission(symbol, closeQuantity, exitDate)
            const grossPL = this.calculatePL(entryPrice, exitPrice, closeQuantity, symbol, isLong)

            const entryDate = this.createLocalDate(openPos.exec.TradingDay, openPos.exec.Time)
            const exitDateForTrade = this.createLocalDate(closeExecution.TradingDay, closeExecution.Time)

            const netPL = grossPL + commission
            const plPercent = await this.calculatePLPercent(netPL, entryDate)

            const trade: Trade = {
              id: `${openPos.exec.OrderExecID}_${closeExecution.OrderExecID}_${tradeCounter++}`,
              symbol: symbol,
              side: 'Long',
              entryDate: entryDate,
              exitDate: exitDateForTrade,
              entryPrice: entryPrice,
              exitPrice: exitPrice,
              quantity: closeQuantity,
              pl: netPL,  // Net P&L = Gross P&L + Commission (commission is negative)
              plPercent: plPercent,
              duration: this.calculateDuration(entryDate, exitDateForTrade),
              executions: [openPos.exec, closeExecution],
              commission: commission,
              status: 'closed'
            }

            trades.push(trade)
            remainingToClose -= closeQuantity
            openPos.remainingQty -= closeQuantity

            if (openPos.remainingQty === 0) {
              openPositions.shift()
            }
          }

          // If still have quantity left after closing longs, open a short
          if (remainingToClose > 0) {
            openPositions.push({ exec: exec, remainingQty: remainingToClose })
          }
        } else {
          // Opening a SHORT position
          openPositions.push({ exec: exec, remainingQty: quantity })
        }
      }
    }

    // Warn about any unclosed positions
    if (openPositions.length > 0) {
      const totalOpen = openPositions.reduce((sum, pos) => sum + pos.remainingQty, 0)
      console.warn(`Symbol ${symbol}: ${totalOpen} contracts still open (not closed yet)`)
    }

    return trades
  }

  /**
   * Calculate P&L based on contract specifications from tick-values.json
   */
  private static calculatePL(
    entryPrice: number,
    exitPrice: number,
    quantity: number,
    symbol: string,
    isLong: boolean
  ): number {
    // Get point value from contract specifications
    const pointValue = ContractSpecsCalculator.getPointValue(symbol)

    // For long positions: profit when exit > entry
    // For short positions: profit when entry > exit
    const points = isLong ? (exitPrice - entryPrice) : (entryPrice - exitPrice)

    return points * pointValue * quantity
  }

  /**
   * Calculate trade duration in minutes
   */
  private static calculateDuration(entry: Date, exit: Date): number {
    return Math.floor((exit.getTime() - entry.getTime()) / (1000 * 60))
  }

  /**
   * Calculate P&L percentage based on account balance at entry
   * Returns percentage of P&L relative to account balance
   */
  private static async calculatePLPercent(pl: number, entryDate: Date): Promise<number> {
    try {
      // Get balance at the time of trade entry
      const balance = await LocalBalanceService.getBalanceAtDate(entryDate)

      if (balance > 0) {
        // P&L as percentage of account balance at entry
        return (pl / balance) * 100
      }
    } catch (error) {
      console.warn('Could not get balance for percentage calculation:', error)
    }

    // Fallback to 0 if no balance available
    return 0
  }

  /**
   * Match trades using Per Position method
   * This method uses Status field ("To Open"/"To Close") and PnLPerPosition from broker.
   *
   * Logic:
   * - "To Open XXX" = Start of a position
   * - Collect all executions until PositionQty = 0 (position closes)
   * - PnLPerPosition at close = Net P&L for entire position
   * - Sum all Fees from open to close
   * - Quantity = total quantity traded
   */
  private static async matchSymbolTradesPerPosition(symbol: string, executions: Execution[]): Promise<Trade[]> {
    const trades: Trade[] = []
    let tradeCounter = 0 // Counter to ensure unique IDs
    let openPositionExecs: Execution[] = []
    let positionSide: 'Long' | 'Short' | null = null
    let inPosition = false

    for (const exec of executions) {
      const status = exec.Status || ''
      const positionQty = exec.PositionQty ?? 0

      // Check for "To Open" status - start of a new position
      if (status.includes('To Open')) {
        // If we were already in a position, something went wrong
        if (inPosition && openPositionExecs.length > 0) {
          console.warn(`${symbol}: Found 'To Open' while position already open. Creating incomplete trade.`)
          const incompleteTrade = await this.createTradeFromPosition(symbol, openPositionExecs, positionSide!, tradeCounter++)
          if (incompleteTrade) trades.push(incompleteTrade)
        }

        // Start new position
        openPositionExecs = [exec]
        positionSide = exec.Side === 'Buy' ? 'Long' : 'Short'
        inPosition = true
      }
      // In an open position - accumulate executions
      else if (inPosition) {
        openPositionExecs.push(exec)

        // Check if position closed (PositionQty = 0)
        if (positionQty === 0) {
          // Position closed - create trade
          const trade = await this.createTradeFromPosition(symbol, openPositionExecs, positionSide!, tradeCounter++)
          if (trade) {
            trades.push(trade)
          }

          // Reset for next position
          openPositionExecs = []
          positionSide = null
          inPosition = false
        }
      }
      // Not in position and not "To Open" - might be a stray execution
      else {
        console.warn(`${symbol}: Found execution outside position (no 'To Open'). Exec: ${exec.OrderExecID}`)
      }
    }

    // Handle any unclosed positions
    if (inPosition && openPositionExecs.length > 0) {
      console.warn(`${symbol}: Position still open at end of data with ${openPositionExecs.length} executions`)
    }

    return trades
  }

  /**
   * Create a trade from a complete position lifecycle
   * Uses PnLPerPosition from the closing execution (which is NET P&L)
   *
   * Per Position Logic:
   * - Quantity = total absolute quantity of all executions
   * - Fees = sum of all fees from open to close (negative value)
   * - PnLPerPosition = Net P&L from broker (if available)
   * - Gross P&L = Net P&L - Fees (subtracting negative fees adds them back)
   */
  private static async createTradeFromPosition(
    symbol: string,
    executions: Execution[],
    side: 'Long' | 'Short',
    tradeCounter: number
  ): Promise<Trade | null> {
    if (executions.length === 0) return null

    const entryExec = executions[0]
    const exitExec = executions[executions.length - 1]

    // Separate opening and closing executions based on side
    const openingExecs = executions.filter(e =>
      (side === 'Long' && e.Side === 'Buy') || (side === 'Short' && e.Side === 'Sell')
    )
    const closingExecs = executions.filter(e =>
      (side === 'Long' && e.Side === 'Sell') || (side === 'Short' && e.Side === 'Buy')
    )

    if (openingExecs.length === 0 || closingExecs.length === 0) {
      console.warn(`Symbol ${symbol}: Could not determine opening/closing executions`)
      return null
    }

    // Calculate weighted average entry price
    let totalEntryValue = 0
    let totalEntryQty = 0
    for (const exec of openingExecs) {
      totalEntryValue += exec.ExecutionPrice * exec.Quantity
      totalEntryQty += exec.Quantity
    }
    const entryPrice = totalEntryValue / totalEntryQty

    // Calculate weighted average exit price
    let totalExitValue = 0
    let totalExitQty = 0
    for (const exec of closingExecs) {
      totalExitValue += exec.ExecutionPrice * exec.Quantity
      totalExitQty += exec.Quantity
    }
    const exitPrice = totalExitValue / totalExitQty

    // Quantity = absolute value of total quantity from open to close
    // Per your instruction: "the quantity should be the absolute value of the total quantity"
    const quantity = Math.abs(totalEntryQty)

    // Sum all fees from open to close (should be negative)
    const totalFees = executions.reduce((sum, exec) => sum + (exec.Fees ?? 0), 0)

    // Find closing execution with PnLPerPosition
    // PnLPerPosition is the GROSS P&L from the broker (before fees)
    const closingExecWithPnL = closingExecs.find(e => e.PnLPerPosition !== undefined)

    let netPL: number
    let grossPL: number

    if (closingExecWithPnL?.PnLPerPosition !== undefined) {
      // Use broker's GROSS P&L
      grossPL = closingExecWithPnL.PnLPerPosition
      // Calculate net P&L: add fees to gross (fees are negative)
      netPL = grossPL + totalFees
    } else {
      // No broker data - calculate from prices
      grossPL = this.calculatePL(entryPrice, exitPrice, quantity, symbol, side === 'Long')
      netPL = grossPL + totalFees
    }

    const entryDate = this.createLocalDate(entryExec.TradingDay, entryExec.Time)
    const exitDate = this.createLocalDate(exitExec.TradingDay, exitExec.Time)
    const plPercent = await this.calculatePLPercent(netPL, entryDate)

    const trade: Trade = {
      id: `${entryExec.OrderExecID}_${exitExec.OrderExecID}_${tradeCounter}`,
      symbol: symbol,
      side: side,
      entryDate: entryDate,
      exitDate: exitDate,
      entryPrice: entryPrice,
      exitPrice: exitPrice,
      quantity: quantity,
      pl: netPL,  // Net P&L
      plPercent: plPercent,
      duration: this.calculateDuration(entryDate, exitDate),
      executions: executions,
      commission: totalFees,
      status: 'closed'
    }

    return trade
  }
}
