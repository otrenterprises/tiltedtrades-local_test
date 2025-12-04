import { format } from 'date-fns'
import { BookOpen, Plus } from 'lucide-react'
import { Trade } from '@/types/execution.types'
import { formatCurrency, getPLColor } from '@/utils/formatting/currency'

interface MobileTradeCardProps {
  trade: Trade
  onJournalClick: (trade: Trade) => void
  onAddJournal: (trade: Trade) => void
}

export function MobileTradeCard({ trade, onJournalClick, onAddJournal }: MobileTradeCardProps) {
  const plColor = getPLColor(trade.pl)

  return (
    <div className="bg-dark-secondary border border-dark-border rounded-lg p-4 active:bg-dark-tertiary/30 transition-colors">
      {/* Top row: Symbol/Side and P&L */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-200 text-base">{trade.symbol}</span>
          <span
            className={`text-xs font-medium px-1.5 py-0.5 rounded ${
              trade.side === 'Long'
                ? 'bg-profit/20 text-profit'
                : 'bg-loss/20 text-loss'
            }`}
          >
            {trade.side}
          </span>
        </div>
        <div className="text-right">
          <div className={`font-mono font-bold text-lg ${plColor}`}>
            {formatCurrency(trade.pl)}
          </div>
        </div>
      </div>

      {/* Middle row: Date/Time and Trade Details */}
      <div className="flex justify-between items-center text-sm mb-3">
        <div className="text-slate-400">
          <div>{format(trade.exitDate || trade.entryDate, 'MMM dd, yyyy')}</div>
          <div className="text-xs font-mono text-slate-500">
            {format(trade.exitDate || trade.entryDate, 'HH:mm:ss')}
          </div>
        </div>
        <div className="text-right text-slate-400">
          <div>
            <span className="font-mono">{trade.entryPrice.toFixed(2)}</span>
            <span className="text-slate-500 mx-1">→</span>
            <span className="font-mono">{trade.exitPrice?.toFixed(2) || '—'}</span>
          </div>
          <div className="text-xs text-slate-500">
            {trade.quantity} {trade.quantity === 1 ? 'contract' : 'contracts'}
          </div>
        </div>
      </div>

      {/* Bottom row: Commission and Journal action */}
      <div className="flex justify-between items-center pt-2 border-t border-dark-border/50">
        <div className="text-xs text-slate-500">
          Comm: <span className="text-loss font-mono">{formatCurrency(trade.commission)}</span>
        </div>
        <div>
          {trade.hasJournal ? (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onJournalClick(trade)
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-accent/20 text-accent active:bg-accent/30 transition-colors touch-target"
            >
              <BookOpen className="w-4 h-4" />
              <span>Journal</span>
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onAddJournal(trade)
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-dark-tertiary text-slate-400 active:bg-dark-tertiary/70 active:text-slate-200 transition-colors touch-target"
            >
              <Plus className="w-4 h-4" />
              <span>Add Note</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
