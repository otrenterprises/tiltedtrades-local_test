/**
 * Login Form Component
 * Handles user authentication
 */

import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { AuthErrorCode } from '@/types/auth/auth.types'
import { SignInParams } from '@/types/auth/auth.types'

export const LoginForm: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { signIn, isLoading, error, clearError, isAuthenticated, user } = useAuth()
  const [formData, setFormData] = useState<SignInParams>({
    email: '',
    password: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Redirect if already authenticated - handles case where user navigates back to login
  useEffect(() => {
    if (isAuthenticated && user) {
      navigate('/app', { replace: true })
    }
  }, [isAuthenticated, user, navigate])

  // Check for success message from navigation state (e.g., after email verification)
  useEffect(() => {
    const state = location.state as { message?: string } | null
    if (state?.message) {
      setSuccessMessage(state.message)
      // Clear the state so message doesn't persist on refresh
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()

    try {
      await signIn(formData)
      // Reset session markers on successful login (fresh session)
      sessionStorage.setItem('tiltedtrades_browser_session_marker', Date.now().toString())
      localStorage.setItem('tiltedtrades_session_start', Date.now().toString())
      localStorage.setItem('tiltedtrades_last_activity', Date.now().toString())
      navigate('/app', { replace: true })
    } catch (err: any) {
      // Check if user needs to confirm email
      if (err.code === AuthErrorCode.USER_NOT_CONFIRMED) {
        navigate(`/confirm-signup?email=${encodeURIComponent(formData.email)}`)
      }
      // Error is handled by context
      console.error('Sign in error:', err)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-primary px-4">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Sign in to TiltedTrades
          </h2>
          <p className="mt-2 text-center text-sm text-tertiary">
            Access your trading journal and analytics
          </p>
        </div>

        <form
          className="mt-8 space-y-6"
          onSubmit={handleSubmit}
          method="post"
          action="/login"
          autoComplete="on"
        >
          {successMessage && (
            <div className="rounded-md bg-green-900/20 border border-green-800 p-4">
              <p className="text-sm text-green-400">{successMessage}</p>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-900/20 border border-red-800 p-4">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-secondary">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="username email"
                required
                value={formData.email}
                onChange={handleChange}
                className="mt-1 appearance-none relative block w-full px-3 py-2 border border-theme bg-secondary text-white placeholder-gray-500 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-secondary">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="appearance-none relative block w-full px-3 py-2 border border-theme bg-secondary text-white placeholder-gray-500 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm pr-10"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <span className="text-tertiary hover:text-secondary">
                    {showPassword ? 'Hide' : 'Show'}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 bg-secondary border-theme rounded text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-secondary">
                Remember me
              </label>
            </div>

            <div className="text-sm">
              <Link to="/forgot-password" className="font-medium text-blue-400 hover:text-blue-300">
                Forgot your password?
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span>Signing in...</span>
              ) : (
                <span>Sign in</span>
              )}
            </button>
          </div>

          <div className="text-center">
            <span className="text-sm text-tertiary">
              Don't have an account?{' '}
              <Link to="/signup" className="font-medium text-blue-400 hover:text-blue-300">
                Sign up
              </Link>
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}