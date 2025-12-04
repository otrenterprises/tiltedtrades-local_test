import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { formatCurrency } from '@/utils/formatting/currency'
import { parseDateString } from '../hooks/useCalendarData'
import type { WeeklySummary, WeeklyGrouping } from '../types'

interface CalendarWeeklyViewProps {
  weeklySummaries: WeeklySummary[]
  includeCommissions: boolean
  grouping: WeeklyGrouping
  // Quarterly props
  availableQuarters: Array<{ year: number; quarter: number }>
  currentQuarterIndex: number
  currentQuarterLabel: string
  canGoPreviousQuarter: boolean
  canGoNextQuarter: boolean
  onPreviousQuarter: () => void
  onNextQuarter: () => void
  onQuarterSelect: (index: number) => void
  // Yearly props
  availableYears: number[]
  currentYearIndex: number
  currentYear: number
  canGoPreviousYear: boolean
  canGoNextYear: boolean
  onPreviousYear: () => void
  onNextYear: () => void
  onYearSelect: (index: number) => void
}

// Style helper functions
const getBgColor = (pl: number): string => {
  if (pl === 0) return 'bg-slate-800'
  if (pl > 0) return 'bg-teal-700/60'
  return 'bg-red-800/60'
}

const getTextColor = (pl: number): string => {
  if (pl === 0) return 'text-slate-400'
  if (pl > 0) return 'text-teal-200'
  return 'text-red-200'
}

const getBorderColor = (pl: number): string => {
  if (pl === 0) return 'border-slate-400/50'
  if (pl > 0) return 'border-teal-400/50'
  return 'border-red-400/50'
}

export function CalendarWeeklyView({
  weeklySummaries,
  includeCommissions,
  grouping,
  // Quarterly props
  availableQuarters,
  currentQuarterIndex,
  currentQuarterLabel,
  canGoPreviousQuarter,
  canGoNextQuarter,
  onPreviousQuarter,
  onNextQuarter,
  onQuarterSelect,
  // Yearly props
  availableYears,
  currentYearIndex,
  currentYear,
  canGoPreviousYear,
  canGoNextYear,
  onPreviousYear,
  onNextYear,
  onYearSelect,
}: CalendarWeeklyViewProps) {
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  // Determine which navigation to use based on grouping
  const isYearly = grouping === 'yearly'
  const canGoPrevious = isYearly ? canGoPreviousYear : canGoPreviousQuarter
  const canGoNext = isYearly ? canGoNextYear : canGoNextQuarter
  const onPrevious = isYearly ? onPreviousYear : onPreviousQuarter
  const onNext = isYearly ? onNextYear : onNextQuarter
  const currentLabel = isYearly ? String(currentYear) : currentQuarterLabel
  const periodType = isYearly ? 'Year' : 'Quarter'

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowPicker(false)
      }
    }

    if (showPicker) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showPicker])

  const handleSelectAndClose = (index: number) => {
    if (isYearly) {
      onYearSelect(index)
    } else {
      onQuarterSelect(index)
    }
    setShowPicker(false)
  }

  // Calculate quarter statistics
  const totalPL = weeklySummaries.reduce((sum, w) => sum + (includeCommissions ? w.pl : w.pl + w.commissions), 0)
  const totalTrades = weeklySummaries.reduce((sum, w) => sum + w.trades, 0)
  const totalDays = weeklySummaries.reduce((sum, w) => sum + w.tradingDays, 0)
  const winningWeeks = weeklySummaries.filter(w => (includeCommissions ? w.pl : w.pl + w.commissions) > 0).length
  const winRate = weeklySummaries.length > 0 ? (winningWeeks / weeklySummaries.length) * 100 : 0

  return (
    <div className="bg-slate-700 border border-slate-600 rounded-lg p-6">
      {/* Period navigation header */}
      <div className="flex items-center justify-between mb-6 relative">
        <button
          onClick={onPrevious}
          disabled={!canGoPrevious}
          className={`p-2 rounded-lg transition-colors ${
            canGoPrevious
              ? 'bg-blue-900 border border-blue-800 hover:bg-blue-800 text-blue-200'
              : 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="text-2xl font-bold text-slate-50 hover:text-accent transition-colors flex items-center gap-2"
          >
            {currentLabel}
            <CalendarIcon className="w-5 h-5" />
          </button>

          {/* Period Picker Dropdown */}
          {showPicker && (
            <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl p-4 z-50 min-w-[200px] max-h-[300px] overflow-y-auto">
              <h4 className="text-sm font-semibold text-slate-200 mb-3">Select {periodType}</h4>
              <div className="space-y-1">
                {isYearly ? (
                  availableYears.map((year, index) => {
                    const isSelected = index === currentYearIndex
                    return (
                      <button
                        key={year}
                        onClick={() => handleSelectAndClose(index)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isSelected
                            ? 'bg-accent text-white'
                            : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                        }`}
                      >
                        {year}
                      </button>
                    )
                  })
                ) : (
                  availableQuarters.map((q, index) => {
                    const isSelected = index === currentQuarterIndex
                    const label = `Q${q.quarter} ${q.year}`
                    return (
                      <button
                        key={`${q.year}-Q${q.quarter}`}
                        onClick={() => handleSelectAndClose(index)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          isSelected
                            ? 'bg-accent text-white'
                            : 'text-slate-300 hover:bg-slate-700 hover:text-slate-100'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <button
          onClick={onNext}
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

      {weeklySummaries.length === 0 ? (
        <p className="text-slate-300 text-center py-8">No trading data available for {currentLabel}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {weeklySummaries.map((week) => {
            const effectivePL = includeCommissions ? week.pl : week.pl + week.commissions
            const bgColor = getBgColor(effectivePL)
            const textColor = getTextColor(effectivePL)
            const borderColor = getBorderColor(effectivePL)

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

      {/* Period Summary Stats */}
      {weeklySummaries.length > 0 && (
        <div className="mt-6 pt-6 border-t border-slate-600">
          <h3 className="text-sm font-semibold text-slate-100 mb-4">{periodType} Statistics by Week</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
              <div className="text-xs text-slate-400 mb-1">{periodType} P&L</div>
              <div className={`text-lg font-bold ${totalPL >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                {formatCurrency(totalPL)}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-600">
              <div className="text-xs text-slate-400 mb-1">Weeks</div>
              <div className="text-lg font-bold text-slate-200">{weeklySummaries.length}</div>
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
      )}
    </div>
  )
}
