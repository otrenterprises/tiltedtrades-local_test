import { Repeat, Edit, Trash2 } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { formatCurrency } from '@/utils/formatting/currency'
import type { ApiRecurringTemplate } from '@/types/api/balance.types'

interface RecurringFeesSectionProps {
  templates: ApiRecurringTemplate[]
  onEditTemplate: (template: ApiRecurringTemplate) => void
  onDeleteTemplate: (templateId: string) => void
}

export function RecurringFeesSection({ templates, onEditTemplate, onDeleteTemplate }: RecurringFeesSectionProps) {
  if (templates.length === 0) return null

  return (
    <div className="bg-dark-secondary border border-dark-border rounded-lg p-6">
      <h3 className="text-lg font-semibold text-slate-50 mb-4 flex items-center gap-2">
        <Repeat className="w-5 h-5 text-accent" />
        Recurring Fees
      </h3>
      <div className="space-y-2">
        {templates.map((template) => (
          <div
            key={template.entryId}
            className="flex items-center justify-between p-3 bg-dark-tertiary rounded-lg"
          >
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-200">{template.description}</p>
              <p className="text-xs text-slate-400">
                Day {template.dayOfMonth} of each month
                {template.endDate && ` until ${format(parseISO(template.endDate), 'MM/dd/yyyy')}`}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <p className="text-sm font-semibold text-loss">{formatCurrency(-template.amount)}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onEditTemplate(template)}
                  className="p-2 hover:bg-dark-border rounded transition-colors"
                >
                  <Edit className="w-4 h-4 text-slate-400 hover:text-slate-200" />
                </button>
                <button
                  onClick={() => onDeleteTemplate(template.entryId)}
                  className="p-2 hover:bg-dark-border rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-400" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
