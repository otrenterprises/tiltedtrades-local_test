/**
 * Journal Editor Page
 * Create and edit trade journal entries with notes, tags, and charts
 *
 * Mobile optimized with:
 * - PageLayout for consistent navigation handling
 * - Responsive typography and spacing
 * - Touch-friendly buttons with active states
 * - Collapsible sections on mobile
 */

import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useJournal, useSaveJournal, useDeleteJournal, useSaveCommissionOverride } from '../../hooks/useJournal'
import { useTrade } from '../../hooks/useTrades'
import { PageLayout } from '../../components/layout/PageLayout'
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner'
import { ErrorMessage } from '../../components/feedback/ErrorMessage'
import { TagInput } from '../../components/journal/TagInput'
import { ChartGallery } from '../../components/journal/ChartGallery'
import { formatCurrency } from '../../utils/formatting'
import { parseISO, format } from 'date-fns'
import { toast } from 'react-hot-toast'
import { ArrowLeft, ChevronDown, ChevronRight, AlertTriangle, Info } from 'lucide-react'

// Mobile section IDs for collapsible accordion
type MobileSectionId = 'summary' | 'commission' | 'journal' | 'charts'

export const JournalEditor: React.FC = () => {
  const { tradeId } = useParams<{ tradeId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
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
  const [useExitDateAsModified, setUseExitDateAsModified] = useState(false)

  // Mobile collapsible sections - start with journal expanded
  const [expandedSections, setExpandedSections] = useState<Set<MobileSectionId>>(new Set(['journal']))

  const toggleSection = (sectionId: MobileSectionId) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId)
      } else {
        newSet.add(sectionId)
      }
      return newSet
    })
  }

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
    if (isNaN(numOverride) || numOverride < 0) {
      toast.error('Please enter a valid positive number')
      return
    }

    // Convert to negative (commissions are always costs)
    const negativeCommission = -Math.abs(numOverride)

    try {
      // Determine which date to use for lastModified
      let modifiedDate: string | undefined = undefined
      if (useExitDateAsModified && trade?.exitDate) {
        // Ensure exitDate is a string (could be Date object)
        modifiedDate = typeof trade.exitDate === 'string'
          ? trade.exitDate
          : trade.exitDate.toISOString()
      }

      await saveCommissionOverride.mutateAsync({
        userId,
        tradeId,
        overrideCommission: negativeCommission,
        reason: overrideReason || undefined,
        existingJournalText: notes,
        calculationMethod: apiMethod,
        modifiedDate
      })
      // Success toast is handled by the mutation
      // Reset checkbox after successful save
      setUseExitDateAsModified(false)
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

  const grossPL = trade ? trade.pl + Math.abs(trade.commission) : 0
  const isGrossProfitable = grossPL >= 0

  // Back button component
  const backButton = (
    <button
      onClick={() => navigate('/app/journals')}
      className="text-gray-400 hover:text-white flex items-center group active:text-blue-400 transition-colors"
    >
      <ArrowLeft className="w-5 h-5 mr-1 md:mr-2 group-hover:-translate-x-1 transition-transform" />
      <span className="hidden sm:inline">Back to Journals</span>
      <span className="sm:hidden">Back</span>
    </button>
  )

  // Collapsible section header component for mobile
  const SectionHeader: React.FC<{
    id: MobileSectionId
    title: string
    subtitle?: string
  }> = ({ id, title, subtitle }) => {
    const isExpanded = expandedSections.has(id)
    return (
      <button
        onClick={() => toggleSection(id)}
        className="md:hidden w-full flex items-center justify-between p-4 bg-gray-800 rounded-lg hover:bg-gray-750 active:bg-gray-700 transition-colors"
      >
        <div>
          <span className="font-medium text-white">{title}</span>
          {subtitle && <span className="text-xs text-gray-400 block">{subtitle}</span>}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>
    )
  }

  return (
    <PageLayout
      title={isEditing ? 'Edit Journal' : 'New Journal'}
      subtitle={trade ? (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium text-white">{trade.symbol}</span>
          <span className={isGrossProfitable ? 'text-green-400' : 'text-red-400'}>
            {formatCurrency(grossPL)}
          </span>
          <span className="text-gray-400 text-xs sm:text-sm">
            {trade.exitDate ? format(parseISO(trade.exitDate.toISOString()), 'MMM dd, yyyy') : 'N/A'}
          </span>
        </span>
      ) : undefined}
      actions={backButton}
    >
      {/* ===== MOBILE VIEW ===== */}
      <div className="md:hidden space-y-3">
        {/* Trade Summary Section */}
        {trade && (
          <>
            <SectionHeader id="summary" title="Trade Summary" />
            {expandedSections.has('summary') && (
              <div className="bg-gray-800 rounded-lg p-4 mx-1">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs">Entry</p>
                    <p className="text-white">{format(parseISO(trade.entryDate.toISOString()), 'MMM dd')}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Exit</p>
                    <p className="text-white">{trade.exitDate ? format(parseISO(trade.exitDate.toISOString()), 'MMM dd') : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Entry Price</p>
                    <p className="text-white">{formatCurrency(trade.entryPrice)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Exit Price</p>
                    <p className="text-white">{trade.exitPrice ? formatCurrency(trade.exitPrice) : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Gross P&L</p>
                    <p className={isGrossProfitable ? 'text-green-400' : 'text-red-400'}>
                      {formatCurrency(grossPL)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Return</p>
                    <p className={trade.plPercent >= 0 ? 'text-green-400' : 'text-red-400'}>
                      {trade.plPercent.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Commission Override Section */}
        {trade && (
          <>
            <SectionHeader
              id="commission"
              title="Commission"
              subtitle={journal?.commissionOverride ? 'Override applied' : `$${Math.abs(trade.commission).toFixed(2)}`}
            />
            {expandedSections.has('commission') && (
              <div className="bg-gray-800 rounded-lg p-4 mx-1">
                {renderCommissionSection()}
              </div>
            )}
          </>
        )}

        {/* Journal Form Section */}
        <SectionHeader id="journal" title="Journal Entry" />
        {expandedSections.has('journal') && (
          <div className="bg-gray-800 rounded-lg p-4 mx-1 space-y-4">
            {/* Templates - horizontal scroll on mobile */}
            {!isEditing && (
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-2">
                  Quick Templates
                </label>
                <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                  <button
                    onClick={() => applyTemplate('entry')}
                    className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-xs whitespace-nowrap active:bg-gray-600"
                  >
                    Entry
                  </button>
                  <button
                    onClick={() => applyTemplate('exit')}
                    className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-xs whitespace-nowrap active:bg-gray-600"
                  >
                    Exit
                  </button>
                  <button
                    onClick={() => applyTemplate('analysis')}
                    className="px-3 py-1.5 bg-gray-700 text-gray-300 rounded text-xs whitespace-nowrap active:bg-gray-600"
                  >
                    Full Analysis
                  </button>
                </div>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={8}
                placeholder="Document your trade..."
                className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
              />
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1.5">
                Tags
              </label>
              <TagInput
                tags={tags}
                onChange={setTags}
                placeholder="Add tags..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={saveJournal.isPending}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg font-medium text-sm transition disabled:opacity-50"
              >
                {saveJournal.isPending ? 'Saving...' : isEditing ? 'Update Journal' : 'Save Journal'}
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => navigate('/app/journals')}
                  className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white rounded-lg text-sm transition"
                >
                  Cancel
                </button>
                {isEditing && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg text-sm transition"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Chart Gallery */}
        {journal && (
          <>
            <SectionHeader id="charts" title="Charts" />
            {expandedSections.has('charts') && (
              <div className="mx-1">
                <ChartGallery
                  userId={userId}
                  tradeId={tradeId || ''}
                  charts={journal.chartReferences || []}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* ===== DESKTOP VIEW ===== */}
      <div className="hidden md:block">
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
                <p className={isGrossProfitable ? 'text-green-400' : 'text-red-400'}>
                  {formatCurrency(grossPL)}
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
                  onClick={() => {
                    const currentCommission = journal?.commissionOverride
                      ? Math.abs(journal.commissionOverride.overrideCommission)
                      : Math.abs(trade.commission)
                    setOverrideCommission(currentCommission.toFixed(2))
                    if (journal?.commissionOverride?.reason) {
                      setOverrideReason(journal.commissionOverride.reason)
                    }
                    setShowCommissionOverride(true)
                  }}
                  className="text-sm text-blue-400 hover:text-blue-300"
                >
                  {journal?.commissionOverride || trade.hasCommissionOverride ? 'Edit Override' : 'Add Override'}
                </button>
              )}
            </div>
            {renderCommissionSection()}
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
            charts={journal.chartReferences || []}
          />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Delete Journal?</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete this journal entry? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteJournal.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg transition disabled:opacity-50"
              >
                {deleteJournal.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )

  // Commission section render function (shared between mobile and desktop)
  function renderCommissionSection() {
    if (!trade) return null

    return (
      <>
        {/* Display existing override info when not editing */}
        {journal?.commissionOverride && !showCommissionOverride && (
          <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 md:p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-yellow-500" />
              <span className="text-yellow-400 font-medium text-sm md:text-base">Commission adjusted</span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-xs md:text-sm">
              <div>
                <span className="text-gray-500 block">Original</span>
                <span className="text-gray-300 font-mono">
                  ${Math.abs(journal.commissionOverride.originalCommission).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Current</span>
                <span className="text-yellow-400 font-mono font-medium">
                  ${Math.abs(journal.commissionOverride.overrideCommission).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-gray-500 block">Savings</span>
                {(() => {
                  const originalAbs = Math.abs(journal.commissionOverride.originalCommission)
                  const currentAbs = Math.abs(journal.commissionOverride.overrideCommission)
                  const savings = originalAbs - currentAbs
                  const isSavings = savings > 0
                  return (
                    <span className={`font-mono font-medium ${isSavings ? 'text-green-400' : 'text-red-400'}`}>
                      {isSavings ? '-' : '+'}${Math.abs(savings).toFixed(2)}
                    </span>
                  )
                })()}
              </div>
              <div>
                <span className="text-gray-500 block">Modified</span>
                <span className="text-gray-300 text-xs">
                  {journal.commissionOverride.lastModified
                    ? format(parseISO(journal.commissionOverride.lastModified), 'MMM d, yyyy')
                    : 'Unknown'}
                </span>
              </div>
            </div>

            {journal.commissionOverride.reason && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <span className="text-gray-500 text-xs md:text-sm">Reason: </span>
                <span className="text-gray-300 text-xs md:text-sm italic">"{journal.commissionOverride.reason}"</span>
              </div>
            )}

            {/* Mobile: Add edit button */}
            <button
              onClick={() => {
                const currentCommission = Math.abs(journal.commissionOverride!.overrideCommission)
                setOverrideCommission(currentCommission.toFixed(2))
                if (journal.commissionOverride?.reason) {
                  setOverrideReason(journal.commissionOverride.reason)
                }
                setShowCommissionOverride(true)
              }}
              className="md:hidden mt-3 text-sm text-blue-400 active:text-blue-300"
            >
              Edit Override
            </button>
          </div>
        )}

        {/* No override in journal but trade indicates override exists */}
        {!journal?.commissionOverride && trade.hasCommissionOverride && !showCommissionOverride && (
          <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3 md:p-4">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 md:w-5 md:h-5 text-blue-400" />
              <span className="text-blue-400 font-medium text-sm md:text-base">Override applied</span>
            </div>
            <p className="text-sm text-gray-400">
              Current: <span className="text-yellow-400 font-mono">${Math.abs(trade.commission).toFixed(2)}</span>
            </p>
            <button
              onClick={() => {
                setOverrideCommission(Math.abs(trade.commission).toFixed(2))
                setShowCommissionOverride(true)
              }}
              className="md:hidden mt-2 text-sm text-blue-400 active:text-blue-300"
            >
              Edit Override
            </button>
          </div>
        )}

        {/* No override exists - show current commission */}
        {!journal?.commissionOverride && !trade.hasCommissionOverride && !showCommissionOverride && (
          <div className="text-sm text-gray-400">
            Current: <span className="text-yellow-400 font-mono">${Math.abs(trade.commission).toFixed(2)}</span>
            <span className="text-gray-500 ml-2">— No override</span>
            <button
              onClick={() => {
                setOverrideCommission(Math.abs(trade.commission).toFixed(2))
                setShowCommissionOverride(true)
              }}
              className="md:hidden block mt-2 text-sm text-blue-400 active:text-blue-300"
            >
              Add Override
            </button>
          </div>
        )}

        {/* Edit/Add override form */}
        {showCommissionOverride && (
          <div className="space-y-4">
            {/* Show context when editing existing override */}
            {journal?.commissionOverride && (
              <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-blue-400" />
                  <span className="text-blue-400 text-sm font-medium">Editing override</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Original: </span>
                    <span className="text-gray-300 font-mono">${Math.abs(journal.commissionOverride.originalCommission).toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Previous: </span>
                    <span className="text-yellow-400 font-mono">${Math.abs(journal.commissionOverride.overrideCommission).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            <p className="text-xs md:text-sm text-gray-400">
              Override the commission for this trade.
              {!journal?.commissionOverride && (
                <> Current: <span className="text-yellow-400 font-mono">${Math.abs(trade.commission).toFixed(2)}</span></>
              )}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-300 mb-1.5 md:mb-2">
                  New Amount
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={overrideCommission}
                    onChange={(e) => setOverrideCommission(e.target.value)}
                    placeholder={Math.abs(journal?.commissionOverride
                      ? journal.commissionOverride.originalCommission
                      : trade.commission).toFixed(2)}
                    className="w-full pl-8 pr-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-gray-300 mb-1.5 md:mb-2">
                  Reason
                </label>
                <input
                  type="text"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g., Volume rebate"
                  className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none text-sm"
                />
              </div>
            </div>

            {/* Use trade exit date as modified date option */}
            {trade?.exitDate && (
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useExitDateAsModified}
                  onChange={(e) => setUseExitDateAsModified(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
                />
                <span className="text-xs md:text-sm text-gray-300">
                  Use exit date as modified ({format(
                    typeof trade.exitDate === 'string' ? parseISO(trade.exitDate) : trade.exitDate,
                    'MMM d'
                  )})
                </span>
              </label>
            )}

            <div className="flex gap-2 md:justify-end">
              <button
                onClick={() => {
                  setShowCommissionOverride(false)
                  setUseExitDateAsModified(false)
                  if (journal?.commissionOverride) {
                    setOverrideCommission(journal.commissionOverride.overrideCommission.toString())
                    setOverrideReason(journal.commissionOverride.reason || '')
                  } else {
                    setOverrideCommission('')
                    setOverrideReason('')
                  }
                }}
                className="flex-1 md:flex-none px-4 py-2 bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveCommissionOverride}
                disabled={saveCommissionOverride.isPending}
                className="flex-1 md:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-sm disabled:opacity-50"
              >
                {saveCommissionOverride.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </>
    )
  }
}
