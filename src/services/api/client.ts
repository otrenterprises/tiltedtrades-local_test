/**
 * API Client
 * Base Axios instance with interceptors for authentication and error handling
 * Ready for API Gateway integration - just set VITE_API_BASE_URL when needed
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'
import { authService } from '@/services/auth/auth.service'
import config from '@/config/environment'

// API Error class
export class ApiError extends Error {
  status?: number
  code?: string
  details?: any

  constructor(message: string, status?: number, code?: string, details?: any) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: config.api.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        try {
          const token = await authService.getIdToken()
          if (token) {
            config.headers.Authorization = `Bearer ${token}`
          }

          // Replace {userId} in URL with actual user ID
          const user = await authService.getCurrentUser().catch(() => null)
          if (user && config.url) {
            config.url = config.url.replace(':userId', user.userId)
            config.url = config.url.replace('{userId}', user.userId)
          }

          // Safety check: abort if URL still contains userId placeholder (user not authenticated)
          if (config.url && (config.url.includes(':userId') || config.url.includes('{userId}'))) {
            console.warn('API request aborted: userId placeholder not replaced (user not authenticated)')
            return Promise.reject(new ApiError(
              'User not authenticated',
              401,
              'UNAUTHORIZED'
            ))
          }
        } catch (error) {
          console.warn('Failed to add auth token:', error)
        }

        return config
      },
      (error) => {
        return Promise.reject(error)
      }
    )

    // Response interceptor - handle errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

        // Handle 401 - try to refresh token
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          try {
            // Amplify handles token refresh automatically
            const newToken = await authService.getIdToken()
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`
              return this.client(originalRequest)
            }
          } catch (refreshError) {
            // Refresh failed, redirect to login
            if (typeof window !== 'undefined') {
              window.location.href = '/login'
            }
            return Promise.reject(refreshError)
          }
        }

        // Transform error to ApiError
        const apiError = this.handleError(error)
        return Promise.reject(apiError)
      }
    )
  }

  private handleError(error: AxiosError): ApiError {
    if (!error.response) {
      // Network error
      return new ApiError(
        'Network error. Please check your connection.',
        0,
        'NETWORK_ERROR'
      )
    }

    const { status, data } = error.response as any

    // Extract error message from response
    let message = 'An error occurred'
    let code = 'UNKNOWN_ERROR'

    if (data?.error) {
      message = data.error.message || data.error
      code = data.error.code || code
    } else if (data?.message) {
      message = data.message
    }

    // Handle specific status codes
    switch (status) {
      case 400:
        return new ApiError(message || 'Bad request', status, 'BAD_REQUEST', data)
      case 401:
        return new ApiError(message || 'Unauthorized', status, 'UNAUTHORIZED', data)
      case 403:
        return new ApiError(message || 'Forbidden', status, 'FORBIDDEN', data)
      case 404:
        return new ApiError(message || 'Not found', status, 'NOT_FOUND', data)
      case 429:
        return new ApiError(message || 'Too many requests', status, 'RATE_LIMITED', data)
      case 500:
        return new ApiError(message || 'Internal server error', status, 'SERVER_ERROR', data)
      default:
        return new ApiError(message, status, code, data)
    }
  }

  // HTTP methods
  async get<T>(url: string, params?: any): Promise<T> {
    const response = await this.client.get<T>(url, { params })
    return response.data
  }

  async post<T>(url: string, data?: any, config?: any): Promise<T> {
    const response = await this.client.post<T>(url, data, config)
    return response.data
  }

  async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.put<T>(url, data)
    return response.data
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url)
    return response.data
  }

  async patch<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.patch<T>(url, data)
    return response.data
  }

  // Get raw axios instance if needed
  getAxiosInstance(): AxiosInstance {
    return this.client
  }
}

// Export singleton instance
export const apiClient = new ApiClient()

export default apiClient
