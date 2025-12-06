import { useMemo, useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, getISOWeek, getYear, subDays, addDays, isSameMonth } from 'date-fns'
import { useTrades } from '@/hooks/useTrades'
import { CalculationMethod } from '@/utils/calculations/tradeMatching'
import type { DailyPLData, WeekData, MonthCalendarData, WeeklySummary, MonthlySummary, WeeklyPL } from '../types'

// Helper to parse date string without timezone issues
// "2024-12-30" -> Date object for Dec 30 2024 in local time
export const parseDateString = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

interface UseCalendarDataOptions {
  calculationMethod: CalculationMethod
}

export function useCalendarData({ calculationMethod }: UseCalendarDataOptions) {
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0)
  const [currentYearIndex, setCurrentYearIndex] = useState(0)
  const [currentQuarterIndex, setCurrentQuarterIndex] = useState(0)
  const [availableMonths, setAvailableMonths] = useState<Array<{ year: number; month: number }>>([])
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [availableQuarters, setAvailableQuarters] = useState<Array<{ year: number; quarter: number }>>([])

  // Fetch trades from API using the selected calculation method
  const { data: tradesData, isLoading, error } = useTrades({ method: calculationMethod })
  const trades = tradesData?.trades || []

  // Process trades into daily P&L data
  // Uses tradingDay (official trading day for futures) if available, falls back to exitDate
  const dailyPLMap = useMemo(() => {
    const map = new Map<string, { pl: number; commissions: number; trades: number }>()

    trades.forEach(trade => {
      // Prefer tradingDay (official trading day) over exitDate (actual calendar date)
      // For futures, trades executed after hours count toward the next trading day
      const dateKey = trade.tradingDay || (trade.exitDate ? format(trade.exitDate, 'yyyy-MM-dd') : null)
      if (!dateKey) return

      const existing = map.get(dateKey) || { pl: 0, commissions: 0, trades: 0 }
      map.set(dateKey, {
        pl: existing.pl + trade.pl - trade.commission, // pl already includes commission, so we extract gross
        commissions: existing.commissions + trade.commission,
        trades: existing.trades + 1,
      })
    })

    return map
  }, [trades])

  // Get available months from trades
  // Uses tradingDay if available, falls back to exitDate
  const computedAvailableMonths = useMemo(() => {
    const months = new Set<string>()

    trades.forEach(trade => {
      // Prefer tradingDay over exitDate for month determination
      let monthKey: string | null = null
      if (trade.tradingDay) {
        monthKey = trade.tradingDay.substring(0, 7) // "YYYY-MM" from "YYYY-MM-DD"
      } else if (trade.exitDate) {
        monthKey = format(trade.exitDate, 'yyyy-MM')
      }
      if (monthKey) {
        months.add(monthKey)
      }
    })

    return Array.from(months)
      .sort()
      .map(key => {
        const [year, month] = key.split('-').map(Number)
        return { year, month: month - 1 } // month is 0-indexed
      })
  }, [trades])

  // Initialize available months and set to most recent
  useEffect(() => {
    if (computedAvailableMonths.length > 0) {
      setAvailableMonths(computedAvailableMonths)
      setCurrentMonthIndex(computedAvailableMonths.length - 1)
    }
  }, [computedAvailableMonths])

  // Generate calendar data for current month
  const calendarData = useMemo((): MonthCalendarData | null => {
    if (availableMonths.length === 0 || currentMonthIndex < 0 || currentMonthIndex >= availableMonths.length) {
      return null
    }

    const { year, month } = availableMonths[currentMonthIndex]
    const currentMonthDate = new Date(year, month)
    const monthStart = startOfMonth(currentMonthDate)
    const monthEnd = endOfMonth(currentMonthDate)

    // Calculate leading days from previous month to complete first week
    const firstDayOfWeek = getDay(monthStart) // 0 = Sunday, 1 = Monday, etc.
    const mondayOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1 // Days to go back to Monday
    const calendarStart = mondayOffset > 0 ? subDays(monthStart, mondayOffset) : monthStart

    // Calculate trailing days from next month to complete last week
    const lastDayOfWeek = getDay(monthEnd) // 0 = Sunday, 1 = Monday, etc.
    // If last day is Saturday (6), we don't need trailing days
    // If last day is Sunday (0), we don't need trailing days (weekend)
    // Otherwise, we need to extend to Friday (5)
    let calendarEnd = monthEnd
    if (lastDayOfWeek !== 0 && lastDayOfWeek !== 6) {
      // Need to extend to Friday
      const daysToFriday = 5 - lastDayOfWeek
      if (daysToFriday > 0) {
        calendarEnd = addDays(monthEnd, daysToFriday)
      }
    } else if (lastDayOfWeek === 0) {
      // Sunday - go back to previous Friday
      calendarEnd = subDays(monthEnd, 2)
    } else if (lastDayOfWeek === 6) {
      // Saturday - go back to previous Friday
      calendarEnd = subDays(monthEnd, 1)
    }

    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

    const weeks: WeekData[] = []
    let currentWeek: (DailyPLData | null)[] = [null, null, null, null, null] // Mon-Fri
    let currentWeekNum = getISOWeek(calendarStart)
    let currentWeekYear = getYear(calendarStart)
    let weeklyPL: WeeklyPL = { pl: 0, commissions: 0, trades: 0, days: 0 }

    days.forEach(day => {
      const dayOfWeek = getDay(day)

      // Skip weekends
      if (dayOfWeek === 0 || dayOfWeek === 6) return

      const weekNum = getISOWeek(day)
      const weekYear = getYear(day)
      const dayIndex = dayOfWeek - 1 // 0 = Monday, 4 = Friday
      const dateKey = format(day, 'yyyy-MM-dd')
      const isCurrentMonth = isSameMonth(day, currentMonthDate)

      // Check if we moved to a new week
      if (weekNum !== currentWeekNum || weekYear !== currentWeekYear) {
        // Save current week
        weeks.push({
          year: currentWeekYear,
          weekNum: currentWeekNum,
          days: currentWeek,
          weeklyPL: { ...weeklyPL },
        })

        // Reset for new week
        currentWeek = [null, null, null, null, null]
        weeklyPL = { pl: 0, commissions: 0, trades: 0, days: 0 }
        currentWeekNum = weekNum
        currentWeekYear = weekYear
      }

      // Get daily data
      const dailyData = dailyPLMap.get(dateKey)
      const dayData: DailyPLData = {
        tradingDay: dateKey,
        pl: dailyData?.pl || 0,
        commissions: dailyData?.commissions || 0,
        trades: dailyData?.trades || 0,
        isCurrentMonth: isCurrentMonth,
      }

      currentWeek[dayIndex] = dayData

      // Update weekly totals (include ALL days in the week for accurate weekly P&L)
      if (dailyData) {
        weeklyPL.pl += dailyData.pl
        weeklyPL.commissions += dailyData.commissions
        weeklyPL.trades += dailyData.trades
        weeklyPL.days += 1
      }
    })

    // Don't forget the last week
    if (currentWeek.some(d => d !== null)) {
      weeks.push({
        year: currentWeekYear,
        weekNum: currentWeekNum,
        days: currentWeek,
        weeklyPL: { ...weeklyPL },
      })
    }

    // Filter out weeks that have no days from the current month
    // (e.g., if month starts on Saturday, first week has only previous month days)
    const filteredWeeks = weeks.filter(week =>
      week.days.some(day => day !== null && day.isCurrentMonth)
    )

    return {
      year,
      month,
      monthName: format(new Date(year, month), 'MMMM yyyy'),
      weeks: filteredWeeks,
    }
  }, [availableMonths, currentMonthIndex, dailyPLMap])

  // Generate weekly summaries for weekly view (all weeks from all trades)
  // Uses calendar year (not ISO week year) so Dec 30-31 stays in the current year
  // This means some years may have 53 weeks when week 1 starts mid-week
  const weeklySummaries = useMemo((): WeeklySummary[] => {
    const weekMap = new Map<string, WeeklySummary>()

    dailyPLMap.forEach((data, dateKey) => {
      // Parse date string properly to avoid timezone issues
      const date = parseDateString(dateKey)

      // Use calendar year (getYear) instead of ISO week year (getISOWeekYear)
      // This prevents Dec 30-31 2024 from showing up in 2025 Week 1
      const year = getYear(date)

      // Calculate week number based on calendar year
      // Week 1 starts on the first Monday of the year (or Jan 1 if it's Mon-Thu)
      // This may result in 53 weeks for some years
      const janFirst = new Date(year, 0, 1)
      const janFirstDay = getDay(janFirst) // 0=Sun, 1=Mon, etc.

      // Days since start of year
      const dayOfYear = Math.floor((date.getTime() - janFirst.getTime()) / (24 * 60 * 60 * 1000)) + 1

      // Calculate week number (1-indexed)
      // Adjust for the day of week that Jan 1 falls on
      // If Jan 1 is Mon (1), week 1 starts immediately
      // If Jan 1 is Tue-Sun, we need to adjust
      const adjustedDayOfYear = dayOfYear + (janFirstDay === 0 ? 6 : janFirstDay - 1)
      const weekNum = Math.ceil(adjustedDayOfYear / 7)

      const weekKey = `${year}-W${String(weekNum).padStart(2, '0')}`

      const existing = weekMap.get(weekKey)
      if (existing) {
        existing.pl += data.pl
        existing.commissions += data.commissions
        existing.trades += data.trades
        existing.tradingDays += 1
        // Update end date if this date is later
        if (dateKey > existing.endDate) {
          existing.endDate = dateKey
        }
        // Update start date if this date is earlier
        if (dateKey < existing.startDate) {
          existing.startDate = dateKey
        }
      } else {
        weekMap.set(weekKey, {
          year,
          weekNum,
          startDate: dateKey,
          endDate: dateKey,
          pl: data.pl,
          commissions: data.commissions,
          trades: data.trades,
          tradingDays: 1,
        })
      }
    })

    // Sort by year and week number
    return Array.from(weekMap.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.weekNum - b.weekNum
    })
  }, [dailyPLMap])

  // Generate monthly summaries for monthly view (all months from all trades)
  const monthlySummaries = useMemo((): MonthlySummary[] => {
    const monthMap = new Map<string, MonthlySummary>()

    dailyPLMap.forEach((data, dateKey) => {
      const monthKey = dateKey.substring(0, 7) // "YYYY-MM"
      const [year, month] = monthKey.split('-').map(Number)

      const existing = monthMap.get(monthKey)
      if (existing) {
        existing.pl += data.pl
        existing.commissions += data.commissions
        existing.trades += data.trades
        existing.tradingDays += 1
      } else {
        monthMap.set(monthKey, {
          year,
          month: month - 1, // 0-indexed
          monthName: format(new Date(year, month - 1), 'MMMM yyyy'),
          pl: data.pl,
          commissions: data.commissions,
          trades: data.trades,
          tradingDays: 1,
        })
      }
    })

    // Sort by year and month
    return Array.from(monthMap.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return a.month - b.month
    })
  }, [dailyPLMap])

  // Get available years from weekly/monthly summaries
  const computedAvailableYears = useMemo(() => {
    const years = new Set<number>()
    weeklySummaries.forEach(w => years.add(w.year))
    monthlySummaries.forEach(m => years.add(m.year))
    return Array.from(years).sort()
  }, [weeklySummaries, monthlySummaries])

  // Get available quarters from weekly summaries
  const computedAvailableQuarters = useMemo(() => {
    const quarters = new Set<string>()
    weeklySummaries.forEach(w => {
      // Determine quarter from start date (month 0-2 = Q1, 3-5 = Q2, etc.)
      const startDate = parseDateString(w.startDate)
      const month = startDate.getMonth()
      const quarter = Math.floor(month / 3) + 1
      quarters.add(`${w.year}-Q${quarter}`)
    })
    return Array.from(quarters)
      .sort()
      .map(q => {
        const [year, qNum] = q.split('-Q')
        return { year: parseInt(year), quarter: parseInt(qNum) }
      })
  }, [weeklySummaries])

  // Initialize available years and set to most recent
  useEffect(() => {
    if (computedAvailableYears.length > 0) {
      setAvailableYears(computedAvailableYears)
      setCurrentYearIndex(computedAvailableYears.length - 1)
    }
  }, [computedAvailableYears])

  // Initialize available quarters and set to most recent
  useEffect(() => {
    if (computedAvailableQuarters.length > 0) {
      setAvailableQuarters(computedAvailableQuarters)
      setCurrentQuarterIndex(computedAvailableQuarters.length - 1)
    }
  }, [computedAvailableQuarters])

  // Filter weekly summaries by current quarter
  const filteredWeeklySummaries = useMemo(() => {
    if (availableQuarters.length === 0) return weeklySummaries
    const currentQuarter = availableQuarters[currentQuarterIndex]
    if (!currentQuarter) return weeklySummaries

    // Filter weeks that fall within this quarter
    // Q1 = weeks with start dates in Jan-Mar, Q2 = Apr-Jun, etc.
    return weeklySummaries.filter(w => {
      if (w.year !== currentQuarter.year) return false
      const startDate = parseDateString(w.startDate)
      const month = startDate.getMonth()
      const weekQuarter = Math.floor(month / 3) + 1
      return weekQuarter === currentQuarter.quarter
    })
  }, [weeklySummaries, availableQuarters, currentQuarterIndex])

  // Filter monthly summaries by current year
  const filteredMonthlySummaries = useMemo(() => {
    if (availableYears.length === 0) return monthlySummaries
    const currentYear = availableYears[currentYearIndex]
    return monthlySummaries.filter(m => m.year === currentYear)
  }, [monthlySummaries, availableYears, currentYearIndex])

  // Filter weekly summaries by current year (for yearly grouping)
  const filteredWeeklySummariesByYear = useMemo(() => {
    if (availableYears.length === 0) return weeklySummaries
    const year = availableYears[currentYearIndex]
    return weeklySummaries.filter(w => w.year === year)
  }, [weeklySummaries, availableYears, currentYearIndex])

  // Navigation handlers
  const handlePreviousMonth = () => {
    if (currentMonthIndex > 0) {
      setCurrentMonthIndex(currentMonthIndex - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonthIndex < availableMonths.length - 1) {
      setCurrentMonthIndex(currentMonthIndex + 1)
    }
  }

  const handleMonthSelect = (index: number) => {
    setCurrentMonthIndex(index)
  }

  const handlePreviousQuarter = () => {
    if (currentQuarterIndex > 0) {
      setCurrentQuarterIndex(currentQuarterIndex - 1)
    }
  }

  const handleNextQuarter = () => {
    if (currentQuarterIndex < availableQuarters.length - 1) {
      setCurrentQuarterIndex(currentQuarterIndex + 1)
    }
  }

  const handleQuarterSelect = (index: number) => {
    setCurrentQuarterIndex(index)
  }

  const handlePreviousYear = () => {
    if (currentYearIndex > 0) {
      setCurrentYearIndex(currentYearIndex - 1)
    }
  }

  const handleNextYear = () => {
    if (currentYearIndex < availableYears.length - 1) {
      setCurrentYearIndex(currentYearIndex + 1)
    }
  }

  const handleYearSelect = (index: number) => {
    setCurrentYearIndex(index)
  }

  // Computed navigation states
  const canGoPreviousMonth = currentMonthIndex > 0
  const canGoNextMonth = currentMonthIndex < availableMonths.length - 1
  const canGoPreviousQuarter = currentQuarterIndex > 0
  const canGoNextQuarter = currentQuarterIndex < availableQuarters.length - 1
  const canGoPreviousYear = currentYearIndex > 0
  const canGoNextYear = currentYearIndex < availableYears.length - 1

  const currentQuarter = availableQuarters[currentQuarterIndex]
  const currentQuarterLabel = currentQuarter ? `Q${currentQuarter.quarter} ${currentQuarter.year}` : ''
  const currentYear = availableYears[currentYearIndex] || new Date().getFullYear()

  return {
    // Loading states
    isLoading,
    error,

    // Calendar data
    calendarData,
    filteredWeeklySummaries,
    filteredWeeklySummariesByYear,
    filteredMonthlySummaries,

    // Available options
    availableMonths,
    availableQuarters,
    availableYears,

    // Current indices
    currentMonthIndex,
    currentQuarterIndex,
    currentYearIndex,

    // Navigation flags
    canGoPreviousMonth,
    canGoNextMonth,
    canGoPreviousQuarter,
    canGoNextQuarter,
    canGoPreviousYear,
    canGoNextYear,

    // Labels
    currentQuarterLabel,
    currentYear,

    // Handlers
    handlePreviousMonth,
    handleNextMonth,
    handleMonthSelect,
    handlePreviousQuarter,
    handleNextQuarter,
    handleQuarterSelect,
    handlePreviousYear,
    handleNextYear,
    handleYearSelect,
  }
}
