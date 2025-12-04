import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, BookOpen, Plus, Edit3 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { PageLayout } from '@/components/layout/PageLayout'
import { MobileSettingsToggle } from '@/components/layout/MobileSettingsToggle'
import { Trade } from '@/types/execution.types'
import { formatCurrency, getPLColor } from '@/utils/formatting/currency'
import { formatPercentage } from '@/utils/formatting/number'
import { JournalQuickModal } from '@/components/journal/JournalQuickModal'
import { useTrades } from '@/hooks/useTrades'
import { MobileTradeCard } from './components/MobileTradeCard'

interface TradeLogProps {
  calculationMethod: 'fifo' | 'perPosition'
}

type SortDirection = 'asc' | 'desc'

export function TradeLog({ calculationMethod }: TradeLogProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [dateSortDirection, setDateSortDirection] = useState<SortDirection>('desc')
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)

  // Fetch trades from API
  const { data: tradesData, isLoading, error } = useTrades({
    method: calculationMethod,
  })

  const trades = tradesData?.trades || []

  // Toggle sort direction
  const toggleDateSort = () => {
    setDateSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    setCurrentPage(1) // Reset to first page when sorting changes
  }

  // Handle journal modal close with refresh - invalidate trades query to refresh hasJournal flag
  const handleJournalSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['trades'] })
  }

  // Navigate directly to the journal detail page
  const handleJournalBadgeClick = (trade: Trade, e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(`/app/journals/${trade.id}`, { state: { calculationMethod } })
  }

  // Sort trades by date first, then by time - memoized to recompute only when trades or direction changes
  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => {
      const dateA = a.exitDate || a.entryDate
      const dateB = b.exitDate || b.entryDate

      // Get date-only values (strip time for primary sort)
      const dayA = new Date(dateA)
      dayA.setHours(0, 0, 0, 0)
      const dayB = new Date(dateB)
      dayB.setHours(0, 0, 0, 0)

      const dayDiff = dayB.getTime() - dayA.getTime()

      if (dateSortDirection === 'desc') {
        // If same day, sort by time (most recent time first)
        if (dayDiff === 0) {
          return dateB.getTime() - dateA.getTime()
        }
        // Otherwise sort by day (most recent day first)
        return dayDiff
      } else {
        // If same day, sort by time (earliest time first)
        if (dayDiff === 0) {
          return dateA.getTime() - dateB.getTime()
        }
        // Otherwise sort by day (earliest day first)
        return -dayDiff
      }
    })
  }, [trades, dateSortDirection])

  // Calculate pagination
  const totalPages = Math.ceil(sortedTrades.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentTrades = sortedTrades.slice(startIndex, endIndex)

  // Handle page changes
  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1) // Reset to first page when changing items per page
  }

  // Loading state
  if (isLoading) {
    return (
      <PageLayout title="Trade Log" subtitle="Loading your trades...">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-400">Loading trades...</p>
          </div>
        </div>
      </PageLayout>
    )
  }

  // Error state
  if (error) {
    return (
      <PageLayout title="Trade Log">
        <div className="text-center text-red-400 p-8">
          <p>Error loading trades: {error.message}</p>
          <p className="text-sm text-slate-500 mt-2">Please check your connection and try again.</p>
        </div>
      </PageLayout>
    )
  }

  // Empty state
  if (trades.length === 0) {
    return (
      <PageLayout title="Trade Log" subtitle="No trades yet">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-slate-400">No trades found. Upload your trading data to get started.</p>
          </div>
        </div>
      </PageLayout>
    )
  }

  // Handle journal navigation for mobile
  const handleMobileJournalClick = (trade: Trade) => {
    navigate(`/app/journals/${trade.id}`, { state: { calculationMethod } })
  }

  return (
    <PageLayout
      title="Trade Log"
      subtitle="Complete history of all your trades"
      mobileSettings={<MobileSettingsToggle showMethodToggle />}
    >
      {/* ===== MOBILE VIEW ===== */}
      <div className="md:hidden">
        {/* Mobile header with sort and count */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={toggleDateSort}
            className="flex items-center gap-1.5 px-3 py-2 bg-dark-secondary border border-dark-border rounded-lg text-sm text-slate-300 active:bg-dark-tertiary transition-colors"
          >
            {dateSortDirection === 'desc' ? 'Newest First' : 'Oldest First'}
            {dateSortDirection === 'desc' ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronUp className="w-4 h-4" />
            )}
          </button>
          <span className="text-xs text-slate-500">
            {startIndex + 1}-{Math.min(endIndex, sortedTrades.length)} of {sortedTrades.length}
          </span>
        </div>

        {/* Mobile trade cards */}
        <div className="space-y-3">
          {currentTrades.map((trade) => (
            <MobileTradeCard
              key={trade.id}
              trade={trade}
              onJournalClick={handleMobileJournalClick}
              onAddJournal={setSelectedTrade}
            />
          ))}
        </div>

        {/* Mobile pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between gap-2">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className={`flex-1 flex items-center justify-center gap-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors touch-target ${
                currentPage === 1
                  ? 'bg-dark-tertiary/50 text-slate-500'
                  : 'bg-dark-tertiary text-slate-300 active:bg-dark-tertiary/70'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>

            <div className="flex items-center gap-1">
              {/* Show fewer pages on mobile */}
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-accent text-white'
                        : 'bg-dark-secondary text-slate-400 active:bg-dark-tertiary'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`flex-1 flex items-center justify-center gap-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors touch-target ${
                currentPage === totalPages
                  ? 'bg-dark-tertiary/50 text-slate-500'
                  : 'bg-dark-tertiary text-slate-300 active:bg-dark-tertiary/70'
              }`}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* ===== DESKTOP VIEW ===== */}
      <div className="hidden md:block bg-dark-secondary border border-dark-border rounded-lg p-6">
        {/* Items per page selector */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-400">Show:</span>
            <div className="flex gap-1">
              {[20, 50, 100].map((count) => (
                <button
                  key={count}
                  onClick={() => handleItemsPerPageChange(count)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    itemsPerPage === count
                      ? 'bg-accent text-white'
                      : 'bg-dark-tertiary text-slate-300 hover:bg-dark-tertiary/70 hover:text-white'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>
            <span className="text-sm text-slate-400">per page</span>
          </div>
          <div className="text-sm text-slate-400">
            Showing {startIndex + 1}-{Math.min(endIndex, sortedTrades.length)} of {sortedTrades.length} trades
          </div>
        </div>

        {/* Trade table */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b-2 border-dark-border">
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">
                  <button
                    onClick={toggleDateSort}
                    className="flex items-center gap-1 hover:text-white transition-colors"
                  >
                    Date
                    {dateSortDirection === 'desc' ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronUp className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Time</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Symbol</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Side</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-300">Entry</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-300">Exit</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-300">Qty</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-300">Comm</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-300">P&L</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-300">%</th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-slate-300">Journal</th>
              </tr>
            </thead>
            <tbody>
              {currentTrades.map((trade) => {
                return (
                  <tr key={trade.id} className="border-b border-dark-border/50 hover:bg-dark-tertiary/30 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-300">
                      {format(trade.exitDate || trade.entryDate, 'MM/dd/yyyy')}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 font-mono">
                      {format(trade.exitDate || trade.entryDate, 'HH:mm:ss')}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-200">
                      {trade.symbol}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {trade.side}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-slate-300">
                      {trade.entryPrice.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-slate-300">
                      {trade.exitPrice?.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-slate-400">
                      {trade.quantity}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-loss font-mono">
                      <span className="inline-flex items-center gap-1">
                        {trade.hasCommissionOverride && (
                          <span title="Commission has been overridden">
                            <Edit3 className="w-3 h-3 text-yellow-400" />
                          </span>
                        )}
                        {formatCurrency(trade.commission)}
                      </span>
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-semibold font-mono ${getPLColor(trade.pl)}`}>
                      {formatCurrency(trade.pl)}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right font-mono ${getPLColor(trade.pl)}`}>
                      {formatPercentage(trade.plPercent)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {trade.hasJournal ? (
                          <button
                            onClick={(e) => handleJournalBadgeClick(trade, e)}
                            className="p-1.5 rounded-md transition-colors bg-accent/20 text-accent hover:bg-accent/30"
                            title="Journal exists for this trade"
                          >
                            <BookOpen className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setSelectedTrade(trade)}
                            className="p-1.5 bg-dark-tertiary text-slate-400 hover:bg-accent/20 hover:text-accent rounded-md transition-colors"
                            title="Add journal entry"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Desktop pagination controls */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPage === 1
                  ? 'bg-dark-tertiary/50 text-slate-500 cursor-not-allowed'
                  : 'bg-dark-tertiary text-slate-300 hover:bg-dark-tertiary/70 hover:text-white'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <div className="flex items-center gap-2">
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let pageNum: number

                if (totalPages <= 7) {
                  pageNum = i + 1
                } else if (currentPage <= 4) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 3) {
                  pageNum = totalPages - 6 + i
                } else {
                  pageNum = currentPage - 3 + i
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={`w-10 h-10 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-accent text-white'
                        : 'bg-dark-tertiary text-slate-300 hover:bg-dark-tertiary/70 hover:text-white'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPage === totalPages
                  ? 'bg-dark-tertiary/50 text-slate-500 cursor-not-allowed'
                  : 'bg-dark-tertiary text-slate-300 hover:bg-dark-tertiary/70 hover:text-white'
              }`}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Journal Quick Modal */}
      {selectedTrade && (
        <JournalQuickModal
          trade={selectedTrade}
          calculationMethod={calculationMethod === 'fifo' ? 'FIFO' : 'Per Position'}
          onClose={() => setSelectedTrade(null)}
          onSaved={handleJournalSaved}
        />
      )}
    </PageLayout>
  )
}
