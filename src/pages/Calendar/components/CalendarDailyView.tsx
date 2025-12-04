import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { formatCurrency } from '@/utils/formatting/currency'
import { DayCell } from './DayCell'
import { WeeklyCell } from './WeeklyCell'
import type { MonthCalendarData } from '../types'

interface CalendarDailyViewProps {
  calendarData: MonthCalendarData | null
  showWeeklyTotals: boolean
  includeCommissions: boolean
  availableMonths: Array<{ year: number; month: number }>
  currentMonthIndex: number
  canGoPrevious: boolean
  canGoNext: boolean
  onPreviousMonth: () => void
  onNextMonth: () => void
  onMonthSelect: (index: number) => void
}

// Style helper functions
const getEffectivePL = (pl: number, commissions: number, includeCommissions: boolean): number => {
  return includeCommissions ? pl : pl + commissions
}

const getBgColor = (pl: number, isCurrentMonth: boolean = true): string => {
  if (!isCurrentMonth) {
    if (pl === 0) return 'bg-slate-900/30'
    if (pl > 0) return 'bg-teal-900/20'
    return 'bg-red-900/20'
  }
  if (pl === 0) return 'bg-slate-800'
  if (pl > 0) return 'bg-teal-700/60'
  return 'bg-red-800/60'
}

const getTextColor = (pl: number, isCurrentMonth: boolean = true): string => {
  if (!isCurrentMonth) {
    if (pl === 0) return 'text-slate-600'
    if (pl > 0) return 'text-teal-600'
    return 'text-red-600'
  }
  if (pl === 0) return 'text-slate-400'
  if (pl > 0) return 'text-teal-200'
  return 'text-red-200'
}

const getBorderColor = (pl: number, isCurrentMonth: boolean = true): string => {
  if (!isCurrentMonth) {
    return 'border-slate-700/30'
  }
  if (pl === 0) return 'border-slate-400/50'
  if (pl > 0) return 'border-teal-400/50'
  return 'border-red-400/50'
}

const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export function CalendarDailyView({
  calendarData,
  showWeeklyTotals,
  includeCommissions,
  availableMonths,
  currentMonthIndex,
  canGoPrevious,
  canGoNext,
  onPreviousMonth,
  onNextMonth,
  onMonthSelect,
}: CalendarDailyViewProps) {
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const monthPickerRef = useRef<HTMLDivElement>(null)

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

  const handleMonthSelectAndClose = (index: number) => {
    onMonthSelect(index)
    setShowMonthPicker(false)
  }

  if (!calendarData) {
    return (
      <div className="bg-slate-700 border border-slate-600 rounded-lg p-12 text-center">
        <p className="text-slate-300">No trading data available</p>
      </div>
    )
  }

  // Calculate monthly statistics
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
    <>
      <div className="bg-slate-700 border border-slate-600 rounded-lg p-6">
        {/* Month navigation header */}
        <div className="flex items-center justify-between mb-6 relative">
          <button
            onClick={onPreviousMonth}
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
                        onClick={() => handleMonthSelectAndClose(index)}
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
            onClick={onNextMonth}
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
                          bgColor={getBgColor(getEffectivePL(dayData.pl, dayData.commissions, includeCommissions), dayData.isCurrentMonth)}
                          textColor={getTextColor(getEffectivePL(dayData.pl, dayData.commissions, includeCommissions), dayData.isCurrentMonth)}
                          borderColor={getBorderColor(getEffectivePL(dayData.pl, dayData.commissions, includeCommissions), dayData.isCurrentMonth)}
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
                          textColor={getTextColor(getEffectivePL(week.weeklyPL.pl, week.weeklyPL.commissions, includeCommissions), true)}
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

      {/* Monthly Statistics */}
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
    </>
  )
}
