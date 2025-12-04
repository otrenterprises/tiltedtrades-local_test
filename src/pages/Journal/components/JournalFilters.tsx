import { ArrowUp, ArrowDown } from 'lucide-react'

interface JournalFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  plType: 'all' | 'fifo' | 'perPosition'
  onPlTypeChange: (value: 'all' | 'fifo' | 'perPosition') => void
  filterType: 'all' | 'tag' | 'date'
  onFilterTypeChange: (value: 'all' | 'tag' | 'date') => void
  selectedTag: string
  onSelectedTagChange: (value: string) => void
  dateRange: { start: string; end: string }
  onDateRangeChange: (value: { start: string; end: string }) => void
  sortOrder: 'desc' | 'asc'
  onSortOrderChange: (value: 'desc' | 'asc') => void
  availableTags: string[]
}

export function JournalFilters({
  searchTerm,
  onSearchChange,
  plType,
  onPlTypeChange,
  filterType,
  onFilterTypeChange,
  selectedTag,
  onSelectedTagChange,
  dateRange,
  onDateRangeChange,
  sortOrder,
  onSortOrderChange,
  availableTags,
}: JournalFiltersProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 mb-8">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Sort */}
        <div className="lg:w-28 flex-shrink-0">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Sort
          </label>
          <button
            onClick={() => onSortOrderChange(sortOrder === 'desc' ? 'asc' : 'desc')}
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
            onChange={(e) => onSearchChange(e.target.value)}
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
            onChange={(e) => onPlTypeChange(e.target.value as 'all' | 'fifo' | 'perPosition')}
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
            onChange={(e) => onFilterTypeChange(e.target.value as 'all' | 'tag' | 'date')}
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
              onChange={(e) => onSelectedTagChange(e.target.value)}
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
                onChange={(e) => onDateRangeChange({ ...dateRange, start: e.target.value })}
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
                onChange={(e) => onDateRangeChange({ ...dateRange, end: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
