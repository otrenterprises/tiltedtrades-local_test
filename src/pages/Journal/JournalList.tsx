/**
 * Journal List Page
 * Displays all trade journals with search and filter capabilities
 */

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigation } from '@/contexts/NavigationContext'
import { useJournals, useJournalsByTag, useJournalsByDateRange } from '../../hooks/useJournal'
import { useAllTrades } from '../../hooks/useTrades'
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner'
import { ErrorMessage } from '../../components/feedback/ErrorMessage'
import { EmptyState } from '../../components/feedback/EmptyState'
import { JournalFilters, JournalCard, Pagination } from './components'

export const JournalList: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { isExpanded } = useNavigation()
  const userId = user?.userId || ''
  const [searchParams] = useSearchParams()

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
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')

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

  // Fetch journals based on filter type
  const { data: allJournals, isLoading: loadingAll, error: allError } = useJournals(userId)
  const { data: tagJournals, isLoading: loadingTag } = useJournalsByTag(userId, selectedTag, filterType === 'tag')
  const { data: dateJournals, isLoading: loadingDate } = useJournalsByDateRange(userId, dateRange.start, dateRange.end, filterType === 'date')

  // Fetch ALL trades to match with journals
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

    if (plType !== 'all') {
      filtered = filtered.filter(journal => journal.calculationMethod === plType)
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = filtered.filter(journal =>
        journal.journalText?.toLowerCase().includes(search) ||
        journal.tags?.some(tag => tag.toLowerCase().includes(search)) ||
        journal.symbol?.toLowerCase().includes(search) ||
        journal.tradeId.toLowerCase().includes(search)
      )
    }

    filtered = [...filtered].sort((a, b) => {
      const dateA = a.exitDate || a.updatedAt || ''
      const dateB = b.exitDate || b.updatedAt || ''
      return sortOrder === 'desc' ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB)
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

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1)
  }

  // Loading state
  const journalLoading = filterType === 'all' ? loadingAll : filterType === 'tag' ? loadingTag : loadingDate
  const isLoading = journalLoading || loadingFifoTrades || loadingPerPosTrades

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

  // Helper to find matching trade
  const findMatchingTrade = (journal: typeof journals[0]) => {
    const usePerPos = journal.calculationMethod === 'perPosition'
    const tradesData = usePerPos ? perPosTradesData : fifoTradesData
    const trades = Array.isArray(tradesData) ? tradesData : tradesData?.trades || []
    const rawId = journal.rawTradeId || journal.tradeId.replace(/^(fifo|perPosition)#/, '')
    return trades.find((t: any) => t.tradeId === rawId || t.id === rawId)
  }

  return (
    <div className={`min-h-screen bg-dark transition-all duration-300 ml-0 ${isExpanded ? 'md:ml-60' : 'md:ml-16'} pb-20 md:pb-0`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-8">
        {/* Header */}
        <div className="mb-4 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-1 md:mb-2">Trade Journals</h1>
          <p className="text-sm md:text-base text-gray-400">Document your trades and track your progress</p>
        </div>

        {/* Filters */}
        <JournalFilters
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          plType={plType}
          onPlTypeChange={setPlType}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
          selectedTag={selectedTag}
          onSelectedTagChange={setSelectedTag}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          availableTags={availableTags}
        />

        {/* Items per page selector and count */}
        {filteredJournals.length > 0 && (
          <div className="mb-4 md:mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-xs sm:text-sm text-gray-400">Show:</span>
              <div className="flex gap-1">
                {[20, 50, 100].map((count) => (
                  <button
                    key={count}
                    onClick={() => handleItemsPerPageChange(count)}
                    className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors touch-target ${
                      itemsPerPage === count
                        ? 'bg-accent text-white'
                        : 'bg-dark-tertiary text-gray-300 active:bg-dark-tertiary/80 active:text-white'
                    }`}
                  >
                    {count}
                  </button>
                ))}
              </div>
              <span className="text-xs sm:text-sm text-gray-400 hidden sm:inline">per page</span>
            </div>
            <div className="text-xs sm:text-sm text-gray-400">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {currentJournals.map(journal => {
              const trade = findMatchingTrade(journal)
              const isExpanded = expandedTradeId === journal.tradeId

              return (
                <JournalCard
                  key={journal.tradeId}
                  ref={isExpanded ? expandedRef : null}
                  journal={journal}
                  trade={trade}
                  isExpanded={isExpanded}
                  onClick={() => navigate(`/app/journals/${journal.rawTradeId || journal.tradeId.replace(/^(fifo|perPosition)#/, '')}`, { state: { calculationMethod: journal.calculationMethod || 'fifo' } })}
                />
              )
            })}
          </div>
        )}

        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  )
}
