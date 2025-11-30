/**
 * Journal List Page
 * Displays all trade journals with search and filter capabilities
 */

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigation } from '@/contexts/NavigationContext'
import { useJournals, useJournalsByTag, useJournalsByDateRange } from '../../hooks/useJournal'
import { useAllTrades } from '../../hooks/useTrades'
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner'
import { ErrorMessage } from '../../components/feedback/ErrorMessage'
import { EmptyState } from '../../components/feedback/EmptyState'
import { formatCurrency } from '../../utils/formatting'
import { parseISO, format } from 'date-fns'

export const JournalList: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isExpanded } = useNavigation()
  const userId = user?.userId || ''
  const [searchParams, setSearchParams] = useSearchParams()

  // Get tradeId from URL params for auto-expansion
  const tradeIdToExpand = searchParams.get('trade')
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(tradeIdToExpand)
  const expandedRef = useRef<HTMLDivElement>(null)

  // State for filters
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })
  const [filterType, setFilterType] = useState<'all' | 'tag' | 'date'>('all')
  const [plType, setPlType] = useState<'all' | 'fifo' | 'perPosition'>('all')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc') // desc = newest first

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // Auto-scroll to expanded journal entry
  useEffect(() => {
    if (tradeIdToExpand && expandedRef.current) {
      setTimeout(() => {
        expandedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
    }
  }, [tradeIdToExpand])

  // Early return if no userId
  if (!userId) {
    return (
      <ErrorMessage
        title="Authentication Required"
        message="Please log in to view your journals."
        fullScreen
      />
    )
  }

  // Fetch journals based on filter type (no limit - Lambda paginates through all)
  const { data: allJournals, isLoading: loadingAll, error: allError } = useJournals(
    userId
  )

  const { data: tagJournals, isLoading: loadingTag } = useJournalsByTag(
    userId,
    selectedTag,
    filterType === 'tag'
  )

  const { data: dateJournals, isLoading: loadingDate } = useJournalsByDateRange(
    userId,
    dateRange.start,
    dateRange.end,
    filterType === 'date'
  )

  // Fetch ALL trades to match with journals (using pagination to get all)
  // Note: We'll fetch trades based on each journal's stored calculation method
  const { data: fifoTradesData, isLoading: loadingFifoTrades } = useAllTrades({ calculationMethod: 'fifo' })
  const { data: perPosTradesData, isLoading: loadingPerPosTrades } = useAllTrades({ calculationMethod: 'perPosition' })

  // Determine which journals to display
  const journals = useMemo(() => {
    if (filterType === 'tag') return tagJournals || []
    if (filterType === 'date') return dateJournals || []
    return allJournals || []
  }, [filterType, allJournals, tagJournals, dateJournals])

  // Filter journals by search term and P&L type, then sort
  const filteredJournals = useMemo(() => {
    let filtered = journals

    // Filter by P&L type (calculation method)
    if (plType !== 'all') {
      filtered = filtered.filter(journal => journal.calculationMethod === plType)
    }

    // Filter by search term (searches text, tags, symbol, and tradeId)
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(journal =>
        journal.journalText?.toLowerCase().includes(search) ||
        journal.tags?.some(tag => tag.toLowerCase().includes(search)) ||
        journal.symbol?.toLowerCase().includes(search) ||
        journal.tradeId.toLowerCase().includes(search)
      )
    }

    // Sort by date
    filtered = [...filtered].sort((a, b) => {
      const dateA = a.exitDate || a.updatedAt || ''
      const dateB = b.exitDate || b.updatedAt || ''
      if (sortOrder === 'desc') {
        return dateB.localeCompare(dateA) // Newest first
      } else {
        return dateA.localeCompare(dateB) // Oldest first
      }
    })

    return filtered
  }, [journals, searchTerm, plType, sortOrder])

  // Extract unique tags from all journals
  const availableTags = useMemo(() => {
    const tags = new Set<string>()
    allJournals?.forEach(journal => {
      journal.tags?.forEach(tag => tags.add(tag))
    })
    return Array.from(tags).sort()
  }, [allJournals])

  // Pagination calculations
  const totalPages = Math.ceil(filteredJournals.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentJournals = filteredJournals.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterType, selectedTag, dateRange, plType])

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)))
  }

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1)
  }

  // Loading state - wait for both journals AND trades to load
  const journalLoading = filterType === 'all' ? loadingAll : filterType === 'tag' ? loadingTag : loadingDate
  const isLoading = journalLoading || loadingFifoTrades || loadingPerPosTrades

  console.log('JournalList render:', {
    isLoading,
    allError,
    journalsCount: journals?.length,
    filteredCount: filteredJournals?.length,
    filterType,
    fifoTradesCount: fifoTradesData?.trades?.length,
    perPosTradesCount: perPosTradesData?.trades?.length
  })

  if (isLoading) {
    return <LoadingSpinner fullScreen />
  }

  if (allError) {
    return (
      <ErrorMessage
        title="Failed to Load Journals"
        message={`Unable to fetch your trade journals. Error: ${allError?.message || 'Unknown error'}`}
        fullScreen
      />
    )
  }

  return (
    <div className={`min-h-screen bg-gray-900 py-8 px-4 transition-all duration-300 ${isExpanded ? 'ml-60' : 'ml-16'}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Trade Journals</h1>
          <p className="text-gray-400">Document your trades and track your progress</p>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Sort */}
            <div className="lg:w-28 flex-shrink-0">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Sort
              </label>
              <button
                onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                className="w-full h-[42px] px-3 py-2 bg-gray-700 text-gray-300 rounded-lg border border-gray-600 hover:bg-gray-600 hover:text-white transition-colors flex items-center justify-center gap-1.5"
                title={sortOrder === 'desc' ? 'Sorted: Newest First' : 'Sorted: Oldest First'}
              >
                {sortOrder === 'desc' ? (
                  <ArrowDown className="w-4 h-4" />
                ) : (
                  <ArrowUp className="w-4 h-4" />
                )}
                <span className="text-sm">
                  {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
                </span>
              </button>
            </div>

            {/* Search */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Search
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search notes, tags, or trade ID..."
                className="w-full h-[42px] px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            {/* P&L Type Filter */}
            <div className="lg:w-40 flex-shrink-0">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                P&L Type
              </label>
              <select
                value={plType}
                onChange={(e) => setPlType(e.target.value as 'all' | 'fifo' | 'perPosition')}
                className="w-full h-[42px] px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Types</option>
                <option value="fifo">FIFO</option>
                <option value="perPosition">Positional</option>
              </select>
            </div>

            {/* Filter Type */}
            <div className="lg:w-40 flex-shrink-0">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Filter By
              </label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as 'all' | 'tag' | 'date')}
                className="w-full h-[42px] px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="all">All Journals</option>
                <option value="tag">By Tag</option>
                <option value="date">By Date Range</option>
              </select>
            </div>

            {/* Tag Filter */}
            {filterType === 'tag' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Tag
                </label>
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">Select a tag...</option>
                  {availableTags.map(tag => (
                    <option key={tag} value={tag}>{tag}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Range Filter */}
            {filterType === 'date' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.start}
                    onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={dateRange.end}
                    onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Items per page selector and count */}
        {filteredJournals.length > 0 && (
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">Show:</span>
              <div className="flex gap-1">
                {[20, 50, 100].map((count) => (
                  <button
                    key={count}
                    onClick={() => handleItemsPerPageChange(count)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      itemsPerPage === count
                        ? 'bg-accent text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
              <span className="text-sm text-gray-400">per page</span>
            </div>
            <div className="text-sm text-gray-400">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredJournals.length)} of {filteredJournals.length} journals
            </div>
          </div>
        )}

        {/* Journals Grid */}
        {filteredJournals.length === 0 ? (
          <EmptyState
            title="No Journals Found"
            description={
              filterType === 'all'
                ? "You haven't created any trade journals yet. Start documenting your trades to track your progress."
                : "No journals match your current filters. Try adjusting your search criteria."
            }
            action={{
              label: 'View Trades',
              onClick: () => navigate('/app/trades')
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {currentJournals.map(journal => {
              // Find matching trade data based on journal's calculation method
              const usePerPos = journal.calculationMethod === 'perPosition'
              const tradesData = usePerPos ? perPosTradesData : fifoTradesData
              const trades = Array.isArray(tradesData) ? tradesData : tradesData?.trades || []
              // Use rawTradeId for matching since journal.tradeId is prefixed (e.g., "fifo#123_456_0")
              const rawId = journal.rawTradeId || journal.tradeId.replace(/^(fifo|perPosition)#/, '')
              const trade = trades.find((t: any) => t.tradeId === rawId || t.id === rawId)
              const isExpanded = expandedTradeId === journal.tradeId

              return (
                <div
                  key={journal.tradeId}
                  ref={isExpanded ? expandedRef : null}
                  className={`bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition cursor-pointer ${
                    isExpanded ? 'ring-2 ring-accent shadow-lg shadow-accent/20' : ''
                  }`}
                  onClick={() => navigate(`/app/journal/${journal.rawTradeId || journal.tradeId.replace(/^(fifo|perPosition)#/, '')}`, { state: { calculationMethod: journal.calculationMethod || 'fifo' } })}
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
                      {journal.tags.slice(0, 3).map(tag => (
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
            })}
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between">
            {/* Previous button */}
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPage === 1
                  ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
              }`}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            {/* Page numbers */}
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
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>

            {/* Next button */}
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentPage === totalPages
                  ? 'bg-gray-700/50 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
              }`}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}