import { DollarSign } from 'lucide-react'
import { formatCurrency } from '@/utils/formatting/currency'

interface AccountValueCardProps {
  currentAccountValue: number
  currentBalance: number
  totalTradingPL: number
}

export function AccountValueCard({ currentAccountValue, currentBalance, totalTradingPL }: AccountValueCardProps) {
  return (
    <div className="bg-gradient-to-br from-accent to-premium rounded-lg p-6 text-white">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm opacity-90 mb-1">Current Account Value</p>
          <p className="text-4xl font-bold mb-2">{formatCurrency(currentAccountValue)}</p>
          <div className="flex items-center gap-4 text-sm opacity-90">
            <span>Funding: {formatCurrency(currentBalance)}</span>
            <span className={totalTradingPL >= 0 ? 'text-green-300' : 'text-red-300'}>
              Trading P&L: {formatCurrency(totalTradingPL)}
            </span>
          </div>
        </div>
        <DollarSign className="w-16 h-16 opacity-20" />
      </div>
    </div>
  )
}
