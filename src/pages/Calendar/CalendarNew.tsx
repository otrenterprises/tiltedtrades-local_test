import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { PageLayout } from '@/components/layout/PageLayout'
import { useCalendarData } from './hooks/useCalendarData'
import { ViewSelector, CalendarDailyView, CalendarWeeklyView, CalendarMonthlyView } from './components'
import type { ViewType, WeeklyGrouping } from './types'

interface CalendarNewProps {
  showGrossPL: boolean
}

export function CalendarNew({ showGrossPL }: CalendarNewProps) {
  const [viewType, setViewType] = useState<ViewType>('daily')
  const [weeklyGrouping, setWeeklyGrouping] = useState<WeeklyGrouping>('quarterly')
  const [showWeeklyTotals, setShowWeeklyTotals] = useState(true)

  // includeCommissions is the inverse of showGrossPL
  // When showGrossPL = false (Net P&L), we include commissions in calculations
  // When showGrossPL = true (Gross P&L), we exclude commissions
  const includeCommissions = !showGrossPL

  const {
    isLoading,
    error,
    calendarData,
    filteredWeeklySummaries,
    filteredWeeklySummariesByYear,
    filteredMonthlySummaries,
    availableMonths,
    availableQuarters,
    availableYears,
    currentMonthIndex,
    currentQuarterIndex,
    currentYearIndex,
    canGoPreviousMonth,
    canGoNextMonth,
    canGoPreviousQuarter,
    canGoNextQuarter,
    canGoPreviousYear,
    canGoNextYear,
    currentQuarterLabel,
    currentYear,
    handlePreviousMonth,
    handleNextMonth,
    handleMonthSelect,
    handlePreviousQuarter,
    handleNextQuarter,
    handleQuarterSelect,
    handlePreviousYear,
    handleNextYear,
    handleYearSelect,
  } = useCalendarData()

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

  return (
    <PageLayout
      title="Trading Calendar"
      subtitle={
        <div className="flex flex-col gap-2">
          <ViewSelector viewType={viewType} onViewChange={setViewType} />
          {viewType === 'daily' && (
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 w-fit">
              <button
                onClick={() => setShowWeeklyTotals(!showWeeklyTotals)}
                className={`flex items-center justify-center gap-1.5 px-3 py-1.5 h-8 rounded-md text-sm font-medium transition-colors ${
                  showWeeklyTotals
                    ? 'bg-accent text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}
              >
                {showWeeklyTotals ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                Weekly Totals
              </button>
            </div>
          )}
          {viewType === 'weekly' && (
            <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 w-fit">
              <button
                onClick={() => setWeeklyGrouping('quarterly')}
                className={`flex items-center justify-center px-3 py-1.5 h-8 min-w-[90px] rounded-md text-sm font-medium transition-colors ${
                  weeklyGrouping === 'quarterly'
                    ? 'bg-accent text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}
              >
                Quarterly
              </button>
              <button
                onClick={() => setWeeklyGrouping('yearly')}
                className={`flex items-center justify-center px-3 py-1.5 h-8 min-w-[90px] rounded-md text-sm font-medium transition-colors ${
                  weeklyGrouping === 'yearly'
                    ? 'bg-accent text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}
              >
                Yearly
              </button>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Daily View */}
        {viewType === 'daily' && (
          <CalendarDailyView
            calendarData={calendarData}
            showWeeklyTotals={showWeeklyTotals}
            includeCommissions={includeCommissions}
            availableMonths={availableMonths}
            currentMonthIndex={currentMonthIndex}
            canGoPrevious={canGoPreviousMonth}
            canGoNext={canGoNextMonth}
            onPreviousMonth={handlePreviousMonth}
            onNextMonth={handleNextMonth}
            onMonthSelect={handleMonthSelect}
          />
        )}

        {/* Weekly View */}
        {viewType === 'weekly' && (
          <CalendarWeeklyView
            weeklySummaries={weeklyGrouping === 'quarterly' ? filteredWeeklySummaries : filteredWeeklySummariesByYear}
            includeCommissions={includeCommissions}
            grouping={weeklyGrouping}
            // Quarterly props
            availableQuarters={availableQuarters}
            currentQuarterIndex={currentQuarterIndex}
            currentQuarterLabel={currentQuarterLabel}
            canGoPreviousQuarter={canGoPreviousQuarter}
            canGoNextQuarter={canGoNextQuarter}
            onPreviousQuarter={handlePreviousQuarter}
            onNextQuarter={handleNextQuarter}
            onQuarterSelect={handleQuarterSelect}
            // Yearly props
            availableYears={availableYears}
            currentYearIndex={currentYearIndex}
            currentYear={currentYear}
            canGoPreviousYear={canGoPreviousYear}
            canGoNextYear={canGoNextYear}
            onPreviousYear={handlePreviousYear}
            onNextYear={handleNextYear}
            onYearSelect={handleYearSelect}
          />
        )}

        {/* Monthly View */}
        {viewType === 'monthly' && (
          <CalendarMonthlyView
            monthlySummaries={filteredMonthlySummaries}
            includeCommissions={includeCommissions}
            availableYears={availableYears}
            currentYearIndex={currentYearIndex}
            currentYear={currentYear}
            canGoPreviousYear={canGoPreviousYear}
            canGoNextYear={canGoNextYear}
            onPreviousYear={handlePreviousYear}
            onNextYear={handleNextYear}
            onYearSelect={handleYearSelect}
          />
        )}
      </div>
    </PageLayout>
  )
}
