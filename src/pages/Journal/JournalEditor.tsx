/**
 * Journal Editor Page
 * Create and edit trade journal entries with notes, tags, and charts
 */

import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigation } from '@/contexts/NavigationContext'
import { useJournal, useSaveJournal, useDeleteJournal, useSaveCommissionOverride } from '../../hooks/useJournal'
import { useTrade } from '../../hooks/useTrades'
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner'
import { ErrorMessage } from '../../components/feedback/ErrorMessage'
import { TagInput } from '../../components/journal/TagInput'
import { ChartGallery } from '../../components/journal/ChartGallery'
import { formatCurrency } from '../../utils/formatting'
import { parseISO, format } from 'date-fns'
import { toast } from 'react-hot-toast'

export const JournalEditor: React.FC = () => {
  const { tradeId } = useParams<{ tradeId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { isExpanded } = useNavigation()
  const userId = user?.userId || ''

  // Get calculation method from navigation state (passed from TradeLog)
  const navCalculationMethod = (location.state as { calculationMethod?: 'fifo' | 'perPosition' })?.calculationMethod

  // State for form
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Commission override state
  const [showCommissionOverride, setShowCommissionOverride] = useState(false)
  const [overrideCommission, setOverrideCommission] = useState('')
  const [overrideReason, setOverrideReason] = useState('')

  // Determine API method: priority is navigation state > default 'fifo'
  // Navigation state is required since we use method-prefixed tradeIds
  const apiMethod = navCalculationMethod || 'fifo'

  // Fetch existing journal with calculationMethod
  const { data: journal, isLoading: loadingJournal, error: journalError } = useJournal(userId, tradeId || '', apiMethod)

  // Fetch trade details using the correct calculation method
  const { data: trade, isLoading: loadingTrade, error: tradeError } = useTrade(userId, tradeId || '', apiMethod)

  // Mutations
  const saveJournal = useSaveJournal()
  const deleteJournal = useDeleteJournal()
  const saveCommissionOverride = useSaveCommissionOverride()

  // Initialize form with existing journal data
  useEffect(() => {
    if (journal) {
      setNotes(journal.journalText || '')
      setTags(journal.tags || [])
      setIsEditing(true)
      // Initialize commission override if exists
      if (journal.commissionOverride) {
        setOverrideCommission(journal.commissionOverride.overrideCommission.toString())
        setOverrideReason(journal.commissionOverride.reason || '')
        setShowCommissionOverride(true)
      }
    }
  }, [journal])

  // Handle save
  const handleSave = async () => {
    if (!tradeId) return

    try {
      await saveJournal.mutateAsync({
        userId,
        tradeId,
        journalText: notes,
        tags: tags.length > 0 ? tags : undefined,
        symbol: trade?.symbol,
        exitDate: trade?.exitDate?.toISOString(),
        calculationMethod: apiMethod
      })

      navigate('/app/journals')
    } catch (error) {
      // Error is handled by the mutation
    }
  }

  // Handle commission override save
  const handleSaveCommissionOverride = async () => {
    if (!tradeId || !overrideCommission) {
      toast.error('Please enter a commission amount')
      return
    }

    const numOverride = parseFloat(overrideCommission)
    if (isNaN(numOverride)) {
      toast.error('Please enter a valid number')
      return
    }

    try {
      await saveCommissionOverride.mutateAsync({
        userId,
        tradeId,
        overrideCommission: numOverride,
        reason: overrideReason || undefined,
        existingJournalText: notes,
        calculationMethod: apiMethod
      })
      // Success toast is handled by the mutation
    } catch (error) {
      // Error is handled by the mutation
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!tradeId) return

    try {
      await deleteJournal.mutateAsync({ userId, tradeId })
      navigate('/app/journals')
    } catch (error) {
      // Error is handled by the mutation
    }
  }

  // Handle template selection
  const applyTemplate = (template: 'entry' | 'exit' | 'analysis') => {
    const templates = {
      entry: `## Entry Analysis
**Setup:**
**Entry Trigger:**
**Risk/Reward:**
**Position Size:**

## Market Context
**Overall Market:**
**Sector Performance:**
**Key Levels:**

## Trade Plan
**Target 1:**
**Target 2:**
**Stop Loss:**
**Management Strategy:** `,

      exit: `## Exit Review
**Exit Reason:**
**Exit Execution:**
**Actual vs Planned:**

## Performance Analysis
**What Worked:**
**What Didn't Work:**
**Improvements:**

## Lessons Learned
`,

      analysis: `## Trade Analysis
**Strategy Used:**
**Time Frame:**
**Market Conditions:**

## Technical Analysis
**Entry Setup:**
**Key Indicators:**
**Price Action:**

## Risk Management
**Position Sizing:**
**Stop Loss Placement:**
**Risk/Reward Ratio:**

## Outcome
**Result:**
**Execution Quality:**

## Improvements
**What to Keep:**
**What to Change:**
**Action Items:** `
    }

    setNotes(templates[template])
    toast.success(`${template.charAt(0).toUpperCase() + template.slice(1)} template applied`)
  }

  if (loadingJournal || loadingTrade) {
    return <LoadingSpinner fullScreen />
  }

  if (journalError) {
    return (
      <ErrorMessage
        title="Failed to Load Journal"
        message="Unable to fetch journal data. Please try again."
        onRetry={() => window.location.reload()}
        fullScreen
      />
    )
  }

  return (
    <div className={`min-h-screen bg-gray-900 py-8 px-4 transition-all duration-300 ${isExpanded ? 'ml-60' : 'ml-16'}`}>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/app/journals')}
            className="text-gray-400 hover:text-white mb-4 flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Journals
          </button>

          <h1 className="text-3xl font-bold text-white mb-2">
            {isEditing ? 'Edit' : 'Create'} Trade Journal
          </h1>

          {trade && (
            <div className="flex items-center space-x-6 text-gray-400">
              <span className="text-lg font-medium text-white">{trade.symbol}</span>
              <span>{trade.exitDate ? format(parseISO(trade.exitDate.toISOString()), 'MMM dd, yyyy') : 'N/A'}</span>
              <span className={(trade.pl + Math.abs(trade.commission)) >= 0 ? 'text-green-400' : 'text-red-400'}>
                {formatCurrency(trade.pl + Math.abs(trade.commission))}
              </span>
              <span>{trade.quantity} contracts</span>
            </div>
          )}
        </div>

        {/* Trade Summary Card */}
        {trade && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <h2 className="text-lg font-semibold text-white mb-4">Trade Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Entry Date</p>
                <p className="text-white">{format(parseISO(trade.entryDate.toISOString()), 'MMM dd, yyyy')}</p>
              </div>
              <div>
                <p className="text-gray-400">Exit Date</p>
                <p className="text-white">{trade.exitDate ? format(parseISO(trade.exitDate.toISOString()), 'MMM dd, yyyy') : 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-400">Duration</p>
                <p className="text-white">{Math.floor(trade.duration / (24 * 60))} days</p>
              </div>
              <div>
                <p className="text-gray-400">Return</p>
                <p className={trade.plPercent >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {trade.plPercent.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-gray-400">Entry Price</p>
                <p className="text-white">{formatCurrency(trade.entryPrice)}</p>
              </div>
              <div>
                <p className="text-gray-400">Exit Price</p>
                <p className="text-white">{trade.exitPrice ? formatCurrency(trade.exitPrice) : 'N/A'}</p>
              </div>
              <div>
                <p className="text-gray-400">Gross P&L</p>
                <p className={(trade.pl + Math.abs(trade.commission)) >= 0 ? 'text-green-400' : 'text-red-400'}>
                  {formatCurrency(trade.pl + Math.abs(trade.commission))}
                </p>
              </div>
              <div>
                <p className="text-gray-400">Commissions</p>
                <p className="text-yellow-400">{formatCurrency(trade.commission)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Commission Override Section */}
        {trade && (
          <div className="bg-gray-800 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Commission Override</h2>
              {!showCommissionOverride && (
                <button
                  onClick={() => setShowCommissionOverride(true)}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  Edit Commission
                </button>
              )}
            </div>

            {journal?.commissionOverride && !showCommissionOverride && (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-400">Current Override:</span>
                <span className="text-yellow-400 font-medium">
                  {formatCurrency(journal.commissionOverride.overrideCommission)}
                </span>
                <span className="text-gray-500">
                  (Original: {formatCurrency(journal.commissionOverride.originalCommission)})
                </span>
                {journal.commissionOverride.reason && (
                  <span className="text-gray-400 italic">
                    "{journal.commissionOverride.reason}"
                  </span>
                )}
              </div>
            )}

            {showCommissionOverride && (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">
                  Override the commission for this trade. This will be saved and used in statistics calculations.
                  Current commission: <span className="text-yellow-400">{formatCurrency(trade.commission)}</span>
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      New Commission Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={overrideCommission}
                        onChange={(e) => setOverrideCommission(e.target.value)}
                        placeholder={trade.commission.toString()}
                        className="w-full pl-8 pr-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Enter the corrected commission (use negative for costs)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Reason for Override
                    </label>
                    <input
                      type="text"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="e.g., Volume rebate applied, Data feed error"
                      className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowCommissionOverride(false)
                      // Reset to original values
                      if (journal?.commissionOverride) {
                        setOverrideCommission(journal.commissionOverride.overrideCommission.toString())
                        setOverrideReason(journal.commissionOverride.reason || '')
                      } else {
                        setOverrideCommission('')
                        setOverrideReason('')
                      }
                    }}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveCommissionOverride}
                    disabled={saveCommissionOverride.isPending}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50"
                  >
                    {saveCommissionOverride.isPending ? 'Saving...' : 'Save Commission Override'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Journal Form */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          {/* Templates */}
          {!isEditing && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Quick Templates
              </label>
              <div className="flex space-x-2">
                <button
                  onClick={() => applyTemplate('entry')}
                  className="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 text-sm"
                >
                  Entry Analysis
                </button>
                <button
                  onClick={() => applyTemplate('exit')}
                  className="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 text-sm"
                >
                  Exit Review
                </button>
                <button
                  onClick={() => applyTemplate('analysis')}
                  className="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600 text-sm"
                >
                  Full Analysis
                </button>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Journal Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={12}
              placeholder="Document your trade analysis, thoughts, and lessons learned..."
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">Supports Markdown formatting</p>
          </div>

          {/* Tags */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tags
            </label>
            <TagInput
              tags={tags}
              onChange={setTags}
              placeholder="Add tags (e.g., breakout, earnings, swing-trade)..."
            />
          </div>

          {/* Action Buttons */}
          <div className="flex justify-between">
            <div>
              {isEditing && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition"
                >
                  Delete Journal
                </button>
              )}
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => navigate('/app/journals')}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saveJournal.isPending}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50"
              >
                {saveJournal.isPending ? 'Saving...' : isEditing ? 'Update Journal' : 'Save Journal'}
              </button>
            </div>
          </div>
        </div>

        {/* Chart Gallery */}
        {journal && (
          <ChartGallery
            userId={userId}
            tradeId={tradeId || ''}
            charts={journal.charts || []}
          />
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md">
              <h3 className="text-xl font-bold text-white mb-4">Delete Journal?</h3>
              <p className="text-gray-300 mb-6">
                Are you sure you want to delete this journal entry? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteJournal.isPending}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
                >
                  {deleteJournal.isPending ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}