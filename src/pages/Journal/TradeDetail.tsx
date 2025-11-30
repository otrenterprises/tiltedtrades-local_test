/**
 * Trade Detail Page
 * Comprehensive trade breakdown with journal entry display and inline editing
 */

import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigation } from '@/contexts/NavigationContext'
import { useJournal, useSaveJournal, useDeleteJournal } from '../../hooks/useJournal'
import { useTrade } from '../../hooks/useTrades'
import { LoadingSpinner } from '../../components/feedback/LoadingSpinner'
import { ErrorMessage } from '../../components/feedback/ErrorMessage'
import { TagInput } from '../../components/journal/TagInput'
import { ChartGallery } from '../../components/journal/ChartGallery'
import { formatCurrency } from '../../utils/formatting'
import { parseISO, format } from 'date-fns'
import { ArrowLeft, Edit, Calendar, DollarSign, TrendingUp, TrendingDown, Clock, Tag, X, Check, Trash2, ExternalLink, Settings } from 'lucide-react'
import { toast } from 'react-hot-toast'

export const TradeDetail: React.FC = () => {
  const { tradeId } = useParams<{ tradeId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { isExpanded } = useNavigation()
  const userId = user?.userId || ''

  // Get calculation method from navigation state (passed from TradeLog)
  const navCalculationMethod = (location.state as { calculationMethod?: 'fifo' | 'perPosition' })?.calculationMethod

  // Determine API method: priority is navigation state > default 'fifo'
  // Navigation state is required since we use method-prefixed tradeIds
  const apiMethod = navCalculationMethod || 'fifo'

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editNotes, setEditNotes] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Fetch journal entry with calculationMethod
  const { data: journal, isLoading: loadingJournal } = useJournal(userId, tradeId || '', apiMethod)

  // Mutations
  const saveJournal = useSaveJournal()
  const deleteJournal = useDeleteJournal()

  const { data: trade, isLoading: loadingTrade, error: tradeError } = useTrade(
    userId,
    tradeId || '',
    apiMethod
  )

  // Initialize edit form when entering edit mode
  useEffect(() => {
    if (isEditing && journal) {
      setEditNotes(journal.journalText || '')
      setEditTags(journal.tags || [])
    }
  }, [isEditing, journal])

  // Handle save
  const handleSave = async () => {
    if (!tradeId || !editNotes.trim()) {
      toast.error('Please enter some notes')
      return
    }

    try {
      await saveJournal.mutateAsync({
        userId,
        tradeId,
        journalText: editNotes,
        tags: editTags.length > 0 ? editTags : undefined,
        symbol: trade?.symbol,
        exitDate: trade?.exitDate?.toISOString(),
        calculationMethod: apiMethod === 'perPosition' ? 'perPosition' : 'fifo'
      })
      setIsEditing(false)
      toast.success('Journal updated successfully')
    } catch (error) {
      // Error handled by mutation
    }
  }

  // Handle delete
  const handleDelete = async () => {
    if (!tradeId) return

    try {
      await deleteJournal.mutateAsync({ userId, tradeId })
      setShowDeleteConfirm(false)
      navigate('/app/journals')
    } catch (error) {
      // Error handled by mutation
    }
  }

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditNotes(journal?.journalText || '')
    setEditTags(journal?.tags || [])
  }

  // Calculate duration with seconds precision
  const getDuration = () => {
    if (!trade?.entryDate || !trade?.exitDate) return 'N/A'

    const entryDate = typeof trade.entryDate === 'string' ? parseISO(trade.entryDate) : trade.entryDate
    const exitDate = typeof trade.exitDate === 'string' ? parseISO(trade.exitDate) : trade.exitDate

    const durationSeconds = Math.floor((exitDate.getTime() - entryDate.getTime()) / 1000)
    const hours = Math.floor(durationSeconds / 3600)
    const minutes = Math.floor((durationSeconds % 3600) / 60)
    const seconds = durationSeconds % 60

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    } else {
      return `${seconds}s`
    }
  }

  if (loadingJournal || loadingTrade) {
    return <LoadingSpinner fullScreen />
  }

  if (tradeError || !trade) {
    return (
      <ErrorMessage
        title="Trade Not Found"
        message="Unable to load trade details. Please try again."
        onRetry={() => window.location.reload()}
        fullScreen
      />
    )
  }

  // Calculate P&L
  const pnl = trade.pl
  const isProfitable = pnl >= 0

  return (
    <div className={`min-h-screen bg-gray-900 py-8 px-4 transition-all duration-300 ${isExpanded ? 'ml-60' : 'ml-16'}`}>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/app/journals')}
            className="text-gray-400 hover:text-white mb-4 flex items-center group"
          >
            <ArrowLeft className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Journals
          </button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{trade.symbol}</h1>
              <p className="text-gray-400">Trade Details & Journal</p>
            </div>
            {journal && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition"
                title="Delete journal"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Trade Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* P&L Card */}
          <div className={`bg-gray-800 rounded-lg p-6 border-l-4 ${(trade.pl + Math.abs(trade.commission)) >= 0 ? 'border-green-500' : 'border-red-500'}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-400 text-sm">Gross P&L</p>
              <DollarSign className={`w-5 h-5 ${(trade.pl + Math.abs(trade.commission)) >= 0 ? 'text-green-400' : 'text-red-400'}`} />
            </div>
            <p className={`text-2xl font-bold ${(trade.pl + Math.abs(trade.commission)) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {formatCurrency(trade.pl + Math.abs(trade.commission))}
            </p>
          </div>

          {/* Return % Card */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-400 text-sm">Return</p>
              {isProfitable ? (
                <TrendingUp className="w-5 h-5 text-green-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-400" />
              )}
            </div>
            <p className={`text-2xl font-bold ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
              {trade.plPercent?.toFixed(2) || '0.00'}%
            </p>
          </div>

          {/* Duration Card */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-400 text-sm">Duration</p>
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-white">{getDuration()}</p>
          </div>

          {/* Quantity Card */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-gray-400 text-sm">Quantity</p>
              <Calendar className="w-5 h-5 text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-white">{trade.quantity}</p>
            <p className="text-xs text-gray-500 mt-1">contracts</p>
          </div>
        </div>

        {/* Detailed Trade Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Entry Details */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-3"></span>
              Entry Details
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Entry Date</span>
                <span className="text-white font-medium">
                  {trade.entryDate && format(
                    typeof trade.entryDate === 'string' ? parseISO(trade.entryDate) : trade.entryDate,
                    'MMM dd, yyyy HH:mm:ss'
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Entry Price</span>
                <span className="text-white font-medium">{formatCurrency(trade.entryPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Side</span>
                <span className={`font-medium ${trade.side === 'Long' ? 'text-green-400' : 'text-red-400'}`}>
                  {trade.side || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Exit Details */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center">
              <span className="w-2 h-2 bg-red-500 rounded-full mr-3"></span>
              Exit Details
            </h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Exit Date</span>
                <span className="text-white font-medium">
                  {trade.exitDate && format(
                    typeof trade.exitDate === 'string' ? parseISO(trade.exitDate) : trade.exitDate,
                    'MMM dd, yyyy HH:mm:ss'
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Exit Price</span>
                <span className="text-white font-medium">{trade.exitPrice ? formatCurrency(trade.exitPrice) : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Price Change</span>
                <span className={`font-medium ${trade.exitPrice && trade.exitPrice - trade.entryPrice >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {trade.exitPrice ? `${formatCurrency(trade.exitPrice - trade.entryPrice)} (${((trade.exitPrice - trade.entryPrice) / trade.entryPrice * 100).toFixed(2)}%)` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* P&L Breakdown */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">P&L Breakdown</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-gray-400 text-sm mb-1">P&L Type</p>
              <p className="text-xl font-bold text-blue-400">
                {journal?.calculationMethod === 'perPosition' ? 'Positional' : 'FIFO'}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Gross P&L</p>
              <p className={`text-xl font-bold ${(trade.pl + Math.abs(trade.commission)) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(trade.pl + Math.abs(trade.commission))}
              </p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Commissions</p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold text-yellow-400">
                  {formatCurrency(trade.commission)}
                </p>
                <button
                  onClick={() => navigate(`/app/trades/${tradeId}/journal`, { state: { calculationMethod: apiMethod } })}
                  className="p-1 text-gray-400 hover:text-blue-400 hover:bg-blue-900/20 rounded transition"
                  title="Edit commission override"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
              {trade.hasCommissionOverride && (
                <p className="text-xs text-blue-400 mt-1">Override applied</p>
              )}
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Net P&L</p>
              <p className={`text-xl font-bold ${isProfitable ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(pnl)}
              </p>
            </div>
          </div>
        </div>

        {/* Journal Entry Section */}
        {journal ? (
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Journal Entry</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">
                  Last updated: {format(parseISO(journal.updatedAt), 'MMM dd, yyyy')}
                </span>
                {!isEditing && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition"
                    >
                      <Edit className="w-4 h-4" />
                      Edit
                    </button>
                    <button
                      onClick={() => navigate(`/app/trades/${tradeId}/journal`, { state: { calculationMethod: apiMethod } })}
                      className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded-lg transition"
                      title="Open full editor with commission override"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Full Editor
                    </button>
                  </div>
                )}
              </div>
            </div>

            {isEditing ? (
              /* Edit Mode */
              <div className="space-y-6">
                {/* Notes Editor */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Notes</label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    rows={8}
                    placeholder="Document your trade analysis, thoughts, and lessons learned..."
                    className="w-full px-4 py-3 bg-gray-900 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
                  />
                </div>

                {/* Tags Editor */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Tags</label>
                  <TagInput
                    tags={editTags}
                    onChange={setEditTags}
                    placeholder="Add tags..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end pt-4 border-t border-gray-700">
                  <div className="flex gap-3">
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                    >
                      <X className="w-4 h-4" />
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saveJournal.isPending || !editNotes.trim()}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Check className="w-4 h-4" />
                      {saveJournal.isPending ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* View Mode */
              <>
                {/* Tags */}
                {journal.tags && journal.tags.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag className="w-4 h-4 text-gray-400" />
                      <span className="text-sm font-medium text-gray-400">Tags</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {journal.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-3 py-1 bg-blue-600 bg-opacity-20 text-blue-400 text-sm rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {journal.journalText && (
                  <div className="mb-6">
                    <h3 className="text-sm font-medium text-gray-400 mb-3">Notes</h3>
                    <div className="bg-gray-900 rounded-lg p-4">
                      <pre className="text-gray-300 text-sm whitespace-pre-wrap font-sans">
                        {journal.journalText}
                      </pre>
                    </div>
                  </div>
                )}

              </>
            )}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-lg p-12 text-center">
            <p className="text-gray-400 mb-4">No journal entry for this trade yet.</p>
            <button
              onClick={() => navigate(`/app/trades/${tradeId}/journal`, { state: { calculationMethod: apiMethod } })}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition"
            >
              Create Journal Entry
            </button>
          </div>
        )}

        {/* Chart Gallery - only show if journal exists */}
        {journal && (
          <div className="mt-8">
            <ChartGallery
              userId={userId}
              tradeId={tradeId || ''}
              charts={journal.chartReferences || []}
            />
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md mx-4">
              <h3 className="text-xl font-bold text-white mb-4">Delete Journal?</h3>
              <p className="text-gray-300 mb-6">
                Are you sure you want to delete this journal entry? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteJournal.isPending}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition disabled:opacity-50"
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
