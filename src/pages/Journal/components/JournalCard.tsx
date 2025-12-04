import { forwardRef } from 'react'
import { parseISO, format } from 'date-fns'
import { formatCurrency } from '@/utils/formatting'
import type { TradeJournal } from '@/types/api/journal.types'
import type { MatchedTrade } from '@/types/api/trade.types'

interface JournalCardProps {
  journal: TradeJournal
  trade: MatchedTrade | undefined
  isExpanded: boolean
  onClick: () => void
}

export const JournalCard = forwardRef<HTMLDivElement, JournalCardProps>(
  ({ journal, trade, isExpanded, onClick }, ref) => {
    return (
      <div
        ref={ref}
        className={`bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition cursor-pointer ${
          isExpanded ? 'ring-2 ring-accent shadow-lg shadow-accent/20' : ''
        }`}
        onClick={onClick}
      >
        {/* Trade Info */}
        <div className="mb-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-white">
                {journal.symbol || trade?.symbol || 'Unknown Symbol'}
              </h3>
              {journal.calculationMethod && (
                <span className={`text-xs px-2 py-0.5 rounded ${
                  journal.calculationMethod === 'fifo'
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'bg-purple-600/20 text-purple-400'
                }`}>
                  {journal.calculationMethod === 'fifo' ? 'FIFO' : 'Positional'}
                </span>
              )}
            </div>
            <span className={`text-sm font-medium ${
              trade && (trade.pl + Math.abs(trade.commission || 0)) >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {trade ? formatCurrency(trade.pl + Math.abs(trade.commission || 0)) : 'N/A'}
            </span>
          </div>
          <p className="text-sm text-gray-400">
            {journal.exitDate
              ? format(parseISO(journal.exitDate), 'MMM dd, yyyy')
              : journal.updatedAt
              ? format(parseISO(journal.updatedAt), 'MMM dd, yyyy')
              : 'No date'}
          </p>
        </div>

        {/* Notes Preview */}
        {journal.journalText && (
          <p className="text-gray-300 text-sm mb-4 line-clamp-3">
            {journal.journalText}
          </p>
        )}

        {/* Tags */}
        {journal.tags && journal.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {journal.tags.slice(0, 3).map((tag: string) => (
              <span
                key={tag}
                className="px-2 py-1 bg-blue-600 bg-opacity-20 text-blue-400 text-xs rounded"
              >
                {tag}
              </span>
            ))}
            {journal.tags.length > 3 && (
              <span className="px-2 py-1 text-gray-400 text-xs">
                +{journal.tags.length - 3} more
              </span>
            )}
          </div>
        )}

        {/* Metadata */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>
            {journal.chartReferences?.length || 0} chart{journal.chartReferences?.length !== 1 ? 's' : ''}
          </span>
          <span>View details →</span>
        </div>
      </div>
    )
  }
)

JournalCard.displayName = 'JournalCard'
