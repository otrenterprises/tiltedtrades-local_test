/**
 * useUpload Hook
 * Handles file upload operations with progress tracking
 */

import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadService } from '@/services/api/upload.service'
import toast from 'react-hot-toast'

interface UploadState {
  isUploading: boolean
  progress: number
  error: string | null
}

export const useUpload = () => {
  const queryClient = useQueryClient()
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    progress: 0,
    error: null
  })

  const resetUpload = useCallback(() => {
    setUploadState({
      isUploading: false,
      progress: 0,
      error: null
    })
  }, [])

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      setUploadState({
        isUploading: true,
        progress: 0,
        error: null
      })

      return uploadService.uploadFile(file, {
        onProgress: (progress: number) => {
          setUploadState(prev => ({ ...prev, progress }))
        },
        onError: (error) => {
          setUploadState(prev => ({
            ...prev,
            isUploading: false,
            error: error.message
          }))
        }
      })
    },
    onSuccess: (fileId) => {
      toast.success('File uploaded successfully! Processing will begin shortly.')

      // Invalidate queries to refresh data after upload
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['trades'] })
        queryClient.invalidateQueries({ queryKey: ['executions'] })
        queryClient.invalidateQueries({ queryKey: ['stats'] })
      }, 3000) // Wait a bit for processing to start

      // Reset upload state after success
      setTimeout(() => {
        resetUpload()
      }, 1500)
    },
    onError: (error: any) => {
      const message = error.message || 'Upload failed'
      toast.error(message)
      setUploadState({
        isUploading: false,
        progress: 0,
        error: message
      })
    }
  })

  const uploadFile = useCallback((file: File) => {
    return uploadMutation.mutate(file)
  }, [uploadMutation])

  return {
    uploadFile,
    isUploading: uploadState.isUploading,
    progress: uploadState.progress,
    error: uploadState.error,
    resetUpload
  }
}

/**
 * Hook for chart upload
 */
export const useChartUpload = (tradeId: string) => {
  const queryClient = useQueryClient()
  const [uploadProgress, setUploadProgress] = useState(0)

  const uploadMutation = useMutation({
    mutationFn: async ({ file, caption }: { file: File; caption?: string }) => {
      return uploadService.uploadChart(tradeId, file, caption, {
        onProgress: (progress: number) => {
          setUploadProgress(progress)
        }
      })
    },
    onSuccess: () => {
      toast.success('Chart uploaded successfully!')
      // Invalidate journal query to refresh charts
      queryClient.invalidateQueries({ queryKey: ['journal', tradeId] })
      setUploadProgress(0)
    },
    onError: (error: any) => {
      toast.error(error.message || 'Chart upload failed')
      setUploadProgress(0)
    }
  })

  return {
    uploadChart: uploadMutation.mutate,
    isUploading: uploadMutation.isPending,
    uploadProgress,
    error: uploadMutation.error
  }
}