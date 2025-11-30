/**
 * Error Message Component
 * Displays error messages with retry option
 */

import React from 'react'

interface ErrorMessageProps {
  title?: string
  message: string
  onRetry?: () => void
  fullScreen?: boolean
  className?: string
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  title = 'Error',
  message,
  onRetry,
  fullScreen = false,
  className = ''
}) => {
  const content = (
    <div className={`text-center ${className}`}>
      <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 max-w-md mx-auto">
        <svg
          className="mx-auto h-12 w-12 text-red-500 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <h3 className="text-lg font-medium text-white mb-2">{title}</h3>
        <p className="text-gray-400 mb-4">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white font-medium transition"
          >
            Try Again
          </button>
        )}
      </div>
    </div>
  )

  if (fullScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        {content}
      </div>
    )
  }

  return content
}

export default ErrorMessage