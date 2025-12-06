/**
 * Chart Gallery Component
 * Display and manage chart images for trade journals
 */

import React, { useState } from 'react'
import { useUploadChart, useDeleteChart } from '../../hooks/useJournal'
import { ChartReference } from '@/types/api/journal.types'
import { formatBytes } from '../../utils/formatting'
import { toast } from 'react-hot-toast'
import { config } from '@/config/environment'

interface ChartGalleryProps {
  userId: string
  tradeId: string
  charts: ChartReference[]
}

export const ChartGallery: React.FC<ChartGalleryProps> = ({
  userId,
  tradeId,
  charts
}) => {
  const [showUpload, setShowUpload] = useState(false)
  const [selectedChart, setSelectedChart] = useState<ChartReference | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadDescription, setUploadDescription] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const uploadChart = useUploadChart()
  const deleteChart = useDeleteChart()

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
      if (!allowedTypes.includes(file.type)) {
        toast.error('Please select a valid image file (JPEG, PNG, GIF, or WebP)')
        return
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB')
        return
      }

      setUploadFile(file)
    }
  }

  // Handle upload
  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error('Please select a file to upload')
      return
    }

    try {
      await uploadChart.mutateAsync({
        userId,
        tradeId,
        file: uploadFile,
        description: uploadDescription || undefined
      })

      // Reset upload form
      setUploadFile(null)
      setUploadDescription('')
      setShowUpload(false)
    } catch (error) {
      // Error is handled by the mutation
    }
  }

  // Handle delete
  const handleDelete = async (chartId: string) => {
    try {
      await deleteChart.mutateAsync({ userId, tradeId, chartId })
      setDeleteConfirmId(null)
      if (selectedChart?.chartId === chartId) {
        setSelectedChart(null)
      }
    } catch (error) {
      // Error is handled by the mutation
    }
  }

  // Get chart URL (from S3 or direct URL)
  const getChartUrl = (chart: ChartReference) => {
    // If we have a direct URL, use it
    if (chart.url) {
      return chart.url
    }
    // Otherwise construct CDN URL
    if (chart.s3Key) {
      return `https://cdn.tiltedtrades.com/${chart.s3Key}`
    }
    return ''
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-white">Trade Charts</h2>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition"
        >
          {showUpload ? 'Cancel' : 'Add Chart'}
        </button>
      </div>

      {/* Upload Form */}
      {showUpload && (
        <div className="mb-6 p-4 bg-gray-700 rounded-lg">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Chart Image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-600 file:text-white hover:file:bg-gray-500"
            />
            {uploadFile && (
              <p className="mt-2 text-sm text-gray-400">
                Selected: {uploadFile.name} ({formatBytes(uploadFile.size)})
              </p>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description (Optional)
            </label>
            <input
              type="text"
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              placeholder="e.g., Entry setup, Exit execution, Support levels..."
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg border border-gray-500 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={() => {
                setShowUpload(false)
                setUploadFile(null)
                setUploadDescription('')
              }}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!uploadFile || uploadChart.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm disabled:opacity-50"
            >
              {uploadChart.isPending ? 'Uploading...' : 'Upload Chart'}
            </button>
          </div>
        </div>
      )}

      {/* Chart Grid */}
      {charts.length === 0 ? (
        <div className="text-center py-8">
          <svg
            className="mx-auto h-12 w-12 text-gray-500 mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-gray-400">No charts uploaded yet</p>
          <p className="text-sm text-gray-500">Add charts to document your trade visually</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {charts.map((chart) => (
            <div
              key={chart.chartId}
              className="relative group cursor-pointer"
              onClick={() => setSelectedChart(chart)}
            >
              <img
                src={getChartUrl(chart)}
                alt={chart.caption || 'Trade chart'}
                className="w-full h-32 object-cover rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEyOCIgdmlld0JveD0iMCAwIDIwMCAxMjgiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTI4IiBmaWxsPSIjMTExODI3Ii8+CjxwYXRoIGQ9Ik04MCA2NEw2MCA4NEw0MCA2NCIgc3Ryb2tlPSIjMzc0MTUxIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8cGF0aCBkPSJNMTIwIDQ0TDEwMCA2NEw4MCA0NCIgc3Ryb2tlPSIjMzc0MTUxIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgo8cGF0aCBkPSJNMTYwIDU0TDE0MCA3NEwxMjAgNTQiIHN0cm9rZT0iIzM3NDE1MSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiLz4KPC9zdmc+'
                }}
              />

              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition rounded-lg flex items-center justify-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteConfirmId(chart.chartId)
                  }}
                  className="opacity-0 group-hover:opacity-100 transition p-2 bg-red-600 hover:bg-red-700 rounded-lg"
                >
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>

              {/* Caption */}
              {chart.caption && (
                <p className="mt-2 text-xs text-gray-400 truncate">
                  {chart.caption}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Full-size Image Modal */}
      {selectedChart && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedChart(null)}
        >
          <div className="max-w-6xl max-h-[90vh] relative">
            <img
              src={getChartUrl(selectedChart)}
              alt={selectedChart.caption || 'Trade chart'}
              className="max-w-full max-h-full object-contain"
            />

            {/* Close button */}
            <button
              onClick={() => setSelectedChart(null)}
              className="absolute top-4 right-4 p-2 bg-gray-800 hover:bg-gray-700 rounded-lg"
            >
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {/* Caption */}
            {selectedChart.caption && (
              <div className="absolute bottom-4 left-4 right-4 bg-gray-900 bg-opacity-80 rounded-lg p-3">
                <p className="text-white text-sm">{selectedChart.caption}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">Delete Chart?</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete this chart? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleteChart.isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
              >
                {deleteChart.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}