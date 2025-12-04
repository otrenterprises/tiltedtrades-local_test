import { formatCurrency } from '@/utils/formatting/currency'
import type { MonthCalendarData, DailyPLData } from '../types'

interface MobileCalendarAgendaProps {
  calendarData: MonthCalendarData
  includeCommissions: boolean
  showWeeklyTotals: boolean
}

// Style helper functions
const getEffectivePL = (pl: number, commissions: number, includeCommissions: boolean): number => {
  return includeCommissions ? pl : pl + commissions
}

const getPLColor = (pl: number): string => {
  if (pl === 0) return 'text-slate-400'
  if (pl > 0) return 'text-profit'
  return 'text-loss'
}

const getPLBgColor = (pl: number): string => {
  if (pl === 0) return 'bg-slate-800/50'
  if (pl > 0) return 'bg-profit/10'
  return 'bg-loss/10'
}

export function MobileCalendarAgenda({ calendarData, includeCommissions, showWeeklyTotals }: MobileCalendarAgendaProps) {
  // Flatten all days from weeks into a single sorted array
  const allDays: DailyPLData[] = []

  calendarData.weeks.forEach(week => {
    week.days.forEach(dayData => {
      if (dayData && dayData.isCurrentMonth) {
        allDays.push(dayData)
      }
    })
  })

  // Sort by date (newest first for better UX on mobile)
  allDays.sort((a, b) => b.tradingDay.localeCompare(a.tradingDay))

  // Separate into days with trades and days without
  const tradingDays = allDays.filter(day => day.trades > 0)

  if (tradingDays.length === 0) {
    return (
      <div className="bg-dark-secondary border border-dark-border rounded-lg p-6 text-center">
        <p className="text-slate-400">No trading days this month</p>
      </div>
    )
  }

  // Get weeks with trading activity, sorted by week number (newest first)
  const weeksWithTrades = calendarData.weeks
    .filter(week => week.weeklyPL && week.weeklyPL.trades > 0)
    .sort((a, b) => b.weekNum - a.weekNum)

  return (
    <div className="space-y-4">
      {/* Weekly Totals Section */}
      {showWeeklyTotals && weeksWithTrades.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-300 px-1">Weekly Totals</h3>
          {weeksWithTrades.map(week => {
            const weeklyPL = week.weeklyPL!
            const effectivePL = getEffectivePL(weeklyPL.pl, weeklyPL.commissions, includeCommissions)

            return (
              <div
                key={`${week.year}-W${week.weekNum}`}
                className={`${getPLBgColor(effectivePL)} border border-dark-border rounded-lg p-4`}
              >
                <div className="flex items-center justify-between">
                  {/* Week info */}
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[50px]">
                      <div className="text-xs text-slate-500 uppercase">Week</div>
                      <div className="text-xl font-bold text-slate-200">{week.weekNum}</div>
                      <div className="text-xs text-slate-500">{week.year}</div>
                    </div>

                    <div className="border-l border-dark-border pl-3">
                      <div className="text-sm text-slate-300">
                        {weeklyPL.trades} {weeklyPL.trades === 1 ? 'trade' : 'trades'}
                      </div>
                      {weeklyPL.commissions !== 0 && (
                        <div className="text-xs text-slate-500">
                          Comm: {formatCurrency(weeklyPL.commissions)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* P&L */}
                  <div className="text-right">
                    <div className={`text-lg font-bold font-mono ${getPLColor(effectivePL)}`}>
                      {formatCurrency(effectivePL)}
                    </div>
                    {!includeCommissions && weeklyPL.commissions !== 0 && (
                      <div className="text-xs text-slate-500">
                        Gross: {formatCurrency(weeklyPL.pl)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Daily Trading Days Section */}
      <div className="space-y-2">
        {showWeeklyTotals && weeksWithTrades.length > 0 && (
          <h3 className="text-sm font-semibold text-slate-300 px-1">Daily Breakdown</h3>
        )}
        {tradingDays.map(day => {
          const date = new Date(day.tradingDay)
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
          const dayNum = date.getDate()
          const monthName = date.toLocaleDateString('en-US', { month: 'short' })
          const effectivePL = getEffectivePL(day.pl, day.commissions, includeCommissions)

          return (
            <div
              key={day.tradingDay}
              className={`${getPLBgColor(effectivePL)} border border-dark-border rounded-lg p-4 transition-colors active:bg-dark-tertiary/50`}
            >
              <div className="flex items-center justify-between">
                {/* Date info */}
                <div className="flex items-center gap-3">
                  <div className="text-center min-w-[50px]">
                    <div className="text-xs text-slate-500 uppercase">{dayName}</div>
                    <div className="text-xl font-bold text-slate-200">{dayNum}</div>
                    <div className="text-xs text-slate-500">{monthName}</div>
                  </div>

                  <div className="border-l border-dark-border pl-3">
                    <div className="text-sm text-slate-300">
                      {day.trades} {day.trades === 1 ? 'trade' : 'trades'}
                    </div>
                    {day.commissions !== 0 && (
                      <div className="text-xs text-slate-500">
                        Comm: {formatCurrency(day.commissions)}
                      </div>
                    )}
                  </div>
                </div>

                {/* P&L */}
                <div className="text-right">
                  <div className={`text-lg font-bold font-mono ${getPLColor(effectivePL)}`}>
                    {formatCurrency(effectivePL)}
                  </div>
                  {!includeCommissions && day.commissions !== 0 && (
                    <div className="text-xs text-slate-500">
                      Gross: {formatCurrency(day.pl)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
