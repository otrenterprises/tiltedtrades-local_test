import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'
import { formatCurrency } from '@/utils/formatting/currency'
import type { MonthlySummary } from '../types'

interface CalendarMonthlyViewProps {
  monthlySummaries: MonthlySummary[]
  includeCommissions: boolean
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

export function CalendarMonthlyView({
  monthlySummaries,
  includeCommissions,
  availableYears,
  currentYearIndex,
  currentYear,
  canGoPreviousYear,
  canGoNextYear,
  onPreviousYear,
  onNextYear,
  onYearSelect,
}: CalendarMonthlyViewProps) {
  const [showYearPicker, setShowYearPicker] = useState(false)
  const yearPickerRef = useRef<HTMLDivElement>(null)

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

  const handleYearSelectAndClose = (index: number) => {
    onYearSelect(index)
    setShowYearPicker(false)
  }

  // Calculate year statistics
  const totalPL = monthlySummaries.reduce((sum, m) => sum + (includeCommissions ? m.pl : m.pl + m.commissions), 0)
  const totalTrades = monthlySummaries.reduce((sum, m) => sum + m.trades, 0)
  const totalDays = monthlySummaries.reduce((sum, m) => sum + m.tradingDays, 0)
  const winningMonths = monthlySummaries.filter(m => (includeCommissions ? m.pl : m.pl + m.commissions) > 0).length
  const winRate = monthlySummaries.length > 0 ? (winningMonths / monthlySummaries.length) * 100 : 0
  const avgMonthlyPL = monthlySummaries.length > 0 ? totalPL / monthlySummaries.length : 0

  return (
    <div className="bg-slate-700 border border-slate-600 rounded-lg p-3 md:p-6">
      {/* Year navigation header */}
      <div className="flex items-center justify-between mb-4 md:mb-6 relative">
        <button
          onClick={onPreviousYear}
          disabled={!canGoPreviousYear}
          className={`p-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
            canGoPreviousYear
              ? 'bg-blue-900 border border-blue-800 active:bg-blue-800 md:hover:bg-blue-800 text-blue-200'
              : 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
          }`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="relative flex-1 flex justify-center" ref={yearPickerRef}>
          <button
            onClick={() => setShowYearPicker(!showYearPicker)}
            className="text-lg md:text-2xl font-bold text-slate-50 hover:text-accent transition-colors flex items-center gap-1.5 md:gap-2 px-2"
          >
            <span>{currentYear}</span>
            <CalendarIcon className="w-4 h-4 md:w-5 md:h-5 flex-shrink-0" />
          </button>

          {/* Year Picker Dropdown */}
          {showYearPicker && (
            <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl p-3 md:p-4 z-50 w-[calc(100vw-2rem)] max-w-[200px] max-h-[60vh] md:max-h-[300px] overflow-y-auto">
              <h4 className="text-sm font-semibold text-slate-200 mb-3">Select Year</h4>
              <div className="space-y-1">
                {availableYears.map((year, index) => {
                  const isSelected = index === currentYearIndex

                  return (
                    <button
                      key={year}
                      onClick={() => handleYearSelectAndClose(index)}
                      className={`w-full text-left px-3 py-2.5 md:py-2 rounded-lg text-sm font-medium transition-colors ${
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
          onClick={onNextYear}
          disabled={!canGoNextYear}
          className={`p-2 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center ${
            canGoNextYear
              ? 'bg-blue-900 border border-blue-800 active:bg-blue-800 md:hover:bg-blue-800 text-blue-200'
              : 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
          }`}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {monthlySummaries.length === 0 ? (
        <p className="text-slate-300 text-center py-8">No trading data available for {currentYear}</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {monthlySummaries.map((month) => {
            const effectivePL = includeCommissions ? month.pl : month.pl + month.commissions
            const bgColor = getBgColor(effectivePL)
            const textColor = getTextColor(effectivePL)
            const borderColor = getBorderColor(effectivePL)
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

      {/* Year Summary Stats */}
      {monthlySummaries.length > 0 && (
        <div className="mt-4 md:mt-6 pt-4 md:pt-6 border-t border-slate-600">
          <h3 className="text-sm font-semibold text-slate-100 mb-3 md:mb-4">Yearly Statistics by Month</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
            <div className="bg-slate-800/50 rounded-lg p-3 md:p-4 border border-slate-600">
              <div className="text-[10px] md:text-xs text-slate-400 mb-0.5 md:mb-1">Year P&L</div>
              <div className={`text-base md:text-lg font-bold ${totalPL >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                {formatCurrency(totalPL)}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 md:p-4 border border-slate-600">
              <div className="text-[10px] md:text-xs text-slate-400 mb-0.5 md:mb-1">Avg Monthly</div>
              <div className={`text-base md:text-lg font-bold ${avgMonthlyPL >= 0 ? 'text-teal-400' : 'text-red-400'}`}>
                {formatCurrency(avgMonthlyPL)}
              </div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 md:p-4 border border-slate-600">
              <div className="text-[10px] md:text-xs text-slate-400 mb-0.5 md:mb-1">Trading Days</div>
              <div className="text-base md:text-lg font-bold text-slate-200">{totalDays}</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 md:p-4 border border-slate-600">
              <div className="text-[10px] md:text-xs text-slate-400 mb-0.5 md:mb-1">Total Trades</div>
              <div className="text-base md:text-lg font-bold text-slate-200">{totalTrades}</div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-3 md:p-4 border border-slate-600 col-span-2 md:col-span-1">
              <div className="text-[10px] md:text-xs text-slate-400 mb-0.5 md:mb-1">Win Rate</div>
              <div className={`text-base md:text-lg font-bold ${winRate >= 50 ? 'text-teal-400' : 'text-red-400'}`}>
                {winRate.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
