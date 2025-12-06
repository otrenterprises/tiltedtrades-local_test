import { Edit, Trash2, Repeat, Receipt } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { formatCurrency } from '@/utils/formatting/currency'
import type { ApiBalanceEntry } from '@/types/api/balance.types'

interface TransactionTableProps {
  entries: ApiBalanceEntry[]
  onEditEntry: (entry: ApiBalanceEntry) => void
  onDeleteEntry: (entryId: string) => void
}

export function TransactionTable({ entries, onEditEntry, onDeleteEntry }: TransactionTableProps) {
  const getTypeBadgeStyle = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'bg-profit/20 text-profit'
      case 'withdrawal':
        return 'bg-loss/20 text-loss'
      case 'fee':
        return 'bg-caution/20 text-caution'
      case 'commission_adjustment':
        return 'bg-purple-500/20 text-purple-400'
      default:
        return 'bg-tertiary/20 text-tertiary'
    }
  }

  const getTypeLabel = (type: string) => {
    if (type === 'commission_adjustment') {
      return 'Comm. Adj.'
    }
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  const getTypeLabelFull = (type: string) => {
    if (type === 'commission_adjustment') {
      return 'Bulk Commission Adj.'
    }
    return type.charAt(0).toUpperCase() + type.slice(1)
  }

  // Helper to calculate display amount
  const getDisplayAmount = (entry: ApiBalanceEntry) => {
    return entry.type === 'commission_adjustment'
      ? entry.amount
      : entry.type === 'deposit'
        ? entry.amount
        : -entry.amount
  }

  return (
    <div className="bg-secondary border border-theme rounded-lg p-4 md:p-6">
      <h3 className="text-base md:text-lg font-semibold text-primary mb-3 md:mb-4">Transaction History</h3>

      {/* Empty state */}
      {entries.length === 0 && (
        <p className="text-center text-tertiary py-8">
          No entries yet. Click "Add Entry" to get started.
        </p>
      )}

      {entries.length > 0 && (
        <>
          {/* ===== MOBILE VIEW: Card-based list ===== */}
          <div className="md:hidden space-y-3">
            {entries.map((entry) => {
              const isGenerated = entry.generatedFromTemplate
              const displayAmount = getDisplayAmount(entry)

              return (
                <div
                  key={entry.entryId}
                  className="bg-tertiary rounded-lg p-3 active:bg-tertiary/70 transition-colors"
                >
                  {/* Top row: Type badge and Amount */}
                  <div className="flex justify-between items-start mb-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getTypeBadgeStyle(entry.type)}`}
                    >
                      {isGenerated && <Repeat className="w-3 h-3" />}
                      {entry.type === 'commission_adjustment' && <Receipt className="w-3 h-3" />}
                      {getTypeLabel(entry.type)}
                    </span>
                    <span className={`font-mono font-bold text-base ${displayAmount >= 0 ? 'text-profit' : 'text-loss'}`}>
                      {formatCurrency(displayAmount)}
                    </span>
                  </div>

                  {/* Middle row: Description */}
                  <p className="text-sm text-secondary mb-1 line-clamp-2">{entry.description}</p>
                  {entry.type === 'commission_adjustment' && entry.commissionMeta && (
                    <p className="text-xs text-tertiary mb-2">
                      {entry.commissionMeta.tradeCount && `${entry.commissionMeta.tradeCount} trades`}
                      {entry.commissionMeta.contractCount && `, ${entry.commissionMeta.contractCount} contracts`}
                    </p>
                  )}

                  {/* Bottom row: Date and Actions */}
                  <div className="flex justify-between items-center pt-2 border-t border-theme/50">
                    <div className="text-xs text-tertiary">
                      {format(parseISO(entry.date), 'MMM dd, yyyy')}
                    </div>
                    {!isGenerated && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onEditEntry(entry)}
                          className="p-2 hover:bg-hover active:bg-hover/70 rounded-lg transition-colors touch-target"
                        >
                          <Edit className="w-4 h-4 text-tertiary" />
                        </button>
                        <button
                          onClick={() => onDeleteEntry(entry.entryId)}
                          className="p-2 hover:bg-hover active:bg-hover/70 rounded-lg transition-colors touch-target"
                        >
                          <Trash2 className="w-4 h-4 text-tertiary" />
                        </button>
                      </div>
                    )}
                    {isGenerated && (
                      <span className="text-xs text-muted italic">Auto-generated</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ===== DESKTOP VIEW: Table ===== */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b-2 border-theme">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-secondary">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-secondary">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-secondary">Description</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-secondary">Amount</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-secondary">Funding</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-secondary">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => {
                  const isGenerated = entry.generatedFromTemplate
                  const displayAmount = getDisplayAmount(entry)

                  return (
                    <tr
                      key={entry.entryId}
                      className="border-b border-theme/50 hover:bg-tertiary/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-secondary">
                        {format(parseISO(entry.date), 'MM/dd/yyyy')}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getTypeBadgeStyle(entry.type)}`}
                        >
                          {isGenerated && <Repeat className="w-3 h-3" />}
                          {entry.type === 'commission_adjustment' && <Receipt className="w-3 h-3" />}
                          {getTypeLabelFull(entry.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-secondary">
                        {entry.description}
                        {entry.type === 'commission_adjustment' && entry.commissionMeta && (
                          <span className="block text-xs text-tertiary mt-1">
                            {entry.commissionMeta.tradeCount && `${entry.commissionMeta.tradeCount} trades`}
                            {entry.commissionMeta.contractCount && `, ${entry.commissionMeta.contractCount} contracts`}
                            {entry.commissionMeta.startDate && ` (${entry.commissionMeta.startDate}`}
                            {entry.commissionMeta.endDate && ` - ${entry.commissionMeta.endDate})`}
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-sm text-right font-semibold font-mono ${
                        displayAmount >= 0 ? 'text-profit' : 'text-loss'
                      }`}>
                        {formatCurrency(displayAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-mono text-secondary">
                        {formatCurrency(entry.balance || 0)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!isGenerated && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => onEditEntry(entry)}
                              className="p-2 hover:bg-hover rounded transition-colors"
                            >
                              <Edit className="w-4 h-4 text-tertiary hover:text-secondary" />
                            </button>
                            <button
                              onClick={() => onDeleteEntry(entry.entryId)}
                              className="p-2 hover:bg-hover rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-tertiary hover:text-red-400" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
