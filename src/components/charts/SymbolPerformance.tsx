import { formatCurrency } from '@/utils/formatting/currency'
import { formatPercentage } from '@/utils/formatting/number'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface SymbolPerformanceProps {
  data: Array<{
    symbol: string
    pl: number
    trades: number
    winRate: number
    grossPL: number
    commission: number
  }>
}

export function SymbolPerformance({ data }: SymbolPerformanceProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-tertiary">
        No symbol data available
      </div>
    )
  }

  return (
    <div className="bg-secondary border border-theme rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-primary mb-1">Performance by Symbol</h3>
        <p className="text-sm text-tertiary">Breakdown by instrument</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.map((item) => (
          <div
            key={item.symbol}
            className={`p-4 rounded-lg border ${
              item.pl >= 0
                ? 'bg-profit/5 border-profit/20'
                : 'bg-loss/5 border-loss/20'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-lg font-bold text-primary">{item.symbol}</h4>
                <p className="text-xs text-tertiary">{item.trades} trades</p>
              </div>
              {item.pl >= 0 ? (
                <TrendingUp className="w-5 h-5 text-profit" />
              ) : (
                <TrendingDown className="w-5 h-5 text-loss" />
              )}
            </div>

            <div className="space-y-2">
              <div>
                <p className="text-xs text-tertiary">P&L</p>
                <p className={`text-xl font-bold font-mono ${
                  item.pl >= 0 ? 'text-profit' : 'text-loss'
                }`}>
                  {formatCurrency(item.pl)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-theme">
                <div>
                  <p className="text-xs text-tertiary">Win Rate</p>
                  <p className="text-sm font-semibold text-secondary">
                    {formatPercentage(item.winRate)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-tertiary">Commission</p>
                  <p className="text-sm font-semibold text-loss">
                    {formatCurrency(item.commission)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
