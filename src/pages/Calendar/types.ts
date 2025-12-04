export type ViewType = 'daily' | 'weekly' | 'monthly'
export type WeeklyGrouping = 'quarterly' | 'yearly'

export interface DailyPLData {
  tradingDay: string
  pl: number
  commissions: number
  trades: number
  isCurrentMonth: boolean
  isHoliday?: boolean
  holidayName?: string
}

export interface WeeklyPL {
  pl: number
  commissions: number
  trades: number
  days: number
}

export interface WeekData {
  year: number
  weekNum: number
  days: (DailyPLData | null)[]
  weeklyPL?: WeeklyPL
}

export interface MonthCalendarData {
  year: number
  month: number
  monthName: string
  weeks: WeekData[]
}

// Data for weekly view cards
export interface WeeklySummary {
  year: number
  weekNum: number
  startDate: string
  endDate: string
  pl: number
  commissions: number
  trades: number
  tradingDays: number
}

// Data for monthly view cards
export interface MonthlySummary {
  year: number
  month: number
  monthName: string
  pl: number
  commissions: number
  trades: number
  tradingDays: number
}
