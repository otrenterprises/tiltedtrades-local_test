/**
 * Upload Service
 * Handles file upload operations with presigned URLs to AWS S3
 */

import { apiClient } from './client'
import { PresignedUrlResponse } from '@/types/api/common.types'
import axios from 'axios'

interface UploadFileOptions {
  onProgress?: (progress: number) => void
  onComplete?: () => void
  onError?: (error: Error) => void
}

class UploadService {
  private basePath = '/api/users/:userId/upload'

  /**
   * Get presigned URL for file upload
   */
  async getPresignedUrl(filename: string, fileType: string): Promise<PresignedUrlResponse> {
    return apiClient.post<PresignedUrlResponse>(this.basePath, {
      filename,
      contentType: fileType  // Lambda expects 'contentType', not 'fileType'
    })
  }

  /**
   * Upload file directly to S3 using presigned URL
   * @param contentType - The exact Content-Type used to sign the presigned URL
   */
  async uploadToS3(
    file: File,
    presignedUrl: string,
    contentType: string,
    options?: UploadFileOptions
  ): Promise<void> {
    try {
      // Content-Type MUST match what was used to sign the presigned URL
      await axios.put(presignedUrl, file, {
        headers: {
          'Content-Type': contentType,
        },
        onUploadProgress: (progressEvent) => {
          if (options?.onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
            options.onProgress(progress)
          }
        },
      })

      if (options?.onComplete) {
        options.onComplete()
      }
    } catch (error: any) {
      const uploadError = new Error(error.message || 'Upload failed')
      if (options?.onError) {
        options.onError(uploadError)
      }
      throw uploadError
    }
  }

  /**
   * Complete upload flow: get presigned URL and upload file
   */
  async uploadFile(file: File, options?: UploadFileOptions): Promise<string> {
    try {
      // Validate file
      this.validateFile(file)

      // Get presigned URL - Lambda returns s3Key, not fileId
      const { uploadUrl, s3Key } = await this.getPresignedUrl(file.name, file.type)

      // Upload to S3 - use the same Content-Type that was sent to Lambda
      await this.uploadToS3(file, uploadUrl, file.type, options)

      return s3Key
    } catch (error: any) {
      const uploadError = new Error(`Upload failed: ${error.message}`)
      if (options?.onError) {
        options.onError(uploadError)
      }
      throw uploadError
    }
  }

  /**
   * Validate file before upload
   */
  private validateFile(file: File): void {
    const maxSize = 50 * 1024 * 1024 // 50MB
    const allowedExtensions = ['.xlsx', '.xls', '.csv']

    if (file.size > maxSize) {
      throw new Error('File size exceeds 50MB limit')
    }

    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
    if (!allowedExtensions.includes(extension)) {
      throw new Error(`Invalid file type. Allowed: ${allowedExtensions.join(', ')}`)
    }
  }

  /**
   * Get presigned URL for chart upload
   */
  async getChartUploadUrl(
    tradeId: string,
    chartType: 'uploaded' | 'tradingview',
    fileExtension: string,
    caption?: string
  ): Promise<PresignedUrlResponse> {
    return apiClient.post<PresignedUrlResponse>(
      `/api/users/:userId/trades/${tradeId}/journal/charts`,
      {
        chartType,
        fileExtension,
        caption
      }
    )
  }

  /**
   * Upload chart image
   */
  async uploadChart(
    tradeId: string,
    file: File,
    caption?: string,
    options?: UploadFileOptions
  ): Promise<string> {
    try {
      // Validate image file
      this.validateImageFile(file)

      // Get file extension
      const fileExtension = file.name.substring(file.name.lastIndexOf('.') + 1)

      // Get presigned URL for chart - Lambda returns s3Key
      const { uploadUrl, s3Key } = await this.getChartUploadUrl(
        tradeId,
        'uploaded',
        fileExtension,
        caption
      )

      // Upload to S3 - use the file's actual Content-Type
      await this.uploadToS3(file, uploadUrl, file.type, options)

      return s3Key
    } catch (error: any) {
      throw new Error(`Chart upload failed: ${error.message}`)
    }
  }

  /**
   * Validate image file
   */
  private validateImageFile(file: File): void {
    const maxSize = 10 * 1024 * 1024 // 10MB
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']

    if (file.size > maxSize) {
      throw new Error('Image size exceeds 10MB limit')
    }

    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid image type. Allowed: PNG, JPG, WebP')
    }
  }
}

// Export singleton instance
export const uploadService = new UploadService()

export default uploadService
