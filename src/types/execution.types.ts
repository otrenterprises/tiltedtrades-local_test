export interface Execution {
  Date: string
  OrderExecID: string | number
  OrderType: 'Limit' | 'Stop' | 'Market'
  WeekNum: number
  GWOrderID: number
  Description: string
  Quantity: number
  Side: 'Buy' | 'Sell'
  PositionEffect: number
  DBKey: number
  TickerConversion: string
  CQGSymbol: string
  Time: string
  ExecutionPrice: number
  FullCQGSymbol: string
  Exchange: string
  TradingDay: string
  ContractExpiration: string
  ExchangeConfirmation: number
  // New fields
  Account?: string
  Fees?: number
  PositionQty?: number
  Status?: string
  PnLPerPosition?: number
  NotionalValue?: number
}

export interface Trade {
  id: string
  symbol: string
  side: 'Long' | 'Short'
  entryDate: Date
  exitDate: Date | null
  tradingDay?: string // YYYY-MM-DD - Official trading day (may differ from calendar date for futures)
  entryPrice: number
  exitPrice: number | null
  quantity: number
  pl: number
  plPercent: number
  duration: number // in minutes
  executions: Execution[]
  commission: number
  status: 'open' | 'closed'
  notes?: string
  tags?: string[]
  hasCommissionOverride?: boolean // True if commission has been overridden via journal
  hasJournal?: boolean // True if a journal entry exists for this trade
}
