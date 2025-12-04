// Commission data - loaded dynamically for local testing
// In production, commissions come from the API
let commissionsData: Record<string, { rates: Record<string, SymbolCommission> }> = {
  AMP: { rates: {} }
}

// Try to load local commission data (only works in dev with local assets)
try {
  // Dynamic import wrapped in try-catch for production builds
  const loadCommissions = async () => {
    try {
      const module = await import('@/assets/commissions.json')
      commissionsData = module.default as typeof commissionsData
    } catch {
      // File doesn't exist in production - use empty defaults
    }
  }
  loadCommissions()
} catch {
  // Static import failed - use defaults
}

export interface CommissionTier {
  '1': number  // < 1,000 contracts/month
  '2': number  // 1,001-4,999 contracts/month
  '3': number  // 5,000-9,999 contracts/month
  '4': number  // > 10,000 contracts/month
}

export interface SymbolCommission {
  name: string
  exchange: string
  currency: string
  tiers: CommissionTier
}

export class CommissionCalculator {
  // Current brokerage (can be changed to support multiple brokerages)
  private static readonly BROKERAGE = 'AMP'

  // Transition date: October 14, 2024
  private static readonly FIXED_COMMISSION_START_DATE = new Date('2024-10-14')

  // Cache for monthly volumes (for variable commission calculation)
  private static monthlyVolumes: Map<string, number> = new Map()
  private static isInitialized = false

  /**
   * Initialize monthly volume tracking for variable commission period
   * This must be called before calculating commissions
   */
  static initializeMonthlyVolumes(trades: Array<{ exitDate: Date; quantity: number }>) {
    this.monthlyVolumes.clear()

    // Only track volumes for trades before fixed commission date
    const variableTrades = trades.filter(t => t.exitDate < this.FIXED_COMMISSION_START_DATE)

    for (const trade of variableTrades) {
      const monthKey = this.getMonthKey(trade.exitDate)
      const currentVolume = this.monthlyVolumes.get(monthKey) || 0
      this.monthlyVolumes.set(monthKey, currentVolume + trade.quantity)
    }

    this.isInitialized = true

    // console.log('Commission - Monthly Volumes Initialized:')
    // for (const [month, volume] of this.monthlyVolumes.entries()) {
    //   const tier = this.getVolumeTier(volume)
    //   console.log(`  ${month}: ${volume} contracts → ${tier} tier`)
    // }
  }

  /**
   * Get month key in YYYY-MM format
   */
  private static getMonthKey(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }

  /**
   * Determine which volume tier a monthly volume falls into
   */
  private static getVolumeTier(monthlyVolume: number): keyof CommissionTier {
    if (monthlyVolume < 1000) return '1'       // < 1,000 contracts/month
    if (monthlyVolume <= 4999) return '2'      // 1,001-4,999 contracts/month
    if (monthlyVolume <= 9999) return '3'      // 5,000-9,999 contracts/month
    return '4'                                  // > 10,000 contracts/month
  }

  /**
   * Get commission rate for a symbol at a specific date
   * @param symbol - Trading symbol
   * @param tradeDate - Date of the trade exit
   * @returns Commission rate per contract per side
   */
  private static getCommissionRate(
    symbol: string,
    tradeDate: Date
  ): number {
    const symbolData = (commissionsData[this.BROKERAGE].rates as Record<string, SymbolCommission>)[symbol]

    if (!symbolData) {
      console.warn(`No commission data for symbol: ${symbol} at brokerage: ${this.BROKERAGE}`)
      return 0
    }

    // Fixed commission period (from Oct 14, 2024 onwards)
    // Uses tier 3 (5,000-9,999 contracts/month tier)
    if (tradeDate >= this.FIXED_COMMISSION_START_DATE) {
      return symbolData.tiers['3']
    }

    // Variable commission period (before Oct 14, 2024)
    if (!this.isInitialized) {
      // Silently use default tier 3 when not initialized
      return symbolData.tiers['3']
    }

    const monthKey = this.getMonthKey(tradeDate)
    const monthlyVolume = this.monthlyVolumes.get(monthKey) || 0
    const tier = this.getVolumeTier(monthlyVolume)

    return symbolData.tiers[tier]
  }

  /**
   * Calculate commission for a completed trade
   * Commissions are PER SIDE, so round-trip = 2x the rate
   *
   * @param symbol - Trading symbol
   * @param quantity - Number of contracts
   * @param tradeDate - Date of trade exit
   * @returns Commission cost (always negative)
   */
  static calculateCommission(
    symbol: string,
    quantity: number,
    tradeDate: Date
  ): number {
    const ratePerSide = this.getCommissionRate(symbol, tradeDate)

    // Round-trip commission = 2 sides (entry + exit)
    const roundTripRate = ratePerSide * 2

    // Commission is always a cost (negative)
    return -(roundTripRate * quantity)
  }

  /**
   * Get the rate for a specific symbol at a specific date
   */
  static getRate(symbol: string, tradeDate: Date = new Date()): number {
    const symbolData = (commissionsData[this.BROKERAGE].rates as Record<string, SymbolCommission>)[symbol]

    if (!symbolData) {
      return 0
    }

    if (tradeDate >= this.FIXED_COMMISSION_START_DATE) {
      return symbolData.tiers['3']
    }

    // For variable period, return tier 3 (5,000-9,999) as default
    return symbolData.tiers['3']
  }

  /**
   * Get commission tier information
   */
  static getCommissionInfo(symbol: string): SymbolCommission | null {
    return (commissionsData[this.BROKERAGE].rates as Record<string, SymbolCommission>)[symbol] || null
  }

  /**
   * Check if a date is in the fixed commission period
   */
  static isFixedCommissionPeriod(date: Date): boolean {
    return date >= this.FIXED_COMMISSION_START_DATE
  }

  /**
   * Get all available symbols with commission data
   */
  static getAllSymbols(): string[] {
    return Object.keys(commissionsData[this.BROKERAGE].rates)
  }

  /**
   * Reset initialization (useful for testing)
   */
  static reset() {
    this.monthlyVolumes.clear()
    this.isInitialized = false
  }
}
