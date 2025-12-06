/**
 * Confirm Sign Up Page
 * Handles email verification code entry after registration
 */

import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { authService } from '@/services/auth/auth.service'
import { LoadingSpinner } from '@/components/feedback/LoadingSpinner'

export const ConfirmSignUp: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { confirmSignUp, isLoading, error, clearError } = useAuth()

  const [email, setEmail] = useState(searchParams.get('email') || '')
  const [code, setCode] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    clearError()
  }, [clearError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)

    if (!email) {
      setLocalError('Please enter your email address')
      return
    }

    if (!code || code.length < 6) {
      setLocalError('Please enter a valid 6-digit verification code')
      return
    }

    try {
      await confirmSignUp({ email, code })
      navigate('/app')
    } catch (err: any) {
      // If email was verified but autoSignIn expired, redirect to login
      if (err.message?.includes('verified successfully')) {
        navigate('/login', {
          state: { message: 'Email verified! Please sign in with your credentials.' }
        })
        return
      }
      // Other errors are handled by context
    }
  }

  const handleResendCode = async () => {
    if (!email) {
      setLocalError('Please enter your email address')
      return
    }

    setResendLoading(true)
    setResendSuccess(false)
    setLocalError(null)

    try {
      await authService.resendConfirmationCode(email)
      setResendSuccess(true)
      setTimeout(() => setResendSuccess(false), 5000)
    } catch (err: any) {
      setLocalError(err.message || 'Failed to resend code')
    } finally {
      setResendLoading(false)
    }
  }

  const displayError = localError || error

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary px-4">
      <div className="max-w-md w-full">
        <div className="bg-secondary rounded-lg shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-primary">Verify Your Email</h2>
            <p className="text-tertiary mt-2">
              Enter the verification code sent to your email
            </p>
          </div>

          {/* Error Display */}
          {displayError && (
            <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg">
              <p className="text-red-400 text-sm">{displayError}</p>
            </div>
          )}

          {/* Success Display */}
          {resendSuccess && (
            <div className="mb-6 p-4 bg-green-900/50 border border-green-500 rounded-lg">
              <p className="text-green-400 text-sm">Verification code sent! Check your email.</p>
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
              />
            </div>

            {/* Verification Code Field */}
            <div>
              <label htmlFor="code" className="block text-sm font-medium text-secondary mb-2">
                Verification Code
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 bg-tertiary border border-theme rounded-lg text-primary placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-2xl tracking-widest"
                placeholder="000000"
                maxLength={6}
                disabled={isLoading}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !code || code.length < 6}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner />
                  <span className="ml-2">Verifying...</span>
                </>
              ) : (
                'Verify Email'
              )}
            </button>
          </form>

          {/* Resend Code */}
          <div className="mt-6 text-center">
            <p className="text-tertiary text-sm">
              Didn't receive a code?{' '}
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendLoading}
                className="text-blue-400 hover:text-blue-300 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendLoading ? 'Sending...' : 'Resend Code'}
              </button>
            </p>
          </div>

          {/* Back to Login */}
          <div className="mt-4 text-center">
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

export default ConfirmSignUp
