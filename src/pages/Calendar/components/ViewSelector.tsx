import { CalendarDays, CalendarRange, LayoutGrid } from 'lucide-react'
import type { ViewType } from '../types'

interface ViewSelectorProps {
  viewType: ViewType
  onViewChange: (view: ViewType) => void
}

export function ViewSelector({ viewType, onViewChange }: ViewSelectorProps) {
  return (
    <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
      <button
        onClick={() => onViewChange('daily')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          viewType === 'daily'
            ? 'bg-accent text-white'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
        }`}
      >
        <CalendarDays className="w-4 h-4" />
        Daily
      </button>
      <button
        onClick={() => onViewChange('weekly')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          viewType === 'weekly'
            ? 'bg-accent text-white'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
        }`}
      >
        <CalendarRange className="w-4 h-4" />
        Weekly
      </button>
      <button
        onClick={() => onViewChange('monthly')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
          viewType === 'monthly'
            ? 'bg-accent text-white'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
        }`}
      >
        <LayoutGrid className="w-4 h-4" />
        Monthly
      </button>
    </div>
  )
}
