/**
 * Common API Types
 * Shared types used across API services
 */

export interface PaginatedResponse<T> {
  data: T[]
  nextToken?: string
  hasMore?: boolean
  total?: number
}

export interface ApiResponse<T> {
  data: T
  success?: boolean
  message?: string
}

export interface ApiError {
  error: {
    code: string
    message: string
    details?: any
  }
}

export interface QueryParams {
  limit?: number
  nextToken?: string
  startDate?: string
  endDate?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface DateRangeParams {
  startDate: string | Date
  endDate: string | Date
}

export type CalculationMethod = 'fifo' | 'perPosition'

export interface PresignedUrlResponse {
  uploadUrl: string
  s3Key: string       // S3 object key for the uploaded file
  bucket: string      // S3 bucket name
  expiresIn: number   // URL expiration time in seconds
}