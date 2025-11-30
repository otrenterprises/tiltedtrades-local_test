/**
 * Journal Quick Modal Component
 * Quick entry modal for creating new journal notes from Trade Log.
 * For viewing/editing existing journals, use the full Journal page.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, FileText } from 'lucide-react'
import { TagInput } from './TagInput'
import { Trade } from '@/types/execution.types'
import { formatCurrency } from '@/utils/formatting/currency'
import { formatPercentage } from '@/utils/formatting/number'
import { format } from 'date-fns'
import { useSaveJournal } from '@/hooks/useJournal'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'react-hot-toast'

interface JournalQuickModalProps {
  trade: Trade
  calculationMethod: 'FIFO' | 'Per Position'
  onClose: () => void
  onSaved?: () => void
}

export const JournalQuickModal: React.FC<JournalQuickModalProps> = ({
  trade,
  calculationMethod,
  onClose,
  onSaved
}) => {
  const { user } = useAuth()
  const userId = user?.userId || ''
  const navigate = useNavigate()
  const saveJournalMutation = useSaveJournal()

  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState<string[]>([])

  const handleSave = async () => {
    if (!notes.trim()) {
      toast.error('Please enter some notes before saving')
      return
    }

    try {
      // Use the mutation hook which handles cache invalidation
      await saveJournalMutation.mutateAsync({
        userId,
        tradeId: trade.id,
        journalText: notes,
        tags,
        symbol: trade.symbol,
        exitDate: trade.exitDate?.toISOString() || trade.entryDate.toISOString(),
        calculationMethod: calculationMethod === 'FIFO' ? 'fifo' : 'perPosition'
      })

      onSaved?.()
      onClose()
    } catch (error) {
      console.error('Error saving journal:', error)
      toast.error('Failed to save journal. Please try again.')
    }
  }

  const handleOpenFullEditor = () => {
    onClose()
    // Pass calculationMethod in navigation state so JournalEditor uses the correct method
    const apiMethod = calculationMethod === 'FIFO' ? 'fifo' : 'perPosition'
    navigate(`/app/trades/${trade.id}/journal`, { state: { calculationMethod: apiMethod } })
  }

  // Calculate trade duration in seconds
  const durationSeconds = trade.exitDate
    ? Math.floor((trade.exitDate.getTime() - trade.entryDate.getTime()) / 1000)
    : 0

  const hours = Math.floor(durationSeconds / 3600)
  const minutes = Math.floor((durationSeconds % 3600) / 60)
  const seconds = durationSeconds % 60

  const durationText = hours > 0
    ? `${hours}h ${minutes}m ${seconds}s`
    : minutes > 0
    ? `${minutes}m ${seconds}s`
    : `${seconds}s`

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-secondary border border-dark-border rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-border">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-accent" />
            <div>
              <h2 className="text-lg font-semibold text-slate-50">Quick Journal Entry</h2>
              <p className="text-sm text-slate-400">
                {trade.symbol} - {format(trade.exitDate || trade.entryDate, 'MMM dd, yyyy')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-dark-tertiary rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Trade Summary */}
        <div className="p-6 bg-dark-tertiary/30 border-b border-dark-border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-500 block mb-1">Side</span>
              <span className="text-slate-200 font-medium">{trade.side}</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">Quantity</span>
              <span className="text-slate-200 font-medium">{trade.quantity}</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">Entry</span>
              <span className="text-slate-200 font-medium font-mono">{trade.entryPrice.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">Exit</span>
              <span className="text-slate-200 font-medium font-mono">{trade.exitPrice?.toFixed(2) || '-'}</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">P&L</span>
              <span className={`font-semibold font-mono ${trade.pl >= 0 ? 'text-profit' : 'text-loss'}`}>
                {formatCurrency(trade.pl)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">Return</span>
              <span className={`font-semibold font-mono ${trade.pl >= 0 ? 'text-profit' : 'text-loss'}`}>
                {formatPercentage(trade.plPercent)}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">Duration</span>
              <span className="text-slate-200 font-medium">{durationText}</span>
            </div>
            <div>
              <span className="text-slate-500 block mb-1">Commission</span>
              <span className="text-loss font-mono">{formatCurrency(trade.commission)}</span>
            </div>
          </div>
        </div>

        {/* Notes Input */}
        <div className="p-6">
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Trade Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="What happened during this trade? What did you learn?"
            rows={6}
            className="w-full px-4 py-3 bg-dark-tertiary text-slate-100 rounded-lg border border-dark-border focus:border-accent focus:outline-none resize-none"
          />
        </div>

        {/* Tags Input */}
        <div className="px-6 pb-6">
          <label className="block text-sm font-medium text-slate-300 mb-3">
            Tags
          </label>
          <TagInput tags={tags} onChange={setTags} />
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-6 border-t border-dark-border bg-dark-tertiary/20">
          <button
            onClick={handleOpenFullEditor}
            className="text-sm text-accent hover:text-accent-light transition-colors"
          >
            Open Full Editor
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-dark-tertiary text-slate-300 rounded-lg hover:bg-dark-tertiary/70 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saveJournalMutation.isPending || !notes.trim()}
              className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saveJournalMutation.isPending ? 'Saving...' : 'Save Journal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
