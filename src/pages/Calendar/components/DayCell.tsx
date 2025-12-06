import { formatCurrency } from '@/utils/formatting/currency'
import type { DailyPLData } from '../types'

interface DayCellProps {
  dayData: DailyPLData
  bgColor: string
  textColor: string
  borderColor: string
  includeCommissions: boolean
}

export function DayCell({ dayData, bgColor, textColor, borderColor, includeCommissions }: DayCellProps) {
  const dayNum = parseInt(dayData.tradingDay.split('-')[2], 10)
  const isCurrentMonth = dayData.isCurrentMonth !== false
  // includeCommissions = !showGrossPL from toggle
  // true = Net (pl + commissions where commissions is negative), false = Gross (just pl)
  const effectivePL = includeCommissions ? dayData.pl + dayData.commissions : dayData.pl

  if (dayData.isHoliday) {
    return (
      <div className={`h-24 bg-tertiary rounded px-2 py-2 flex flex-col justify-between ${!isCurrentMonth ? 'opacity-60' : ''}`}>
        <div className="text-xs text-secondary font-semibold">{dayNum}</div>
        <div className="text-xs text-secondary font-medium text-center">Holiday</div>
        <div className="text-xs text-tertiary text-center">{dayData.holidayName}</div>
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
        isCurrentMonth ? `border ${borderColor}` : 'border border-theme'
      }`}
      title={tooltipParts.join(' | ')}
    >
      <div className={`text-sm font-semibold ${isCurrentMonth ? 'text-secondary' : 'text-muted'}`}>
        {dayNum}
      </div>
      <div className={`text-base font-bold ${textColor} text-center`}>
        {formatCurrency(effectivePL)}
      </div>
      <div className={`text-sm ${isCurrentMonth ? 'text-tertiary' : 'text-muted'} text-center`}>
        {dayData.trades} trades
      </div>
    </div>
  )
}
