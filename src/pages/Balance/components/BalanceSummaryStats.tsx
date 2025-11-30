import { TrendingUp, TrendingDown, DollarSign, Receipt } from 'lucide-react'
import { formatCurrency } from '@/utils/formatting/currency'

interface BalanceSummaryStatsProps {
  totalDeposits: number
  totalWithdrawals: number
  totalFees: number
  totalCommissionAdjustments: number
}

export function BalanceSummaryStats({
  totalDeposits,
  totalWithdrawals,
  totalFees,
  totalCommissionAdjustments,
}: BalanceSummaryStatsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
      <div className="bg-dark-secondary border border-dark-border rounded-lg p-4 md:p-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs md:text-sm text-slate-400">Total Deposits</p>
          <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-profit flex-shrink-0" />
        </div>
        <p className="text-lg md:text-2xl font-bold text-profit truncate">{formatCurrency(totalDeposits)}</p>
      </div>

      <div className="bg-dark-secondary border border-dark-border rounded-lg p-4 md:p-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs md:text-sm text-slate-400">Total Withdrawals</p>
          <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-loss flex-shrink-0" />
        </div>
        <p className="text-lg md:text-2xl font-bold text-loss truncate">{formatCurrency(totalWithdrawals)}</p>
      </div>

      <div className="bg-dark-secondary border border-dark-border rounded-lg p-4 md:p-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs md:text-sm text-slate-400">Total Fees</p>
          <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-caution flex-shrink-0" />
        </div>
        <p className="text-lg md:text-2xl font-bold text-caution truncate">{formatCurrency(totalFees)}</p>
      </div>

      <div className="bg-dark-secondary border border-dark-border rounded-lg p-4 md:p-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs md:text-sm text-slate-400">Commission Adj.</p>
          <Receipt className="w-4 h-4 md:w-5 md:h-5 text-purple-400 flex-shrink-0" />
        </div>
        <p className={`text-lg md:text-2xl font-bold truncate ${totalCommissionAdjustments >= 0 ? 'text-profit' : 'text-loss'}`}>
          {formatCurrency(totalCommissionAdjustments)}
        </p>
      </div>
    </div>
  )
}
