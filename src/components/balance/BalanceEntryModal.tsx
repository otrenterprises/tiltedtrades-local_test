import { useState, useEffect, useMemo } from 'react'
import { X, Info } from 'lucide-react'
import { format } from 'date-fns'
import { BalanceEntryType } from '@/types/balance.types'
import { ApiBalanceEntry, ApiRecurringTemplate, BalanceEntryType as ApiBalanceEntryType } from '@/types/api/balance.types'
import {
  useCreateBalanceEntry,
  useUpdateBalanceEntry,
  useCreateBalanceTemplate,
  useUpdateBalanceTemplate,
} from '@/hooks/useBalance'
import { useTrades } from '@/hooks/useTrades'

interface BalanceEntryModalProps {
  entry: ApiBalanceEntry | null // null for new entry, existing entry for edit
  template: ApiRecurringTemplate | null // For editing a recurring template
  onClose: () => void
  onSave: () => void
}

export function BalanceEntryModal({ entry, template, onClose, onSave }: BalanceEntryModalProps) {
  // Determine if we're editing a template or entry
  const isEditingTemplate = !!template
  const existingData = template || entry

  const [date, setDate] = useState(existingData?.date || format(new Date(), 'yyyy-MM-dd'))
  const [type, setType] = useState<BalanceEntryType | ApiBalanceEntryType>(existingData?.type || 'deposit')
  const [amount, setAmount] = useState(Math.abs(existingData?.amount || 0).toString())
  const [description, setDescription] = useState(existingData?.description || '')
  const [isRecurring, setIsRecurring] = useState(isEditingTemplate)
  const [dayOfMonth, setDayOfMonth] = useState(template?.dayOfMonth || 1)
  const [hasEndDate, setHasEndDate] = useState(!!template?.endDate)
  const [endDate, setEndDate] = useState(template?.endDate || '')

  // Commission adjustment specific fields
  const [isNegativeAdjustment, setIsNegativeAdjustment] = useState(
    entry?.type === 'commission_adjustment' ? (entry?.amount || 0) < 0 : true
  )
  const [tradeCount, setTradeCount] = useState(entry?.commissionMeta?.tradeCount?.toString() || '')
  const [contractCount, setContractCount] = useState(entry?.commissionMeta?.contractCount?.toString() || '')
  const [adjustmentStartDate, setAdjustmentStartDate] = useState(entry?.commissionMeta?.startDate || '')
  const [adjustmentEndDate, setAdjustmentEndDate] = useState(entry?.commissionMeta?.endDate || '')
  const [symbol, setSymbol] = useState(entry?.commissionMeta?.symbol || '')

  // Fetch trades to get available symbols
  const { data: tradesData } = useTrades()

  // Get unique symbols from trades up to the selected date
  const availableSymbols = useMemo(() => {
    if (!tradesData?.trades || !date) return []

    const cutoffDate = new Date(date + 'T23:59:59.999')
    const symbolsSet = new Set<string>()

    tradesData.trades.forEach(trade => {
      // Include trades with exitDate up to and including the adjustment date
      if (trade.exitDate && trade.exitDate <= cutoffDate) {
        symbolsSet.add(trade.symbol)
      }
    })

    return Array.from(symbolsSet).sort()
  }, [tradesData?.trades, date])

  // API mutations
  const createEntry = useCreateBalanceEntry()
  const updateEntry = useUpdateBalanceEntry()
  const createTemplate = useCreateBalanceTemplate()
  const updateTemplate = useUpdateBalanceTemplate()

  const isSaving = createEntry.isPending || updateEntry.isPending ||
                   createTemplate.isPending || updateTemplate.isPending

  // When type changes, disable recurring if not a fee
  useEffect(() => {
    if (type !== 'fee') {
      setIsRecurring(false)
    }
    // Set default description for commission adjustment
    if (type === 'commission_adjustment' && !description) {
      setDescription('Commission adjustment')
    }
  }, [type])

  async function handleSave() {
    if (!date || !amount || !description.trim()) {
      alert('Please fill in all required fields')
      return
    }

    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) {
      alert('Please enter a valid positive amount')
      return
    }

    // Validate dayOfMonth for recurring
    if (isRecurring && (dayOfMonth < 1 || dayOfMonth > 28)) {
      alert('Day of month must be between 1 and 28')
      return
    }

    try {
      if (isRecurring && type === 'fee') {
        // Handle recurring template
        const templateData = {
          type: type as BalanceEntryType,
          amount: numAmount,
          date: date,
          description: description,
          dayOfMonth: dayOfMonth,
          endDate: hasEndDate ? endDate : undefined,
        }

        if (template) {
          // Update existing template
          await updateTemplate.mutateAsync({
            templateId: template.entryId,
            data: templateData,
          })
        } else {
          // Create new template
          await createTemplate.mutateAsync(templateData)
        }
      } else if (type === 'commission_adjustment') {
        // Handle commission adjustment entry
        const signedAmount = isNegativeAdjustment ? -Math.abs(numAmount) : Math.abs(numAmount)
        const entryData: any = {
          type: 'commission_adjustment' as ApiBalanceEntryType,
          amount: signedAmount,
          date: date,
          description: description,
        }

        // Add optional metadata fields if provided
        if (tradeCount) entryData.tradeCount = parseInt(tradeCount)
        if (contractCount) entryData.contractCount = parseInt(contractCount)
        if (adjustmentStartDate) entryData.startDate = adjustmentStartDate
        if (adjustmentEndDate) entryData.endDate = adjustmentEndDate
        if (symbol) entryData.symbol = symbol

        if (entry) {
          await updateEntry.mutateAsync({
            entryId: entry.entryId,
            data: entryData,
          })
        } else {
          await createEntry.mutateAsync(entryData)
        }
      } else {
        // Handle regular entry
        const entryData = {
          type: type as BalanceEntryType,
          amount: numAmount,
          date: date,
          description: description,
        }

        if (entry) {
          // Update existing entry
          await updateEntry.mutateAsync({
            entryId: entry.entryId,
            data: entryData,
          })
        } else {
          // Create new entry
          await createEntry.mutateAsync(entryData)
        }
      }

      onSave()
    } catch (error) {
      console.error('Error saving balance entry:', error)
      alert('Error saving entry. Please try again.')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 md:p-4 overflow-y-auto">
      <div className="bg-secondary border border-theme rounded-lg max-w-md w-full my-auto max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-theme shrink-0">
          <h2 className="text-lg md:text-xl font-bold text-primary">
            {template ? 'Edit Recurring Fee' : entry ? 'Edit Entry' : 'Add Balance Entry'}
          </h2>
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-tertiary active:bg-tertiary/70 rounded-lg transition-colors touch-target"
          >
            <X className="w-5 h-5 text-tertiary" />
          </button>
        </div>

        {/* Form */}
        <div className="p-4 md:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Date */}
          <div>
            <label className="block text-xs md:text-sm font-medium text-secondary mb-1.5 md:mb-2">
              {isRecurring ? 'Start Date' : 'Date'} <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-tertiary border border-theme rounded-lg text-secondary text-base focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs md:text-sm font-medium text-secondary mb-1.5 md:mb-2">
              Type <span className="text-red-400">*</span>
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as BalanceEntryType | ApiBalanceEntryType)}
              disabled={isEditingTemplate} // Can't change type when editing template
              className="w-full px-3 py-2.5 bg-tertiary border border-theme rounded-lg text-secondary text-base focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
            >
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="fee">Fee</option>
              <option value="commission_adjustment">Bulk Commission Adjustment</option>
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs md:text-sm font-medium text-secondary mb-1.5 md:mb-2">
              Amount <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tertiary">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full pl-8 pr-3 py-2.5 bg-tertiary border border-theme rounded-lg text-secondary text-base focus:outline-none focus:ring-2 focus:ring-accent"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs md:text-sm font-medium text-secondary mb-1.5 md:mb-2">
              Description <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2.5 bg-tertiary border border-theme rounded-lg text-secondary text-base focus:outline-none focus:ring-2 focus:ring-accent"
              placeholder={type === 'commission_adjustment'
                ? 'e.g., Monthly volume rebate, Q4 commission correction'
                : 'e.g., Initial deposit, Monthly platform fee'}
            />
          </div>

          {/* Commission Adjustment Options */}
          {type === 'commission_adjustment' && (
            <div className="space-y-4 pt-4 border-t border-theme">
              <div className="flex items-start gap-2 text-xs md:text-sm text-tertiary">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>Commission adjustments are included in your statistics calculations</span>
              </div>

              {/* Adjustment Direction */}
              <div>
                <label className="block text-xs md:text-sm font-medium text-secondary mb-2">
                  Adjustment Type
                </label>
                {/* Mobile: Stack vertically, Desktop: Row */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <label className="flex items-center gap-2 cursor-pointer p-2 -m-2 active:bg-tertiary/50 rounded-lg transition-colors">
                    <input
                      type="radio"
                      name="adjustmentType"
                      checked={isNegativeAdjustment}
                      onChange={() => setIsNegativeAdjustment(true)}
                      className="w-4 h-4 accent-red-500"
                    />
                    <span className="text-sm text-secondary">Additional Commission Cost</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer p-2 -m-2 active:bg-tertiary/50 rounded-lg transition-colors">
                    <input
                      type="radio"
                      name="adjustmentType"
                      checked={!isNegativeAdjustment}
                      onChange={() => setIsNegativeAdjustment(false)}
                      className="w-4 h-4 accent-green-500"
                    />
                    <span className="text-sm text-secondary">Rebate / Refund</span>
                  </label>
                </div>
              </div>

              {/* Optional Metadata Fields */}
              <p className="text-xs md:text-sm text-tertiary mt-2">
                Optional details for tracking purposes:
              </p>

              <div className="grid grid-cols-2 gap-3 md:gap-4">
                {/* Trade Count */}
                <div>
                  <label className="block text-xs md:text-sm font-medium text-secondary mb-1.5 md:mb-2">
                    # of Trades
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={tradeCount}
                    onChange={(e) => setTradeCount(e.target.value)}
                    className="w-full px-3 py-2.5 bg-tertiary border border-theme rounded-lg text-secondary text-base focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Optional"
                  />
                </div>

                {/* Contract Count */}
                <div>
                  <label className="block text-xs md:text-sm font-medium text-secondary mb-1.5 md:mb-2">
                    # of Contracts
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={contractCount}
                    onChange={(e) => setContractCount(e.target.value)}
                    className="w-full px-3 py-2.5 bg-tertiary border border-theme rounded-lg text-secondary text-base focus:outline-none focus:ring-2 focus:ring-accent"
                    placeholder="Optional"
                  />
                </div>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="block text-xs md:text-sm font-medium text-secondary mb-1.5 md:mb-2">
                    Period Start
                  </label>
                  <input
                    type="date"
                    value={adjustmentStartDate}
                    onChange={(e) => setAdjustmentStartDate(e.target.value)}
                    className="w-full px-3 py-2.5 bg-tertiary border border-theme rounded-lg text-secondary text-base focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-medium text-secondary mb-1.5 md:mb-2">
                    Period End
                  </label>
                  <input
                    type="date"
                    value={adjustmentEndDate}
                    onChange={(e) => setAdjustmentEndDate(e.target.value)}
                    min={adjustmentStartDate}
                    className="w-full px-3 py-2.5 bg-tertiary border border-theme rounded-lg text-secondary text-base focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              {/* Symbol Selection */}
              <div>
                <label className="block text-xs md:text-sm font-medium text-secondary mb-1.5 md:mb-2">
                  Symbol
                </label>
                <select
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  disabled={!date}
                  className="w-full px-3 py-2.5 bg-tertiary border border-theme rounded-lg text-secondary text-base focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50"
                >
                  {!date ? (
                    <option value="">Select date first</option>
                  ) : availableSymbols.length === 0 ? (
                    <option value="">No symbols found for this date</option>
                  ) : (
                    <>
                      <option value="">Select symbol (optional)</option>
                      {availableSymbols.map(sym => (
                        <option key={sym} value={sym}>{sym}</option>
                      ))}
                    </>
                  )}
                </select>
                <p className="text-xs text-tertiary mt-1">
                  Symbols with trades on or before the entry date
                </p>
              </div>
            </div>
          )}

          {/* Recurring Fee Option (only for fees, not when editing existing entry) */}
          {type === 'fee' && !entry && (
            <div className="space-y-4 pt-4 border-t border-theme">
              <label className="flex items-center gap-3 cursor-pointer p-2 -m-2 active:bg-tertiary/50 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  id="recurring"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  disabled={isEditingTemplate} // Can't uncheck when editing template
                  className="w-4 h-4 accent-accent"
                />
                <span className="text-sm font-medium text-secondary">
                  Recurring monthly fee
                </span>
              </label>

              {isRecurring && (
                <>
                  {/* Day of Month */}
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-secondary mb-1.5 md:mb-2">
                      Day of Month
                    </label>
                    <select
                      value={dayOfMonth}
                      onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                      className="w-full px-3 py-2.5 bg-tertiary border border-theme rounded-lg text-secondary text-base focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>
                          {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-tertiary mt-1">
                      Fee will be charged on this day each month (max 28 to avoid month-end issues)
                    </p>
                  </div>

                  {/* End Date Option */}
                  <label className="flex items-center gap-3 cursor-pointer p-2 -m-2 active:bg-tertiary/50 rounded-lg transition-colors">
                    <input
                      type="checkbox"
                      id="hasEndDate"
                      checked={hasEndDate}
                      onChange={(e) => setHasEndDate(e.target.checked)}
                      className="w-4 h-4 accent-accent"
                    />
                    <span className="text-sm font-medium text-secondary">
                      Set end date
                    </span>
                  </label>

                  {hasEndDate && (
                    <div>
                      <label className="block text-xs md:text-sm font-medium text-secondary mb-1.5 md:mb-2">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={date}
                        className="w-full px-3 py-2.5 bg-tertiary border border-theme rounded-lg text-secondary text-base focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <p className="text-xs text-tertiary mt-1">
                        Leave blank to continue indefinitely
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Show recurring options when editing a template */}
          {isEditingTemplate && (
            <div className="space-y-4 pt-4 border-t border-theme">
              <p className="text-xs md:text-sm font-medium text-secondary">Recurring Fee Settings</p>

              {/* Day of Month */}
              <div>
                <label className="block text-xs md:text-sm font-medium text-secondary mb-1.5 md:mb-2">
                  Day of Month
                </label>
                <select
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                  className="w-full px-3 py-2.5 bg-tertiary border border-theme rounded-lg text-secondary text-base focus:outline-none focus:ring-2 focus:ring-accent"
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                    <option key={day} value={day}>
                      {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'}
                    </option>
                  ))}
                </select>
              </div>

              {/* End Date Option */}
              <label className="flex items-center gap-3 cursor-pointer p-2 -m-2 active:bg-tertiary/50 rounded-lg transition-colors">
                <input
                  type="checkbox"
                  id="hasEndDate"
                  checked={hasEndDate}
                  onChange={(e) => setHasEndDate(e.target.checked)}
                  className="w-4 h-4 accent-accent"
                />
                <span className="text-sm font-medium text-secondary">
                  Set end date
                </span>
              </label>

              {hasEndDate && (
                <div>
                  <label className="block text-xs md:text-sm font-medium text-secondary mb-1.5 md:mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={date}
                    className="w-full px-3 py-2.5 bg-tertiary border border-theme rounded-lg text-secondary text-base focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-3 p-4 md:p-6 border-t border-theme shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 bg-tertiary text-secondary rounded-lg hover:bg-tertiary/70 active:bg-tertiary/50 transition-colors text-sm font-medium"
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2.5 bg-accent text-white rounded-lg hover:bg-accent/90 active:bg-accent/80 transition-colors disabled:opacity-50 text-sm font-medium"
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : existingData ? 'Update' : 'Add Entry'}
          </button>
        </div>
      </div>
    </div>
  )
}
