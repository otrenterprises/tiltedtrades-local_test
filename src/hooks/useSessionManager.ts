/**
 * Session Manager Hook
 * Handles automatic logout on idle timeout and browser/tab close
 */

import { useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface SessionManagerOptions {
  idleTimeoutMinutes?: number  // Default: 30 minutes
  logoutOnClose?: boolean      // Default: true
}

const DEFAULT_IDLE_TIMEOUT = 30 * 60 * 1000 // 30 minutes in milliseconds

export const useSessionManager = (options: SessionManagerOptions = {}) => {
  const { isAuthenticated, signOut } = useAuth()
  const {
    idleTimeoutMinutes = 30,
    logoutOnClose = true
  } = options

  const idleTimeout = idleTimeoutMinutes * 60 * 1000
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isSigningOut = useRef(false)

  // Handle sign out with cache clear
  const handleSignOut = useCallback(async (reason: string) => {
    if (isSigningOut.current || !isAuthenticated) return

    isSigningOut.current = true
    console.log(`Session ended: ${reason}`)

    try {
      await signOut()
    } catch (error) {
      console.error('Error during auto sign out:', error)
    } finally {
      isSigningOut.current = false
    }
  }, [isAuthenticated, signOut])

  // Reset idle timer on user activity
  const resetIdleTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    if (isAuthenticated && idleTimeout > 0) {
      timeoutRef.current = setTimeout(() => {
        handleSignOut('idle timeout')
      }, idleTimeout)
    }
  }, [isAuthenticated, idleTimeout, handleSignOut])

  // Set up idle timeout listener
  useEffect(() => {
    if (!isAuthenticated || idleTimeout <= 0) return

    // Events that indicate user activity
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'wheel'
    ]

    // Throttle activity detection to avoid performance issues
    let lastActivity = Date.now()
    const throttleMs = 1000 // Only check once per second

    const handleActivity = () => {
      const now = Date.now()
      if (now - lastActivity > throttleMs) {
        lastActivity = now
        resetIdleTimer()
      }
    }

    // Add activity listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    // Start initial timer
    resetIdleTimer()

    return () => {
      // Clean up listeners
      activityEvents.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isAuthenticated, idleTimeout, resetIdleTimer])

  // Set up browser/tab close listener
  useEffect(() => {
    if (!isAuthenticated || !logoutOnClose) return

    // Mark session as temporary (will be cleared on close)
    const SESSION_KEY = 'tiltedtrades_session_active'
    sessionStorage.setItem(SESSION_KEY, 'true')

    // Check on page load if this is a fresh browser session
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // User is leaving - mark the time
        sessionStorage.setItem('tiltedtrades_last_hidden', Date.now().toString())
      }
    }

    // Handle beforeunload - this fires when tab/browser closes
    const handleBeforeUnload = () => {
      // Set a flag that we're closing
      sessionStorage.setItem('tiltedtrades_closing', 'true')
    }

    // Handle page hide (more reliable on mobile)
    const handlePageHide = (event: PageTransitionEvent) => {
      if (!event.persisted) {
        // Page is being discarded, not just hidden
        // Note: We can't do async operations here reliably
        // The actual cleanup happens on next page load
        sessionStorage.setItem('tiltedtrades_should_logout', 'true')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handlePageHide)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handlePageHide)
    }
  }, [isAuthenticated, logoutOnClose])

  // Check on mount if we should log out (browser was closed)
  useEffect(() => {
    if (!logoutOnClose) return

    const shouldLogout = sessionStorage.getItem('tiltedtrades_should_logout')
    const sessionActive = sessionStorage.getItem('tiltedtrades_session_active')

    // Clean up flags
    sessionStorage.removeItem('tiltedtrades_should_logout')
    sessionStorage.removeItem('tiltedtrades_closing')
    sessionStorage.removeItem('tiltedtrades_last_hidden')

    // If there's no active session marker but we're authenticated,
    // this is a new browser session - log out
    if (isAuthenticated && !sessionActive && !shouldLogout) {
      // This is a new browser session (browser was closed and reopened)
      // or localStorage persisted but sessionStorage didn't
      handleSignOut('browser session ended')
    }
  }, [isAuthenticated, logoutOnClose, handleSignOut])

  return {
    resetIdleTimer
  }
}

export default useSessionManager
