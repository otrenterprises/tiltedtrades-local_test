import { DollarSign } from 'lucide-react'
import { formatCurrency } from '@/utils/formatting/currency'

interface AccountValueCardProps {
  currentAccountValue: number
  netFunding: number // Deposits - Withdrawals only (excludes fees)
  totalTradingPL: number
}

export function AccountValueCard({ currentAccountValue, netFunding, totalTradingPL }: AccountValueCardProps) {
  return (
    <div className="bg-gradient-to-br from-accent to-premium rounded-lg p-4 md:p-6 text-white">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs md:text-sm opacity-90 mb-1">Current Account Value</p>
          <p className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 truncate">{formatCurrency(currentAccountValue)}</p>
          {/* Mobile: Stack vertically, Desktop: Inline */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs md:text-sm opacity-90">
            <span className="truncate">Funding: {formatCurrency(netFunding)}</span>
            <span className={`truncate ${totalTradingPL >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              Trading P&L: {formatCurrency(totalTradingPL)}
            </span>
          </div>
        </div>
        <DollarSign className="w-10 h-10 md:w-16 md:h-16 opacity-20 flex-shrink-0" />
      </div>
    </div>
  )
}
