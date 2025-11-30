import { BalanceEntry, BalanceData, RecurringFeeConfig } from '@/types/balance.types'
import { format, parseISO, eachMonthOfInterval, setDate, isAfter, isBefore } from 'date-fns'

/**
 * LocalBalanceService
 *
 * Manages account balance entries with support for:
 * - Deposits, withdrawals, and fees
 * - Recurring fees (monthly on specific day)
 * - Running balance calculation
 * - Balance lookups by date
 */
export class LocalBalanceService {
  private static data: BalanceData | null = null
  // private static dataFilePath = '../assets/balance-data.json'

  /**
   * Load balance data from JSON file
   */
  private static async loadData(): Promise<BalanceData> {
    if (this.data === null) {
      try {
        const module = await import('../assets/balance-data.json')
        this.data = module.default as BalanceData

        // Ensure structure exists
        if (!this.data.entries) this.data.entries = []
        if (!this.data.recurringFees) this.data.recurringFees = []

        // console.log(`✅ Loaded ${this.data.entries.length} balance entries and ${this.data.recurringFees.length} recurring fees`)
      } catch (error) {
        console.error('❌ Error loading balance data:', error)
        this.data = { entries: [], recurringFees: [] }
      }
    }
    return this.data
  }

  /**
   * Save balance data to JSON file
   * Note: In a real app, this would write to the file system.
   * For local testing, changes are stored in memory until page refresh.
   */
  // private static saveCount = 0
  // private static lastSaveLog = 0
  private static async saveData(): Promise<void> {
    if (!this.data) return

    // Sort entries by date
    this.data.entries.sort((a, b) => a.date.localeCompare(b.date))

    // Recalculate running balances
    this.recalculateBalances()

    // Save to localStorage
    localStorage.setItem('balance-data', JSON.stringify(this.data, null, 2))
  }

  /**
   * Recalculate running balances for all entries
   */
  private static recalculateBalances(): void {
    if (!this.data) return

    let runningBalance = 0
    this.data.entries.forEach(entry => {
      runningBalance += entry.amount
      entry.balance = runningBalance
    })
  }

  /**
   * Generate recurring fee entries up to a specific date
   */
  private static async generateRecurringFees(upToDate: Date): Promise<void> {
    const data = await this.loadData()
    if (data.recurringFees.length === 0) return

    const existingEntryIds = new Set(data.entries.map(e => e.id))
    const newEntries: BalanceEntry[] = []

    for (const template of data.recurringFees) {
      if (!template.recurring) continue

      const startDate = parseISO(template.date)
      const endDate = template.recurring.endDate
        ? parseISO(template.recurring.endDate)
        : upToDate

      // Generate entries for each month
      const months = eachMonthOfInterval({ start: startDate, end: endDate })

      for (const month of months) {
        // Set to the specific day of month
        const dayOfMonth = Math.min(template.recurring.dayOfMonth, new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate())
        const feeDate = setDate(month, dayOfMonth)

        // Skip if before start date or after upToDate
        if (isBefore(feeDate, startDate) || isAfter(feeDate, upToDate)) continue

        const entryId = `${template.id}_${format(feeDate, 'yyyy-MM-dd')}`

        // Skip if already exists
        if (existingEntryIds.has(entryId)) continue

        newEntries.push({
          id: entryId,
          date: format(feeDate, 'yyyy-MM-dd'),
          type: 'fee',
          amount: template.amount, // Already negative
          description: `${template.description} (Auto-generated)`,
          balance: 0, // Will be calculated
          generatedFrom: template.id
        })
      }
    }

    if (newEntries.length > 0) {
      data.entries.push(...newEntries)
      console.log(`✅ Generated ${newEntries.length} recurring fee entries`)
    }
  }

  /**
   * Get all balance entries (including auto-generated recurring fees)
   */
  static async getEntries(): Promise<BalanceEntry[]> {
    const data = await this.loadData()

    // Try to load from localStorage first (for persistence across page refreshes)
    const stored = localStorage.getItem('balance-data')
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as BalanceData
        this.data = parsed
      } catch (error) {
        console.error('Error parsing stored balance data:', error)
      }
    }

    // Generate recurring fees up to today
    await this.generateRecurringFees(new Date())
    await this.saveData()

    return this.data?.entries || []
  }

  /**
   * Get recurring fee templates
   */
  static async getRecurringFees(): Promise<BalanceEntry[]> {
    const data = await this.loadData()
    return data.recurringFees
  }

  /**
   * Add a new balance entry
   */
  static async addEntry(
    date: string,
    type: 'deposit' | 'withdrawal' | 'fee',
    amount: number,
    description: string,
    recurring?: RecurringFeeConfig
  ): Promise<BalanceEntry> {
    const data = await this.loadData()

    // Convert amount to proper sign
    let finalAmount = Math.abs(amount)
    if (type === 'withdrawal' || type === 'fee') {
      finalAmount = -finalAmount
    }

    const entry: BalanceEntry = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      date,
      type,
      amount: finalAmount,
      description,
      balance: 0, // Will be calculated
      recurring: recurring
    }

    if (recurring) {
      // Add to recurring fees templates
      data.recurringFees.push(entry)
      console.log(`✅ Added recurring fee template: ${description}`)

      // Generate entries for this recurring fee
      await this.generateRecurringFees(new Date())
    } else {
      // Add regular entry
      data.entries.push(entry)
    }

    await this.saveData()
    return entry
  }

  /**
   * Update an existing balance entry
   */
  static async updateEntry(
    id: string,
    date: string,
    type: 'deposit' | 'withdrawal' | 'fee',
    amount: number,
    description: string,
    recurring?: RecurringFeeConfig
  ): Promise<void> {
    const data = await this.loadData()

    // Convert amount to proper sign
    let finalAmount = Math.abs(amount)
    if (type === 'withdrawal' || type === 'fee') {
      finalAmount = -finalAmount
    }

    // Check if it's a recurring fee template
    const recurringIndex = data.recurringFees.findIndex(e => e.id === id)
    if (recurringIndex !== -1) {
      // Update recurring fee template
      data.recurringFees[recurringIndex] = {
        ...data.recurringFees[recurringIndex],
        date,
        type,
        amount: finalAmount,
        description,
        recurring
      }

      // Remove all auto-generated entries from this template
      data.entries = data.entries.filter(e => e.generatedFrom !== id)

      // Regenerate entries
      await this.generateRecurringFees(new Date())
    } else {
      // Update regular entry
      const index = data.entries.findIndex(e => e.id === id)
      if (index !== -1) {
        data.entries[index] = {
          ...data.entries[index],
          date,
          type,
          amount: finalAmount,
          description,
          recurring
        }
      }
    }

    await this.saveData()
  }

  /**
   * Delete a balance entry
   */
  static async deleteEntry(id: string): Promise<void> {
    const data = await this.loadData()

    // Check if it's a recurring fee template
    const recurringIndex = data.recurringFees.findIndex(e => e.id === id)
    if (recurringIndex !== -1) {
      // Remove template
      data.recurringFees.splice(recurringIndex, 1)

      // Remove all auto-generated entries from this template
      data.entries = data.entries.filter(e => e.generatedFrom !== id)
    } else {
      // Remove regular entry
      data.entries = data.entries.filter(e => e.id !== id)
    }

    await this.saveData()
  }

  /**
   * Get account balance on a specific date
   */
  static async getBalanceAtDate(date: Date | string): Promise<number> {
    const entries = await this.getEntries()
    const dateStr = typeof date === 'string' ? date : format(date, 'yyyy-MM-dd')

    // Sum all entries up to and including this date
    let balance = 0
    for (const entry of entries) {
      if (entry.date <= dateStr) {
        balance += entry.amount
      } else {
        break // Entries are sorted by date
      }
    }

    return balance
  }

  /**
   * Get current account balance
   */
  static async getCurrentBalance(): Promise<number> {
    const entries = await this.getEntries()
    if (entries.length === 0) return 0
    return entries[entries.length - 1].balance
  }

  /**
   * Get balance history for charting (funding only - deposits/withdrawals/fees)
   */
  static async getBalanceHistory(): Promise<Array<{ date: string; balance: number }>> {
    const entries = await this.getEntries()
    return entries.map(entry => ({
      date: entry.date,
      balance: entry.balance
    }))
  }

  /**
   * Get account value history including trading P&L
   * This combines funding balance with cumulative trading P&L
   */
  static async getAccountValueHistory(trades: Array<{ exitDate: Date; pl: number }>): Promise<Array<{ date: string; accountValue: number; fundingBalance: number; tradingPL: number }>> {
    const entries = await this.getEntries()
    const history: Array<{ date: string; accountValue: number; fundingBalance: number; tradingPL: number }> = []

    // Create a map of dates to funding balance
    const fundingByDate = new Map<string, number>()
    entries.forEach(entry => {
      fundingByDate.set(entry.date, entry.balance)
    })

    // Create a map of dates to cumulative trading P&L
    const tradingPLByDate = new Map<string, number>()
    let cumulativePL = 0
    trades
      .sort((a, b) => a.exitDate.getTime() - b.exitDate.getTime())
      .forEach(trade => {
        cumulativePL += trade.pl
        const dateStr = format(trade.exitDate, 'yyyy-MM-dd')
        tradingPLByDate.set(dateStr, cumulativePL)
      })

    // Get all unique dates (funding + trading)
    const allDates = new Set([...fundingByDate.keys(), ...tradingPLByDate.keys()])
    const sortedDates = Array.from(allDates).sort()

    // Build history with running values
    let lastFundingBalance = 0
    let lastTradingPL = 0

    sortedDates.forEach(date => {
      // Update funding balance if there's an entry on this date
      if (fundingByDate.has(date)) {
        lastFundingBalance = fundingByDate.get(date)!
      }

      // Update trading P&L if there's a trade on this date
      if (tradingPLByDate.has(date)) {
        lastTradingPL = tradingPLByDate.get(date)!
      }

      history.push({
        date,
        fundingBalance: lastFundingBalance,
        tradingPL: lastTradingPL,
        accountValue: lastFundingBalance + lastTradingPL
      })
    })

    return history
  }

  /**
   * Clear cached data (useful for refreshing)
   */
  static clearCache(): void {
    this.data = null
    console.log('🔄 Balance data cache cleared')
  }
}
