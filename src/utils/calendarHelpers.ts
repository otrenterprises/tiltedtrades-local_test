import { Execution } from '@/types/execution.types'
import { format, parseISO, getDay, getISOWeek, getISOWeekYear, startOfMonth, endOfMonth, eachDayOfInterval, addDays, subDays } from 'date-fns'

export interface DailyPLData {
  date: string // YYYY-MM-DD format
  tradingDay: string // YYYY-MM-DD format
  pl: number
  trades: number
  commissions: number
  weekNum: number
  dayOfWeek: number // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  isHoliday: boolean
  holidayName?: string
  isCurrentMonth?: boolean // Whether this day belongs to the current month in focus
}

export interface WeeklyPLData {
  weekNum: number
  year: number
  pl: number
  trades: number
  days: number
  commissions: number
}

// CME Market Holidays for 2024 when day session is closed
const MARKET_HOLIDAYS_2024: { [key: string]: string } = {
  '2024-01-01': 'New Year\'s Day',
  '2024-03-29': 'Good Friday',
  '2024-05-27': 'Memorial Day',
  '2024-06-19': 'Juneteenth',
  '2024-07-04': 'Independence Day',
  '2024-09-02': 'Labor Day',
  '2024-11-28': 'Thanksgiving',
  '2024-12-25': 'Christmas',
}

/**
 * Check if a date is a market holiday
 */
export function isMarketHoliday(date: string): { isHoliday: boolean; holidayName?: string } {
  const holidayName = MARKET_HOLIDAYS_2024[date]
  return {
    isHoliday: !!holidayName,
    holidayName,
  }
}

/**
 * Aggregate executions by trading day
 */
export function aggregateDailyPL(executions: Execution[]): Map<string, DailyPLData> {
  const dailyMap = new Map<string, DailyPLData>()

  executions.forEach((exec) => {
    if (!exec.TradingDay) return

    const tradingDay = exec.TradingDay
    const date = parseISO(tradingDay)
    const dayOfWeek = getDay(date)
    const weekNum = exec.WeekNum || getISOWeek(date)

    // Skip weekends (Saturday = 6, Sunday = 0)
    if (dayOfWeek === 0 || dayOfWeek === 6) return

    const existing = dailyMap.get(tradingDay)
    const pl = exec.PnLPerPosition || 0
    const fees = exec.Fees || 0
    const holiday = isMarketHoliday(tradingDay)

    if (existing) {
      existing.pl += pl
      existing.trades++
      existing.commissions += fees
    } else {
      dailyMap.set(tradingDay, {
        date: tradingDay,
        tradingDay,
        pl,
        trades: 1,
        commissions: fees,
        weekNum,
        dayOfWeek,
        isHoliday: holiday.isHoliday,
        holidayName: holiday.holidayName,
      })
    }
  })

  return dailyMap
}

/**
 * Aggregate executions by week number
 */
export function aggregateWeeklyPL(executions: Execution[]): Map<number, WeeklyPLData> {
  const weeklyMap = new Map<number, WeeklyPLData>()
  const daysPerWeek = new Map<number, Set<string>>()

  executions.forEach((exec) => {
    if (!exec.TradingDay || !exec.WeekNum) return

    const weekNum = exec.WeekNum
    const pl = exec.PnLPerPosition || 0
    const fees = exec.Fees || 0
    const year = parseISO(exec.TradingDay).getFullYear()

    // Track unique trading days per week
    if (!daysPerWeek.has(weekNum)) {
      daysPerWeek.set(weekNum, new Set())
    }
    daysPerWeek.get(weekNum)!.add(exec.TradingDay)

    const existing = weeklyMap.get(weekNum)

    if (existing) {
      existing.pl += pl
      existing.trades++
      existing.commissions += fees
    } else {
      weeklyMap.set(weekNum, {
        weekNum,
        year,
        pl,
        trades: 1,
        days: 0, // Will be set after loop
        commissions: fees,
      })
    }
  })

  // Update days count for each week
  weeklyMap.forEach((weekData, weekNum) => {
    weekData.days = daysPerWeek.get(weekNum)?.size || 0
  })

  return weeklyMap
}

/**
 * Get calendar data grouped by month and week
 */
export interface MonthCalendarData {
  month: string // YYYY-MM format
  monthName: string // "January 2024"
  weeks: WeekCalendarData[]
}

export interface WeekCalendarData {
  weekNum: number
  year: number // Year this week belongs to (important for Week 1 which can span years)
  days: (DailyPLData | null)[] // 5 elements for Mon-Fri, null for missing days
  weeklyPL?: WeeklyPLData
}

export function getCalendarData(
  executions: Execution[],
  year: number = 2024
): MonthCalendarData[] {
  const dailyMap = aggregateDailyPL(executions)
  const weeklyMap = aggregateWeeklyPL(executions)

  // Get all unique months from the data
  const monthsSet = new Set<string>()
  dailyMap.forEach((data) => {
    const month = data.tradingDay.substring(0, 7) // YYYY-MM
    const dataYear = parseInt(data.tradingDay.substring(0, 4))
    if (dataYear === year) {
      monthsSet.add(month)
    }
  })

  const months = Array.from(monthsSet).sort()

  return months.map((month) => {
    const monthDate = parseISO(`${month}-01`)
    const monthName = format(monthDate, 'MMMM yyyy')

    // Get all days for this month
    const daysInMonth = Array.from(dailyMap.values()).filter(
      (d) => d.tradingDay.startsWith(month)
    )

    // Group by week
    const weeksMap = new Map<number, (DailyPLData | null)[]>()

    daysInMonth.forEach((dayData) => {
      const weekNum = dayData.weekNum
      if (!weeksMap.has(weekNum)) {
        // Initialize week with 5 nulls (Mon-Fri)
        weeksMap.set(weekNum, [null, null, null, null, null])
      }

      const weekDays = weeksMap.get(weekNum)!
      // dayOfWeek: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri
      const index = dayData.dayOfWeek - 1
      if (index >= 0 && index < 5) {
        weekDays[index] = dayData
      }
    })

    // Convert to array and sort by week number
    const weeks = Array.from(weeksMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([weekNum, days]) => {
        const weeklyPL = weeklyMap.get(weekNum)
        return {
          weekNum,
          year: weeklyPL?.year || year, // Use year from weekly data or default to the requested year
          days,
          weeklyPL,
        }
      })

    return {
      month,
      monthName,
      weeks,
    }
  })
}

/**
 * Get color intensity based on P&L amount
 * Returns a value from 0-100 representing color intensity
 */
export function getPLIntensity(pl: number, maxAbsPL: number): number {
  if (maxAbsPL === 0) return 0
  const intensity = Math.abs(pl) / maxAbsPL
  return Math.min(Math.round(intensity * 100), 100)
}

/**
 * Get the maximum absolute P&L value for intensity scaling
 */
export function getMaxAbsPL(dailyData: Map<string, DailyPLData>): number {
  let maxAbs = 0
  dailyData.forEach((data) => {
    const abs = Math.abs(data.pl)
    if (abs > maxAbs) {
      maxAbs = abs
    }
  })
  return maxAbs
}

/**
 * Get list of available months with trading data
 */
export function getAvailableMonths(executions: Execution[]): Array<{ year: number; month: number }> {
  const monthsSet = new Set<string>()

  executions.forEach((exec) => {
    if (exec.TradingDay) {
      const monthStr = exec.TradingDay.substring(0, 7) // YYYY-MM
      monthsSet.add(monthStr)
    }
  })

  const months = Array.from(monthsSet)
    .sort()
    .map((monthStr) => {
      const [year, month] = monthStr.split('-').map(Number)
      return { year, month: month - 1 } // Convert to 0-indexed month
    })

  return months
}

/**
 * Get calendar data for a specific month with full weeks
 * Includes days from previous/next month to fill partial weeks
 */
export function getMonthCalendarData(
  executions: Execution[],
  year: number,
  month: number // 0-indexed (0 = January, 11 = December)
): MonthCalendarData {
  const dailyMap = aggregateDailyPL(executions)
  const weeklyMap = aggregateWeeklyPL(executions)

  // Get the first and last day of the month
  const monthStart = new Date(year, month, 1)
  const monthEnd = endOfMonth(monthStart)
  const monthName = format(monthStart, 'MMMM yyyy')
  const monthStr = format(monthStart, 'yyyy-MM')

  // Get the day of week for first and last day (0 = Sunday, 1 = Monday, etc.)
  const firstDayOfWeek = getDay(monthStart)
  const lastDayOfWeek = getDay(monthEnd)

  // Calculate how many days to add before and after
  // We want weeks to start on Monday (1)
  const daysBeforeMonth = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1 // If Sunday, go back 6 days; otherwise go back to Monday
  const daysAfterMonth = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek // Days to add to reach Sunday

  // Get start and end dates including padding
  const calendarStart = subDays(monthStart, daysBeforeMonth)
  const calendarEnd = addDays(monthEnd, daysAfterMonth)

  // Get all days in the calendar range
  const allDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  // Group days by year+week (use string key to handle year boundary)
  const weeksMap = new Map<string, { weekNum: number; year: number; days: (DailyPLData | null)[] }>()

  allDays.forEach((date) => {
    const dayOfWeek = getDay(date)

    // Skip weekends (Saturday = 6, Sunday = 0)
    if (dayOfWeek === 0 || dayOfWeek === 6) return

    const dateStr = format(date, 'yyyy-MM-dd')
    const weekNum = getISOWeek(date)
    const weekYear = getISOWeekYear(date) // Use ISO week-numbering year (e.g., Dec 29, 2024 is in week year 2025)
    const weekKey = `${weekYear}-W${String(weekNum).padStart(2, '0')}` // Composite key: "2024-W48" or "2025-W01" (padded for correct sorting)
    const isCurrentMonth = date >= monthStart && date <= monthEnd

    // Get trading data for this day if it exists
    let dayData = dailyMap.get(dateStr)

    // If no trading data exists, create placeholder
    if (!dayData) {
      const holiday = isMarketHoliday(dateStr)
      dayData = {
        date: dateStr,
        tradingDay: dateStr,
        pl: 0,
        trades: 0,
        commissions: 0,
        weekNum,
        dayOfWeek,
        isHoliday: holiday.isHoliday,
        holidayName: holiday.holidayName,
        isCurrentMonth,
      }
    } else {
      // Add isCurrentMonth flag to existing data
      dayData = { ...dayData, isCurrentMonth }
    }

    // Initialize week array if needed
    if (!weeksMap.has(weekKey)) {
      weeksMap.set(weekKey, {
        weekNum,
        year: weekYear,
        days: [null, null, null, null, null]
      })
    }

    // Add day to appropriate position (Mon=0, Tue=1, ..., Fri=4)
    const weekData = weeksMap.get(weekKey)!
    const index = dayOfWeek - 1
    if (index >= 0 && index < 5) {
      weekData.days[index] = dayData
    }
  })

  // Convert to array and sort by year and week number
  const weeks = Array.from(weeksMap.entries())
    .sort(([a], [b]) => a.localeCompare(b)) // Sort by "YYYY-WNN" string
    .map(([weekKey, weekData]) => {
      // Calculate weekly totals from actual days shown in this week
      let weeklyPL = 0
      let weeklyTrades = 0
      let weeklyDays = 0
      let weeklyCommissions = 0

      weekData.days.forEach((day) => {
        if (day && day.trades > 0) {
          weeklyPL += day.pl
          weeklyTrades += day.trades
          weeklyDays++
          weeklyCommissions += day.commissions
        }
      })

      return {
        weekNum: weekData.weekNum,
        year: weekData.year,
        days: weekData.days,
        weeklyPL: weeklyTrades > 0 ? {
          weekNum: weekData.weekNum,
          year: weekData.year,
          pl: weeklyPL,
          trades: weeklyTrades,
          days: weeklyDays,
          commissions: weeklyCommissions,
        } : undefined,
      }
    })
    .filter((week) => {
      // Only include weeks that have at least one day in the current month
      const hasCurrentMonthDay = week.days.some(day => day && day.isCurrentMonth)
      return hasCurrentMonthDay
    })

  return {
    month: monthStr,
    monthName,
    weeks,
  }
}
