/**
 * Authentication Context
 * Provides authentication state and methods throughout the application
 */

import React, { createContext, useContext, useEffect, useReducer, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authService } from '@/services/auth/auth.service'
import {
  User,
  AuthState,
  AuthContextValue,
  SignInParams,
  SignUpParams,
  ConfirmSignUpParams,
  ResetPasswordParams,
  ConfirmResetPasswordParams
} from '@/types/auth/auth.types'

// Auth action types
type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SIGN_IN_SUCCESS'; payload: User }
  | { type: 'SIGN_OUT_SUCCESS' }
  | { type: 'CLEAR_ERROR' }

// Initial state
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null
}

// Auth reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: !!action.payload,
        isLoading: false
      }
    case 'SET_ERROR':
      return { ...state, error: action.payload, isLoading: false }
    case 'SIGN_IN_SUCCESS':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null
      }
    case 'SIGN_OUT_SUCCESS':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      }
    case 'CLEAR_ERROR':
      return { ...state, error: null }
    default:
      return state
  }
}

// Create context
const AuthContext = createContext<AuthContextValue | undefined>(undefined)

// Auth provider props
interface AuthProviderProps {
  children: React.ReactNode
}

/**
 * Auth Provider Component
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState)
  const queryClient = useQueryClient()

  // Check for existing session on mount
  useEffect(() => {
    checkAuthState()
  }, [])

  const checkAuthState = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      const isAuth = await authService.isAuthenticated()

      if (isAuth) {
        const user = await authService.getCurrentUser()
        dispatch({ type: 'SET_USER', payload: user })
      } else {
        dispatch({ type: 'SET_USER', payload: null })
      }
    } catch (error) {
      console.error('Failed to check auth state:', error)
      dispatch({ type: 'SET_USER', payload: null })
    }
  }

  const signIn = useCallback(async (params: SignInParams) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      const user = await authService.signIn(params)
      dispatch({ type: 'SIGN_IN_SUCCESS', payload: user })
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message })
      throw error
    }
  }, [])

  const signUp = useCallback(async (params: SignUpParams) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      await authService.signUp(params)
      dispatch({ type: 'SET_LOADING', payload: false })
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message })
      throw error
    }
  }, [])

  const confirmSignUp = useCallback(async (params: ConfirmSignUpParams) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      const user = await authService.confirmSignUp(params)
      dispatch({ type: 'SIGN_IN_SUCCESS', payload: user })
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message })
      throw error
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      await authService.signOut()

      // CRITICAL: Clear all cached data to prevent data leakage between users
      // This removes all queries from the cache and cancels any in-flight requests
      queryClient.clear()

      dispatch({ type: 'SIGN_OUT_SUCCESS' })
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message })
      throw error
    }
  }, [queryClient])

  const resetPassword = useCallback(async (params: ResetPasswordParams) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      await authService.resetPassword(params)
      dispatch({ type: 'SET_LOADING', payload: false })
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message })
      throw error
    }
  }, [])

  const confirmResetPassword = useCallback(async (params: ConfirmResetPasswordParams) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true })
      await authService.confirmResetPassword(params)
      dispatch({ type: 'SET_LOADING', payload: false })
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', payload: error.message })
      throw error
    }
  }, [])

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' })
  }, [])

  const value: AuthContextValue = {
    ...state,
    signIn,
    signUp,
    confirmSignUp,
    signOut,
    resetPassword,
    confirmResetPassword,
    clearError
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook to use auth context
 */
export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
