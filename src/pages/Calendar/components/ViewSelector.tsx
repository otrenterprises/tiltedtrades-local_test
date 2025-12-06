import { CalendarDays, CalendarRange, LayoutGrid } from 'lucide-react'
import type { ViewType } from '../types'

interface ViewSelectorProps {
  viewType: ViewType
  onViewChange: (view: ViewType) => void
}

export function ViewSelector({ viewType, onViewChange }: ViewSelectorProps) {
  return (
    <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
      <button
        onClick={() => onViewChange('daily')}
        className={`flex items-center justify-center gap-1.5 px-3 py-1.5 h-8 min-w-[90px] rounded-md text-sm font-medium transition-colors ${
          viewType === 'daily'
            ? 'bg-accent text-white'
            : 'text-tertiary hover:text-secondary hover:bg-tertiary'
        }`}
      >
        <CalendarDays className="w-4 h-4" />
        Daily
      </button>
      <button
        onClick={() => onViewChange('weekly')}
        className={`flex items-center justify-center gap-1.5 px-3 py-1.5 h-8 min-w-[90px] rounded-md text-sm font-medium transition-colors ${
          viewType === 'weekly'
            ? 'bg-accent text-white'
            : 'text-tertiary hover:text-secondary hover:bg-tertiary'
        }`}
      >
        <CalendarRange className="w-4 h-4" />
        Weekly
      </button>
      <button
        onClick={() => onViewChange('monthly')}
        className={`flex items-center justify-center gap-1.5 px-3 py-1.5 h-8 min-w-[90px] rounded-md text-sm font-medium transition-colors ${
          viewType === 'monthly'
            ? 'bg-accent text-white'
            : 'text-tertiary hover:text-secondary hover:bg-tertiary'
        }`}
      >
        <LayoutGrid className="w-4 h-4" />
        Monthly
      </button>
    </div>
  )
}
