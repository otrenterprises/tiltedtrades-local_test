// Tick values - loaded dynamically for local testing
// In production, contract specs come from the API
let tickValues: Record<string, ContractSpec> = {}

// Try to load local tick values (only works in dev with local assets)
try {
  const loadTickValues = async () => {
    try {
      const module = await import('@/assets/tick-values.json')
      tickValues = module.default as Record<string, ContractSpec>
    } catch {
      // File doesn't exist in production - use empty defaults
    }
  }
  loadTickValues()
} catch {
  // Static import failed - use defaults
}

export interface ContractSpec {
  symbol: string
  name: string
  exchange: string
  category: string
  currency: string
  contractSize: string
  tickSize: number
  tickDescription: string
  valuePerTick: number
  multiplier: number
  pointValue: number  // Dollars per 1.0 point move
  tradingHours: string
  contractMonths: string
}

export class ContractSpecsCalculator {
  private static specs: Record<string, ContractSpec> = {}

  /**
   * Initialize contract specifications from enhanced JSON data
   */
  static initialize() {
    for (const [symbol, data] of Object.entries(tickValues)) {
      // The enhanced JSON already has all fields including pointValue
      // Just use the data directly
      this.specs[symbol] = {
        symbol: data.symbol || symbol,
        name: data.name,
        exchange: data.exchange || 'Unknown',
        category: data.category || 'Unknown',
        currency: data.currency || 'USD',
        contractSize: data.contractSize || '',
        tickSize: data.tickSize,
        tickDescription: data.tickDescription || '',
        valuePerTick: data.valuePerTick,
        multiplier: data.multiplier,
        pointValue: data.pointValue,
        tradingHours: data.tradingHours || '',
        contractMonths: data.contractMonths || ''
      }
    }
  }

  /**
   * Get the point value for a symbol (dollars per 1.0 point move)
   * @param symbol - Trading symbol
   * @returns Point value in dollars
   */
  static getPointValue(symbol: string): number {
    if (Object.keys(this.specs).length === 0) {
      this.initialize()
    }

    const spec = this.specs[symbol]
    if (!spec) {
      console.warn(`No contract spec found for symbol: ${symbol}, using default $1 per point`)
      return 1
    }

    return spec.pointValue
  }

  /**
   * Get full contract specification
   */
  static getSpec(symbol: string): ContractSpec | null {
    if (Object.keys(this.specs).length === 0) {
      this.initialize()
    }

    return this.specs[symbol] || null
  }

  /**
   * Get all available symbols
   */
  static getAllSymbols(): string[] {
    if (Object.keys(this.specs).length === 0) {
      this.initialize()
    }

    return Object.keys(this.specs)
  }

  /**
   * Check if symbol is supported
   */
  static isSupported(symbol: string): boolean {
    if (Object.keys(this.specs).length === 0) {
      this.initialize()
    }

    return symbol in this.specs
  }
}
