/**
 * File Upload Modal Component
 * Handles file upload with progress tracking and validation
 */

import React, { useState, useCallback } from 'react'
import { uploadService } from '@/services/api/upload.service'
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
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)

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

    setIsUploading(true)
    setUploadProgress(0)

    try {
      const fileId = await uploadService.uploadFile(file, {
        onProgress: (progress) => {
          setUploadProgress(progress)
        },
        onComplete: () => {
          toast.success('File uploaded successfully! Processing will begin shortly.')
          setUploadProgress(100)

          // Reset after a delay
          setTimeout(() => {
            setFile(null)
            setUploadProgress(0)
            setIsUploading(false)
            onSuccess?.()
            onClose()
          }, 1500)
        },
        onError: (error) => {
          toast.error(`Upload failed: ${error.message}`)
          setIsUploading(false)
          setUploadProgress(0)
        }
      })

      console.log('File uploaded with ID:', fileId)
    } catch (error: any) {
      toast.error(error.message || 'Upload failed')
      setIsUploading(false)
      setUploadProgress(0)
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
        <div className="relative bg-secondary rounded-lg shadow-xl max-w-md w-full p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-white">Upload Trading Data</h3>
            <button
              onClick={onClose}
              disabled={isUploading}
              className="text-tertiary hover:text-white disabled:opacity-50"
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
                : 'border-theme hover:border-theme'
            } ${isUploading ? 'pointer-events-none opacity-50' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {!file ? (
              <>
                <svg
                  className="mx-auto h-12 w-12 text-tertiary mb-4"
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
                      disabled={isUploading}
                    />
                  </label>
                </p>
                <p className="text-sm text-tertiary">
                  Supported formats: Excel (.xlsx, .xls) or CSV
                </p>
                <p className="text-sm text-tertiary">Maximum file size: 50MB</p>
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
                  <p className="text-sm text-tertiary">{formatFileSize(file.size)}</p>
                </div>
                {!isUploading && (
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

          {/* Progress Bar */}
          {isUploading && (
            <div className="mt-4">
              <div className="flex justify-between text-sm text-tertiary mb-1">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-tertiary rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex justify-end space-x-3">
            <button
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 text-tertiary hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isUploading ? 'Uploading...' : 'Upload'}
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