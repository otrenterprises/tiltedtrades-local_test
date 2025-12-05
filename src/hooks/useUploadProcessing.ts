/**
 * useUploadProcessing Hook
 *
 * Tracks upload processing status by polling the TradingStats endpoint.
 * Detects when Lambda processing completes by monitoring calculatedAt timestamp changes.
 *
 * Features:
 * - Exponential backoff polling (2s -> 10s max)
 * - Automatic React Query cache invalidation on completion
 * - Global toast notifications that work even if modal is closed
 * - Timeout after ~5 minutes with user-friendly message
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { tradeService } from '@/services/api/trade.service'
import toast from 'react-hot-toast'

export type ProcessingStatus = 'idle' | 'uploading' | 'processing' | 'complete' | 'error' | 'timeout'

interface UploadProcessingState {
  status: ProcessingStatus
  progress: number           // 0-100 for upload, then shows polling progress
  error: string | null
  pollAttempt: number
  maxPollAttempts: number
}

interface UseUploadProcessingOptions {
  onComplete?: () => void
  onError?: (error: string) => void
  onTimeout?: () => void
}

export const useUploadProcessing = (options: UseUploadProcessingOptions = {}) => {
  const queryClient = useQueryClient()
  const [state, setState] = useState<UploadProcessingState>({
    status: 'idle',
    progress: 0,
    error: null,
    pollAttempt: 0,
    maxPollAttempts: 60
  })

  // Use refs to track polling state across renders
  // Note: We intentionally DON'T abort polling on unmount - the global toast
  // notifications will still show the result even if the modal is closed
  const isPollingRef = useRef(false)
  const baselineTimestampRef = useRef<string | null>(null)
  const isMountedRef = useRef(true)

  // Track mount state for safe state updates
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  /**
   * Capture the baseline stats timestamp before upload starts
   */
  const captureBaseline = useCallback(async () => {
    try {
      const timestamp = await tradeService.getStatsTimestamp()
      baselineTimestampRef.current = timestamp
      console.log('📊 Baseline stats timestamp:', timestamp || 'none (first upload)')
    } catch (error) {
      console.warn('⚠️ Could not capture baseline timestamp:', error)
      baselineTimestampRef.current = null
    }
  }, [])

  /**
   * Start polling for processing completion
   * This runs independently of component lifecycle - polling continues
   * even if the modal is closed, and global toasts notify the user
   */
  const startPolling = useCallback(async () => {
    if (isPollingRef.current) {
      console.log('⚠️ Polling already in progress')
      return
    }

    isPollingRef.current = true

    // Only update state if component is still mounted
    if (isMountedRef.current) {
      setState(prev => ({
        ...prev,
        status: 'processing',
        pollAttempt: 0
      }))
    }

    // Show processing toast that persists (works globally even if modal closes)
    const toastId = toast.loading('Processing your data...', {
      duration: Infinity // Will be dismissed manually
    })

    try {
      const result = await tradeService.pollForProcessingComplete(
        baselineTimestampRef.current,
        {
          maxAttempts: 60,
          initialDelayMs: 2000,
          maxDelayMs: 10000,
          onProgress: (attempt, maxAttempts) => {
            // Only update state if component is still mounted
            if (isMountedRef.current) {
              setState(prev => ({
                ...prev,
                pollAttempt: attempt,
                maxPollAttempts: maxAttempts,
                progress: Math.round((attempt / maxAttempts) * 100)
              }))
            }
          }
        }
      )

      toast.dismiss(toastId)

      if (result.success) {
        // Success! Invalidate all data caches (works globally)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['trades'] }),
          queryClient.invalidateQueries({ queryKey: ['executions'] }),
          queryClient.invalidateQueries({ queryKey: ['stats'] })
        ])

        // Update state only if mounted
        if (isMountedRef.current) {
          setState(prev => ({
            ...prev,
            status: 'complete',
            progress: 100,
            error: null
          }))
        }

        // Global toast - works even if modal is closed
        toast.success('Data processed successfully! Your trades are now available.', {
          duration: 5000
        })

        options.onComplete?.()
      } else if (result.timedOut) {
        if (isMountedRef.current) {
          setState(prev => ({
            ...prev,
            status: 'timeout',
            error: 'Processing is taking longer than expected'
          }))
        }

        toast.error(
          'Processing is taking longer than expected. Your data may still be processing. Try refreshing the page in a moment.',
          { duration: 8000 }
        )

        options.onTimeout?.()
      }
    } catch (error: unknown) {
      toast.dismiss(toastId)

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

      if (isMountedRef.current) {
        setState(prev => ({
          ...prev,
          status: 'error',
          error: errorMessage
        }))
      }

      toast.error(`Processing error: ${errorMessage}`, { duration: 5000 })
      options.onError?.(errorMessage)
    } finally {
      isPollingRef.current = false
    }
  }, [queryClient, options])

  /**
   * Cancel polling (if user wants to stop waiting)
   * Note: This only affects the local state - the polling loop will
   * continue in the background and show toasts when complete
   */
  const cancelPolling = useCallback(() => {
    // Note: We don't actually abort the polling loop - it continues
    // in the background and will show toast notifications when done.
    // This just resets the local UI state.
    isPollingRef.current = false
    if (isMountedRef.current) {
      setState(prev => ({
        ...prev,
        status: 'idle',
        progress: 0,
        pollAttempt: 0
      }))
    }
  }, [])

  /**
   * Reset state for a new upload
   */
  const reset = useCallback(() => {
    cancelPolling()
    baselineTimestampRef.current = null
    if (isMountedRef.current) {
      setState({
        status: 'idle',
        progress: 0,
        error: null,
        pollAttempt: 0,
        maxPollAttempts: 60
      })
    }
  }, [cancelPolling])

  /**
   * Set upload progress (0-100)
   */
  const setUploadProgress = useCallback((progress: number) => {
    if (isMountedRef.current) {
      setState(prev => ({
        ...prev,
        status: 'uploading',
        progress
      }))
    }
  }, [])

  /**
   * Called when S3 upload completes - transitions to processing state
   */
  const onUploadComplete = useCallback(() => {
    if (isMountedRef.current) {
      setState(prev => ({
        ...prev,
        status: 'processing',
        progress: 0 // Reset progress for polling phase
      }))
    }
    // Start polling for processing completion
    startPolling()
  }, [startPolling])

  return {
    // State
    status: state.status,
    progress: state.progress,
    error: state.error,
    pollAttempt: state.pollAttempt,
    maxPollAttempts: state.maxPollAttempts,
    isProcessing: state.status === 'processing' || state.status === 'uploading',
    isComplete: state.status === 'complete',

    // Actions
    captureBaseline,
    setUploadProgress,
    onUploadComplete,
    startPolling,
    cancelPolling,
    reset
  }
}
