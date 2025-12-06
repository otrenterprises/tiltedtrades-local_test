/**
 * Forgot Password Page
 * Handles password reset request
 */

import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner'

export const ForgotPassword: React.FC = () => {
  const navigate = useNavigate()
  const { resetPassword, isLoading, error, clearError } = useAuth()

  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    clearError()
  }, [clearError])

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    if (!email) {
      setLocalError('Please enter your email address')
      return
    }

    if (!validateEmail(email)) {
      setLocalError('Please enter a valid email address')
      return
    }

    try {
      await resetPassword({ email })
      setSubmitted(true)
    } catch (err: any) {
      // Error is handled by context
    }
  }

  const handleContinue = () => {
    navigate(`/reset-password?email=${encodeURIComponent(email)}`)
  }

  const displayError = localError || error

  // Success state after email sent
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary px-4">
        <div className="max-w-md w-full">
          <div className="bg-secondary rounded-lg shadow-xl p-8">
            <div className="text-center">
              {/* Success Icon */}
              <div className="mx-auto w-16 h-16 bg-green-900/50 rounded-full flex items-center justify-center mb-6">
                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>

              <h2 className="text-2xl font-bold text-primary mb-2">Check Your Email</h2>
              <p className="text-tertiary mb-6">
                We've sent a password reset code to <span className="text-primary font-medium">{email}</span>
              </p>

              <button
                onClick={handleContinue}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
              >
                Enter Reset Code
              </button>

              <div className="mt-4">
                <button
                  onClick={() => setSubmitted(false)}
                  className="text-tertiary hover:text-primary text-sm transition-colors"
                >
                  Didn't receive an email? Try again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary px-4">
      <div className="max-w-md w-full">
        <div className="bg-secondary rounded-lg shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-primary">Forgot Password?</h2>
            <p className="text-tertiary mt-2">
              Enter your email address and we'll send you a reset code
            </p>
          </div>

          {/* Error Display */}
          {displayError && (
            <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg">
              <p className="text-red-400 text-sm">{displayError}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-secondary mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-tertiary border border-theme rounded-lg text-primary placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your email"
                disabled={isLoading}
                autoFocus
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !email}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner />
                  <span className="ml-2">Sending...</span>
                </>
              ) : (
                'Send Reset Code'
              )}
            </button>
          </form>

          {/* Back to Login */}
          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-tertiary hover:text-primary text-sm transition-colors"
            >
              &larr; Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword
