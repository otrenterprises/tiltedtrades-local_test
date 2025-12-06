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
    <div className="bg-secondary border border-theme rounded-lg p-4 md:p-6">
      <h3 className="text-base md:text-lg font-semibold text-primary mb-3 md:mb-4 flex items-center gap-2">
        <Repeat className="w-4 h-4 md:w-5 md:h-5 text-accent flex-shrink-0" />
        Recurring Fees
      </h3>
      <div className="space-y-2">
        {templates.map((template) => (
          <div
            key={template.entryId}
            className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-tertiary rounded-lg gap-2 sm:gap-4"
          >
            {/* Mobile: Full width info, Desktop: Flex row */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-secondary truncate">{template.description}</p>
              <p className="text-xs text-tertiary">
                Day {template.dayOfMonth} of each month
                {template.endDate && ` until ${format(parseISO(template.endDate), 'MM/dd/yyyy')}`}
              </p>
            </div>
            {/* Mobile: Amount and actions in row, Desktop: Same */}
            <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
              <p className="text-sm font-semibold text-loss font-mono">{formatCurrency(-template.amount)}</p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEditTemplate(template)}
                  className="p-2.5 hover:bg-hover active:bg-hover/70 rounded-lg transition-colors touch-target"
                >
                  <Edit className="w-4 h-4 text-tertiary" />
                </button>
                <button
                  onClick={() => onDeleteTemplate(template.entryId)}
                  className="p-2.5 hover:bg-hover active:bg-hover/70 rounded-lg transition-colors touch-target"
                >
                  <Trash2 className="w-4 h-4 text-tertiary" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
