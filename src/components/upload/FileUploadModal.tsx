/**
 * File Upload Modal Component
 * Handles file upload with progress tracking, validation, and processing status
 */

import React, { useState, useCallback, useEffect } from 'react'
import { uploadService } from '@/services/api/upload.service'
import { useUploadProcessing } from '@/hooks/useUploadProcessing'
import toast from 'react-hot-toast'

interface FileUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

  // Use the upload processing hook for tracking upload + processing status
  const {
    status,
    progress,
    pollAttempt,
    maxPollAttempts,
    isProcessing,
    isComplete,
    captureBaseline,
    setUploadProgress,
    onUploadComplete,
    reset: resetProcessing
  } = useUploadProcessing({
    onComplete: () => {
      // Close modal after a short delay to show success state
      setTimeout(() => {
        setFile(null)
        onSuccess?.()
        onClose()
        resetProcessing()
      }, 1500)
    }
  })

  // Reset processing state when modal opens
  useEffect(() => {
    if (isOpen) {
      resetProcessing()
    }
  }, [isOpen, resetProcessing])

  const isUploading = status === 'uploading'
  const isProcessingData = status === 'processing'
  const isBusy = isUploading || isProcessingData

  const validateFile = (file: File): boolean => {
    setValidationError(null)

    const maxSize = 50 * 1024 * 1024 // 50MB
    const allowedExtensions = ['.xlsx', '.xls', '.csv']
    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()

    if (!allowedExtensions.includes(extension)) {
      setValidationError(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`)
      return false
    }

    if (file.size > maxSize) {
      setValidationError('File size exceeds 50MB limit')
      return false
    }

    return true
  }

  const handleFileSelect = (selectedFile: File) => {
    if (validateFile(selectedFile)) {
      setFile(selectedFile)
      setValidationError(null)
    }
  }

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    // Capture baseline stats timestamp before upload starts
    await captureBaseline()

    try {
      const fileId = await uploadService.uploadFile(file, {
        onProgress: (uploadProgress) => {
          setUploadProgress(uploadProgress)
        },
        onComplete: () => {
          // S3 upload complete - now transition to processing state
          toast.success('File uploaded! Processing your data...')
          onUploadComplete() // This starts polling
        },
        onError: (error) => {
          toast.error(`Upload failed: ${error.message}`)
          resetProcessing()
        }
      })

      console.log('File uploaded with key:', fileId)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed'
      toast.error(errorMessage)
      resetProcessing()
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white">Upload Trading Data</h3>
            <button
              onClick={onClose}
              disabled={isUploading}
              className="text-gray-400 hover:text-white disabled:opacity-50"
              title={isProcessingData ? 'Close modal - processing will continue in background' : 'Close'}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-gray-600 hover:border-gray-500'
            } ${isBusy ? 'pointer-events-none opacity-50' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {!file ? (
              <>
                <svg
                  className="mx-auto h-12 w-12 text-gray-400 mb-4"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <p className="text-white mb-2">
                  Drag and drop your file here, or{' '}
                  <label className="text-blue-400 hover:text-blue-300 cursor-pointer">
                    browse
                    <input
                      type="file"
                      className="hidden"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileChange}
                      disabled={isBusy}
                    />
                  </label>
                </p>
                <p className="text-sm text-gray-400">
                  Supported formats: Excel (.xlsx, .xls) or CSV
                </p>
                <p className="text-sm text-gray-400">Maximum file size: 50MB</p>
              </>
            ) : (
              <div className="space-y-3">
                <svg
                  className="mx-auto h-12 w-12 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="max-w-full px-2">
                  <p className="text-white font-medium break-all text-sm leading-relaxed">{file.name}</p>
                  <p className="text-sm text-gray-400">{formatFileSize(file.size)}</p>
                </div>
                {!isBusy && (
                  <button
                    onClick={() => setFile(null)}
                    className="text-sm text-red-400 hover:text-red-300"
                  >
                    Remove file
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Validation Error */}
          {validationError && (
            <div className="mt-3 p-3 bg-red-900/20 border border-red-800 rounded">
              <p className="text-sm text-red-400">{validationError}</p>
            </div>
          )}

          {/* Progress Bar - Upload Phase */}
          {isUploading && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-400 mb-1">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Progress Bar - Processing Phase */}
          {isProcessingData && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-400 mb-1">
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Processing data...
                </span>
                <span className="text-xs">
                  {pollAttempt > 0 && `Check ${pollAttempt}/${maxPollAttempts}`}
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-green-500 h-2 rounded-full transition-all duration-500 animate-pulse"
                  style={{ width: '100%' }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Your data is being processed. This may take a moment...
              </p>
            </div>
          )}

          {/* Success State */}
          {isComplete && (
            <div className="mt-4 p-3 bg-green-900/20 border border-green-800 rounded flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm text-green-400">Processing complete! Your data is ready.</span>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 text-gray-400 hover:text-white disabled:opacity-50"
            >
              {isProcessingData ? 'Close (processing continues)' : 'Cancel'}
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || isBusy}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isUploading ? 'Uploading...' : isProcessingData ? 'Processing...' : 'Upload'}
            </button>
          </div>

          {/* Info */}
          <div className="mt-4 p-3 bg-blue-900/20 border border-blue-800 rounded">
            <p className="text-sm text-blue-400">
              <strong>Note:</strong> After uploading, your file will be processed automatically.
              This may take a few moments depending on the file size. You'll be notified when
              processing is complete.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}