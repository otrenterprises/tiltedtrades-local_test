import { useState, useEffect, useRef, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Eye, EyeOff, Calendar as CalendarIcon, LayoutGrid, CalendarDays, CalendarRange } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { PLToggle } from '@/components/common/PLToggle'
import { formatCurrency } from '@/utils/formatting/currency'
import { useTrades } from '@/hooks/useTrades'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, getISOWeek, getYear, subDays, addDays, isSameMonth } from 'date-fns'

type ViewType = 'daily' | 'weekly' | 'monthly'

interface DailyPLData {
  tradingDay: string
  pl: number
  commissions: number
  trades: number
  isCurrentMonth: boolean
  isHoliday?: boolean
  holidayName?: string
}

interface WeeklyPL {
  pl: number
  commissions: number
  trades: number
  days: number
}

interface WeekData {
  year: number
  weekNum: number
  days: (DailyPLData | null)[]
  weeklyPL?: WeeklyPL
}

interface MonthCalendarData {
  year: number
  month: number
  monthName: string
  weeks: WeekData[]
}

// Data for weekly view cards
interface WeeklySummary {
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
interface MonthlySummary {
  year: number
  month: number
  monthName: string
  pl: number
  commissions: number
  trades: number
  tradingDays: number
}

// Helper to parse date string without timezone issues
// "2024-12-30" -> Date object for Dec 30 2024 in local time
const parseDateString = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function CalendarNew() {
  const [viewType, setViewType] = useState<ViewType>('daily')
  const [showWeeklyTotals, setShowWeeklyTotals] = useState(true)
  const [includeCommissions, setIncludeCommissions] = useState(false)
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0)
  const [currentYearIndex, setCurrentYearIndex] = useState(0) // For monthly view
  const [currentQuarterIndex, setCurrentQuarterIndex] = useState(0) // For weekly view
  const [availableMonths, setAvailableMonths] = useState<Array<{ year: number; month: number }>>([])
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [availableQuarters, setAvailableQuarters] = useState<Array<{ year: number; quarter: number }>>([])
  const [showQuarterPicker, setShowQuarterPicker] = useState(false)
  const quarterPickerRef = useRef<HTMLDivElement>(null)
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [showYearPicker, setShowYearPicker] = useState(false)
  const monthPickerRef = useRef<HTMLDivElement>(null)
  const yearPickerRef = useRef<HTMLDivElement>(null)

  // Fetch trades from API
  const { data: tradesData, isLoading, error } = useTrades({ method: 'fifo' })
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

  // Close month picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (monthPickerRef.current && !monthPickerRef.current.contains(event.target as Node)) {
        setShowMonthPicker(false)
      }
    }

    if (showMonthPicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showMonthPicker])

  // Close year picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (yearPickerRef.current && !yearPickerRef.current.contains(event.target as Node)) {
        setShowYearPicker(false)
      }
    }

    if (showYearPicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showYearPicker])

  // Close quarter picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (quarterPickerRef.current && !quarterPickerRef.current.contains(event.target as Node)) {
        setShowQuarterPicker(false)
      }
    }

    if (showQuarterPicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showQuarterPicker])

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

  const handleMonthSelect = (index: number) => {
    setCurrentMonthIndex(index)
    setShowMonthPicker(false)
  }

  const handleYearSelect = (index: number) => {
    setCurrentYearIndex(index)
    setShowYearPicker(false)
  }

  const handleQuarterSelect = (index: number) => {
    setCurrentQuarterIndex(index)
    setShowQuarterPicker(false)
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

  const canGoPreviousQuarter = currentQuarterIndex > 0
  const canGoNextQuarter = currentQuarterIndex < availableQuarters.length - 1
  const currentQuarter = availableQuarters[currentQuarterIndex]
  const currentQuarterLabel = currentQuarter ? `Q${currentQuarter.quarter} ${currentQuarter.year}` : ''

  const canGoPreviousYear = currentYearIndex > 0
  const canGoNextYear = currentYearIndex < availableYears.length - 1
  const currentYear = availableYears[currentYearIndex] || new Date().getFullYear()

  // Calculate effective P&L based on toggle state
  // pl = Gross P&L (before commissions)
  // commissions = negative values (e.g., -4.80)
  // Net P&L = pl + commissions (gross minus commission amount)
  //
  // includeCommissions (showGrossPL from toggle):
  // - false = Toggle LEFT = Net selected = show pl + commissions
  // - true = Toggle RIGHT = Gross selected = show pl
  const getEffectivePL = (pl: number, commissions: number): number => {
    return includeCommissions ? pl : pl + commissions
  }

  // Get background color based on P&L
  const getBgColor = (pl: number, isCurrentMonth: boolean = true): string => {
    if (!isCurrentMonth) {
      // Faded appearance for leading/trailing days
      if (pl === 0) return 'bg-slate-900/30'
      if (pl > 0) return 'bg-teal-900/20'
      return 'bg-red-900/20'
    }

    if (pl === 0) return 'bg-slate-800'
    if (pl > 0) return 'bg-teal-700/60'
    return 'bg-red-800/60'
  }

  // Get text color class based on P&L
  const getTextColor = (pl: number, isCurrentMonth: boolean = true): string => {
    if (!isCurrentMonth) {
      // More faded text for leading/trailing days
      if (pl === 0) return 'text-slate-600'
      if (pl > 0) return 'text-teal-600'
      return 'text-red-600'
    }

    if (pl === 0) return 'text-slate-400'
    if (pl > 0) return 'text-teal-200'
    return 'text-red-200'
  }

  // Get border color class based on P&L
  const getBorderColor = (pl: number, isCurrentMonth: boolean = true): string => {
    if (!isCurrentMonth) {
      return 'border-slate-700/30'
    }

    if (pl === 0) return 'border-slate-400/50'
    if (pl > 0) return 'border-teal-400/50'
    return 'border-red-400/50'
  }

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

  const canGoPrevious = currentMonthIndex > 0
  const canGoNext = currentMonthIndex < availableMonths.length - 1

  // Loading state
  if (isLoading) {
    return (
      <PageLayout title="Trading Calendar" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-400">Loading calendar data...</p>
          </div>
        </div>
      </PageLayout>
    )
  }

  // Error state
  if (error) {
    return (
      <PageLayout title="Trading Calendar">
        <div className="text-center text-red-400 p-8">
          <p>Error loading trades: {error.message}</p>
        </div>
      </PageLayout>
    )
  }

  // View selector component
  const ViewSelector = () => (
    <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
      <button
        onClick={() => setViewType('daily')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          viewType === 'daily'
            ? 'bg-accent text-white'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
        }`}
      >
        <CalendarDays className="w-4 h-4" />
        Daily
      </button>
      <button
        onClick={() => setViewType('weekly')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          viewType === 'weekly'
            ? 'bg-accent text-white'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
        }`}
      >
        <CalendarRange className="w-4 h-4" />
        Weekly
      </button>
      <button
        onClick={() => setViewType('monthly')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          viewType === 'monthly'
            ? 'bg-accent text-white'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
        }`}
      >
        <LayoutGrid className="w-4 h-4" />
        Monthly
      </button>
    </div>
  )

  return (
    <PageLayout
      title="Trading Calendar"
      subtitle={<ViewSelector />}
      actions={
        <div className="flex flex-col gap-2">
          {/* Weekly totals toggle - only show in daily view */}
          {viewType === 'daily' && (
            <button
              onClick={() => setShowWeeklyTotals(!showWeeklyTotals)}
              className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                showWeeklyTotals
                  ? 'bg-accent text-white'
                  : 'bg-blue-900 border border-blue-800 text-blue-200 hover:bg-blue-800'
              }`}
            >
              {showWeeklyTotals ? (
                <Eye className="w-4 h-4" />
              ) : (
                <EyeOff className="w-4 h-4" />
              )}
              Show Weekly Totals
            </button>
          )}

          {/* P&L Toggle (Net/Gross) */}
          <PLToggle showGrossPL={includeCommissions} onToggle={setIncludeCommissions} />
        </div>
      }
    >
      <div className="space-y-6">
        {/* Daily View */}
        {viewType === 'daily' && (
          <>
            {!calendarData ? (
              <div className="bg-slate-700 border border-slate-600 rounded-lg p-12 text-center">
                <p className="text-slate-300">No trading data available</p>
              </div>
            ) : (
              <div className="bg-slate-700 border border-slate-600 rounded-lg p-6">
                {/* Month navigation header */}
                <div className="flex items-center justify-between mb-6 relative">
                  <button
                    onClick={handlePreviousMonth}
                    disabled={!canGoPrevious}
                    className={`p-2 rounded-lg transition-colors ${
                      canGoPrevious
                        ? 'bg-blue-900 border border-blue-800 hover:bg-blue-800 text-blue-200'
                        : 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  <div className="relative" ref={monthPickerRef}>
                    <button
                      onClick={() => setShowMonthPicker(!showMonthPicker)}
                      className="text-2xl font-bold text-slate-50 hover:text-accent transition-colors flex items-center gap-2"
                    >
                      {calendarData.monthName}
                      <CalendarIcon className="w-5 h-5" />
                    </button>

                    {/* Month Picker Dropdown */}
                    {showMonthPicker && (
                      <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl p-4 z-50 min-w-[320px] max-h-[400px] overflow-y-auto">
                        <h4 className="text-sm font-semibold text-slate-200 mb-3">Select Month</h4>
                        <div className="space-y-1">
                          {availableMonths.map((monthData, index) => {
                            const date = new Date(monthData.year, monthData.month, 1)
                            const monthName = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                            const isSelected = index === currentMonthIndex

                            return (
                              <button
                                key={`${monthData.year}-${monthData.month}`}
                                onClick={() => handleMonthSelect(index)}
                                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                  isSelected
                                    ? 'bg-accent text-white'
                                    : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                                }`}
                              >
                                {monthName}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleNextMonth}
                    disabled={!canGoNext}
                    className={`p-2 rounded-lg transition-colors ${
                      canGoNext
                        ? 'bg-blue-900 border border-blue-800 hover:bg-blue-800 text-blue-200'
                        : 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                    }`}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* Calendar table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        {dayLabels.map((day) => (
                          <th
                            key={day}
                            className="px-3 py-2 text-center text-xs font-semibold text-slate-300 border-b border-slate-500 min-w-[120px]"
                          >
                            {day}
                          </th>
                        ))}
                        {showWeeklyTotals && (
                          <th className="px-3 py-2 text-center text-xs font-semibold text-slate-300 border-b border-slate-500 min-w-[120px]">
                            Weekly Total
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {calendarData.weeks.map((week) => (
                        <tr key={`${week.year}-W${String(week.weekNum).padStart(2, '0')}`}>
                          {/* Days Mon-Fri */}
                          {week.days.map((dayData, dayIndex) => (
                            <td
                              key={dayIndex}
                              className="px-2 py-2 border-b border-slate-600/50"
                            >
                              {dayData ? (
                                <DayCell
                                  dayData={dayData}
                                  bgColor={getBgColor(getEffectivePL(dayData.pl, dayData.commissions), dayData.isCurrentMonth)}
                                  textColor={getTextColor(getEffectivePL(dayData.pl, dayData.commissions), dayData.isCurrentMonth)}
                                  borderColor={getBorderColor(getEffectivePL(dayData.pl, dayData.commissions), dayData.isCurrentMonth)}
                                  includeCommissions={includeCommissions}
                                />
                              ) : (
                                <div className="h-24 bg-dark/50 rounded"></div>
                              )}
                            </td>
                          ))}

                          {/* Weekly total */}
                          {showWeeklyTotals && (
                            <td className="px-2 py-2 border-b border-slate-600/50">
                              {week.weeklyPL && (
                                <WeeklyCell
                                  weeklyPL={week.weeklyPL.pl}
                                  commissions={week.weeklyPL.commissions}
                                  trades={week.weeklyPL.trades}
                                  days={week.weeklyPL.days}
                                  bgColor={getBgColor(0, true)}
                                  textColor={getTextColor(getEffectivePL(week.weeklyPL.pl, week.weeklyPL.commissions), true)}
                                  includeCommissions={includeCommissions}
                                />
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Monthly Statistics for Daily View */}
            {calendarData && (() => {
              let monthlyPL = 0
              let tradingDays = 0
              let winningDays = 0

              calendarData.weeks.forEach(week => {
                week.days.forEach(dayData => {
                  if (dayData && dayData.trades > 0 && dayData.isCurrentMonth) {
                    const effectivePL = includeCommissions ? dayData.pl : dayData.pl + dayData.commissions
                    monthlyPL += effectivePL
                    tradingDays++
                    if (effectivePL > 0) {
                      winningDays++
                    }
                  }
                })
              })

              const avgDailyPL = tradingDays > 0 ? monthlyPL / tradingDays : 0
              const avgWinRate = tradingDays > 0 ? (winningDays / tradingDays) * 100 : 0

              return (
                <div className="bg-slate-700 border border-slate-600 rounded-lg p-6">
                  <h3 className="text-sm font-semibold text-slate-100 mb-4">Monthly Statistics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
                      <div className="text-xs text-slate-400 mb-1">Monthly P&L</div>
                      <div className={`text-lg font-bold ${monthlyPL >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                        {formatCurrency(monthlyPL)}
                      </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
                      <div className="text-xs text-slate-400 mb-1">Trading Days</div>
                      <div className="text-lg font-bold text-slate-200">{tradingDays}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
                      <div className="text-xs text-slate-400 mb-1">Avg Daily P&L</div>
                      <div className={`text-lg font-bold ${avgDailyPL >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                        {formatCurrency(avgDailyPL)}
                      </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
                      <div className="text-xs text-slate-400 mb-1">Win Rate</div>
                      <div className={`text-lg font-bold ${avgWinRate >= 50 ? 'text-teal-400' : 'text-red-400'}`}>
                        {avgWinRate.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </>
        )}

        {/* Weekly View */}
        {viewType === 'weekly' && (
          <div className="bg-slate-700 border border-slate-600 rounded-lg p-6">
            {/* Quarter navigation header */}
            <div className="flex items-center justify-between mb-6 relative">
              <button
                onClick={handlePreviousQuarter}
                disabled={!canGoPreviousQuarter}
                className={`p-2 rounded-lg transition-colors ${
                  canGoPreviousQuarter
                    ? 'bg-blue-900 border border-blue-800 hover:bg-blue-800 text-blue-200'
                    : 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="relative" ref={quarterPickerRef}>
                <button
                  onClick={() => setShowQuarterPicker(!showQuarterPicker)}
                  className="text-2xl font-bold text-slate-50 hover:text-accent transition-colors flex items-center gap-2"
                >
                  {currentQuarterLabel}
                  <CalendarIcon className="w-5 h-5" />
                </button>

                {/* Quarter Picker Dropdown */}
                {showQuarterPicker && (
                  <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl p-4 z-50 min-w-[200px] max-h-[300px] overflow-y-auto">
                    <h4 className="text-sm font-semibold text-slate-200 mb-3">Select Quarter</h4>
                    <div className="space-y-1">
                      {availableQuarters.map((q, index) => {
                        const isSelected = index === currentQuarterIndex
                        const label = `Q${q.quarter} ${q.year}`

                        return (
                          <button
                            key={`${q.year}-Q${q.quarter}`}
                            onClick={() => handleQuarterSelect(index)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              isSelected
                                ? 'bg-accent text-white'
                                : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleNextQuarter}
                disabled={!canGoNextQuarter}
                className={`p-2 rounded-lg transition-colors ${
                  canGoNextQuarter
                    ? 'bg-blue-900 border border-blue-800 hover:bg-blue-800 text-blue-200'
                    : 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {filteredWeeklySummaries.length === 0 ? (
              <p className="text-slate-300 text-center py-8">No trading data available for {currentQuarterLabel}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
                {filteredWeeklySummaries.map((week) => {
                  const effectivePL = includeCommissions ? week.pl : week.pl + week.commissions
                  const bgColor = getBgColor(effectivePL, true)
                  const textColor = getTextColor(effectivePL, true)
                  const borderColor = getBorderColor(effectivePL, true)

                  return (
                    <div
                      key={`${week.year}-W${week.weekNum}`}
                      className={`h-24 ${bgColor} rounded px-2 py-2 flex flex-col justify-between border ${borderColor} hover:ring-2 hover:ring-accent transition-all cursor-pointer`}
                      title={`Week ${week.weekNum}, ${week.year} | ${week.startDate} to ${week.endDate} | Gross: ${formatCurrency(week.pl)} | Net: ${formatCurrency(week.pl + week.commissions)} | ${week.trades} trades`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-sm font-semibold text-slate-300">W{week.weekNum}</span>
                        <span className="text-xs text-slate-500">{format(parseDateString(week.startDate), 'MMM d')}</span>
                      </div>
                      <div className={`text-base font-bold ${textColor} text-center`}>
                        {formatCurrency(effectivePL)}
                      </div>
                      <div className="text-sm text-slate-400 text-center">
                        {week.tradingDays}d / {week.trades}t
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Weekly Summary Stats */}
            {filteredWeeklySummaries.length > 0 && (() => {
              const totalPL = filteredWeeklySummaries.reduce((sum, w) => sum + (includeCommissions ? w.pl : w.pl + w.commissions), 0)
              const totalTrades = filteredWeeklySummaries.reduce((sum, w) => sum + w.trades, 0)
              const totalDays = filteredWeeklySummaries.reduce((sum, w) => sum + w.tradingDays, 0)
              const winningWeeks = filteredWeeklySummaries.filter(w => (includeCommissions ? w.pl : w.pl + w.commissions) > 0).length
              const winRate = (winningWeeks / filteredWeeklySummaries.length) * 100

              return (
                <div className="mt-6 pt-6 border-t border-slate-600">
                  <h3 className="text-sm font-semibold text-slate-100 mb-4">Quarter Statistics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
                      <div className="text-xs text-slate-400 mb-1">Quarter P&L</div>
                      <div className={`text-lg font-bold ${totalPL >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                        {formatCurrency(totalPL)}
                      </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
                      <div className="text-xs text-slate-400 mb-1">Weeks</div>
                      <div className="text-lg font-bold text-slate-200">{filteredWeeklySummaries.length}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
                      <div className="text-xs text-slate-400 mb-1">Trading Days</div>
                      <div className="text-lg font-bold text-slate-200">{totalDays}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
                      <div className="text-xs text-slate-400 mb-1">Total Trades</div>
                      <div className="text-lg font-bold text-slate-200">{totalTrades}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
                      <div className="text-xs text-slate-400 mb-1">Win Rate</div>
                      <div className={`text-lg font-bold ${winRate >= 50 ? 'text-teal-400' : 'text-red-400'}`}>
                        {winRate.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}

        {/* Monthly View */}
        {viewType === 'monthly' && (
          <div className="bg-slate-700 border border-slate-600 rounded-lg p-6">
            {/* Year navigation header */}
            <div className="flex items-center justify-between mb-6 relative">
              <button
                onClick={handlePreviousYear}
                disabled={!canGoPreviousYear}
                className={`p-2 rounded-lg transition-colors ${
                  canGoPreviousYear
                    ? 'bg-blue-900 border border-blue-800 hover:bg-blue-800 text-blue-200'
                    : 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="relative" ref={yearPickerRef}>
                <button
                  onClick={() => setShowYearPicker(!showYearPicker)}
                  className="text-2xl font-bold text-slate-50 hover:text-accent transition-colors flex items-center gap-2"
                >
                  {currentYear}
                  <CalendarIcon className="w-5 h-5" />
                </button>

                {/* Year Picker Dropdown */}
                {showYearPicker && (
                  <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl p-4 z-50 min-w-[200px] max-h-[300px] overflow-y-auto">
                    <h4 className="text-sm font-semibold text-slate-200 mb-3">Select Year</h4>
                    <div className="space-y-1">
                      {availableYears.map((year, index) => {
                        const isSelected = index === currentYearIndex

                        return (
                          <button
                            key={year}
                            onClick={() => handleYearSelect(index)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                              isSelected
                                ? 'bg-accent text-white'
                                : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                            }`}
                          >
                            {year}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleNextYear}
                disabled={!canGoNextYear}
                className={`p-2 rounded-lg transition-colors ${
                  canGoNextYear
                    ? 'bg-blue-900 border border-blue-800 hover:bg-blue-800 text-blue-200'
                    : 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                }`}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {filteredMonthlySummaries.length === 0 ? (
              <p className="text-slate-300 text-center py-8">No trading data available for {currentYear}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                {filteredMonthlySummaries.map((month) => {
                  const effectivePL = includeCommissions ? month.pl : month.pl + month.commissions
                  const bgColor = getBgColor(effectivePL, true)
                  const textColor = getTextColor(effectivePL, true)
                  const borderColor = getBorderColor(effectivePL, true)
                  // Get abbreviated month name
                  const monthAbbr = format(new Date(month.year, month.month), 'MMM')

                  return (
                    <div
                      key={`${month.year}-${month.month}`}
                      className={`h-24 ${bgColor} rounded px-2 py-2 flex flex-col justify-between border ${borderColor} hover:ring-2 hover:ring-accent transition-all cursor-pointer`}
                      title={`${month.monthName} | Gross: ${formatCurrency(month.pl)} | Net: ${formatCurrency(month.pl + month.commissions)} | ${month.trades} trades`}
                    >
                      <div className="text-sm font-semibold text-slate-300">
                        {monthAbbr}
                      </div>
                      <div className={`text-base font-bold ${textColor} text-center`}>
                        {formatCurrency(effectivePL)}
                      </div>
                      <div className="text-sm text-slate-400 text-center">
                        {month.tradingDays}d / {month.trades}t
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Monthly Summary Stats */}
            {filteredMonthlySummaries.length > 0 && (() => {
              const totalPL = filteredMonthlySummaries.reduce((sum, m) => sum + (includeCommissions ? m.pl : m.pl + m.commissions), 0)
              const totalTrades = filteredMonthlySummaries.reduce((sum, m) => sum + m.trades, 0)
              const totalDays = filteredMonthlySummaries.reduce((sum, m) => sum + m.tradingDays, 0)
              const winningMonths = filteredMonthlySummaries.filter(m => (includeCommissions ? m.pl : m.pl + m.commissions) > 0).length
              const winRate = (winningMonths / filteredMonthlySummaries.length) * 100
              const avgMonthlyPL = totalPL / filteredMonthlySummaries.length

              return (
                <div className="mt-6 pt-6 border-t border-slate-600">
                  <h3 className="text-sm font-semibold text-slate-100 mb-4">Year Statistics</h3>
                  <div className="grid grid-cols-5 gap-4">
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
                      <div className="text-xs text-slate-400 mb-1">Year P&L</div>
                      <div className={`text-lg font-bold ${totalPL >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                        {formatCurrency(totalPL)}
                      </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
                      <div className="text-xs text-slate-400 mb-1">Avg Monthly</div>
                      <div className={`text-lg font-bold ${avgMonthlyPL >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                        {formatCurrency(avgMonthlyPL)}
                      </div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
                      <div className="text-xs text-slate-400 mb-1">Trading Days</div>
                      <div className="text-lg font-bold text-slate-200">{totalDays}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
                      <div className="text-xs text-slate-400 mb-1">Total Trades</div>
                      <div className="text-lg font-bold text-slate-200">{totalTrades}</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
                      <div className="text-xs text-slate-400 mb-1">Win Rate</div>
                      <div className={`text-lg font-bold ${winRate >= 50 ? 'text-teal-400' : 'text-red-400'}`}>
                        {winRate.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </div>
    </PageLayout>
  )
}

// Day cell component
interface DayCellProps {
  dayData: DailyPLData
  bgColor: string
  textColor: string
  borderColor: string
  includeCommissions: boolean
}

function DayCell({ dayData, bgColor, textColor, borderColor, includeCommissions }: DayCellProps) {
  const dayNum = parseInt(dayData.tradingDay.split('-')[2], 10)
  const isCurrentMonth = dayData.isCurrentMonth !== false
  // includeCommissions = showGrossPL from toggle
  // true = Gross (just pl), false = Net (pl + commissions where commissions is negative)
  const effectivePL = includeCommissions ? dayData.pl : dayData.pl + dayData.commissions

  if (dayData.isHoliday) {
    return (
      <div className={`h-24 bg-slate-600 rounded px-2 py-2 flex flex-col justify-between ${!isCurrentMonth ? 'opacity-60' : ''}`}>
        <div className="text-xs text-slate-300 font-semibold">{dayNum}</div>
        <div className="text-xs text-slate-300 font-medium text-center">Holiday</div>
        <div className="text-xs text-slate-400 text-center">{dayData.holidayName}</div>
      </div>
    )
  }

  // Build tooltip
  const tooltipParts = [
    `${dayData.tradingDay}`,
    `Gross P&L: ${formatCurrency(dayData.pl)}`,
    `Commissions: ${formatCurrency(dayData.commissions)}`,
    `${dayData.trades} trades`
  ]
  if (!includeCommissions) {
    // When showing Net, also show Net P&L in tooltip
    tooltipParts.splice(2, 0, `Net P&L: ${formatCurrency(effectivePL)}`)
  }

  return (
    <div
      className={`h-24 ${bgColor} rounded px-2 py-2 flex flex-col justify-between transition-all hover:ring-2 hover:ring-accent cursor-pointer ${
        isCurrentMonth ? `border ${borderColor}` : 'border border-slate-600'
      }`}
      title={tooltipParts.join(' | ')}
    >
      <div className={`text-sm font-semibold ${isCurrentMonth ? 'text-slate-300' : 'text-slate-500'}`}>
        {dayNum}
      </div>
      <div className={`text-base font-bold ${textColor} text-center`}>
        {formatCurrency(effectivePL)}
      </div>
      <div className={`text-sm ${isCurrentMonth ? 'text-slate-400' : 'text-slate-500'} text-center`}>
        {dayData.trades} trades
      </div>
    </div>
  )
}

// Weekly cell component
interface WeeklyCellProps {
  weeklyPL: number
  commissions: number
  trades: number
  days: number
  bgColor: string
  textColor: string
  includeCommissions: boolean
}

function WeeklyCell({ weeklyPL, commissions, trades, days, bgColor, textColor, includeCommissions }: WeeklyCellProps) {
  // includeCommissions = showGrossPL: true = Gross (weeklyPL), false = Net (weeklyPL + commissions)
  const effectivePL = includeCommissions ? weeklyPL : weeklyPL + commissions

  // Build tooltip
  const tooltipParts = [
    `Weekly Total`,
    `Gross P&L: ${formatCurrency(weeklyPL)}`,
    `Commissions: ${formatCurrency(commissions)}`,
    `${trades} trades across ${days} days`
  ]
  if (!includeCommissions) {
    tooltipParts.splice(2, 0, `Net P&L: ${formatCurrency(effectivePL)}`)
  }

  return (
    <div
      className={`h-24 ${bgColor} rounded px-2 py-2 flex flex-col justify-between border-2 border-accent/30`}
      title={tooltipParts.join(' | ')}
    >
      <div className="text-sm text-slate-400 font-medium text-center">Week Total</div>
      <div className={`text-lg font-bold ${textColor} text-center`}>
        {formatCurrency(effectivePL)}
      </div>
      <div className="text-sm text-slate-400 text-center">
        {days}d / {trades}t
      </div>
    </div>
  )
}
