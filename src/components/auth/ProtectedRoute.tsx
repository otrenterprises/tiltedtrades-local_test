/**
 * Protected Route Component
 * Ensures user is authenticated before accessing protected pages
 */

import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

interface ProtectedRouteProps {
  children: React.ReactNode
  fallbackPath?: string
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  fallbackPath = '/login'
}) => {
  const { isAuthenticated, isLoading } = useAuth()

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-primary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-tertiary">Loading...</p>
        </div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to={fallbackPath} replace />
  }

  // Render protected content
  return <>{children}</>
}

export default ProtectedRoute