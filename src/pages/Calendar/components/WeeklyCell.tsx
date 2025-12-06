import { formatCurrency } from '@/utils/formatting/currency'

interface WeeklyCellProps {
  weeklyPL: number
  commissions: number
  trades: number
  days: number
  bgColor: string
  textColor: string
  includeCommissions: boolean
}

export function WeeklyCell({ weeklyPL, commissions, trades, days, bgColor, textColor, includeCommissions }: WeeklyCellProps) {
  // includeCommissions = !showGrossPL: true = Net (weeklyPL + commissions), false = Gross (weeklyPL)
  const effectivePL = includeCommissions ? weeklyPL + commissions : weeklyPL

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
