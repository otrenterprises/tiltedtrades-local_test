import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null

  const goToPage = (page: number) => {
    onPageChange(Math.max(1, Math.min(page, totalPages)))
  }

  return (
    <div className="mt-8 flex items-center justify-between">
      {/* Previous button */}
      <button
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage === 1}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          currentPage === 1
            ? 'bg-tertiary/50 text-muted cursor-not-allowed'
            : 'bg-tertiary text-secondary hover:bg-hover hover:text-primary'
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
                  : 'bg-tertiary text-secondary hover:bg-hover hover:text-primary'
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
            ? 'bg-tertiary/50 text-muted cursor-not-allowed'
            : 'bg-tertiary text-secondary hover:bg-hover hover:text-primary'
        }`}
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}
