/**
 * Session Manager Hook
 * Handles automatic logout on idle timeout and browser/tab close
 *
 * Also enforces maximum session duration using localStorage timestamps
 * to handle cases where Cognito refresh tokens keep the session alive
 * longer than desired (e.g., 30 days by default).
 */

import { useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface SessionManagerOptions {
  idleTimeoutMinutes?: number      // Default: 30 minutes
  logoutOnClose?: boolean          // Default: true
  maxSessionHours?: number         // Default: 12 hours - max time before forced re-login
}

const DEFAULT_IDLE_TIMEOUT = 30 * 60 * 1000 // 30 minutes in milliseconds
const LAST_ACTIVITY_KEY = 'tiltedtrades_last_activity'
const SESSION_START_KEY = 'tiltedtrades_session_start'

export const useSessionManager = (options: SessionManagerOptions = {}) => {
  const { isAuthenticated, signOut } = useAuth()
  const {
    idleTimeoutMinutes = 30,
    logoutOnClose = true,
    maxSessionHours = 12  // Force re-login after 12 hours of inactivity
  } = options

  const idleTimeout = idleTimeoutMinutes * 60 * 1000
  const maxSessionMs = maxSessionHours * 60 * 60 * 1000
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isSigningOut = useRef(false)

  // Handle sign out with cache clear
  const handleSignOut = useCallback(async (reason: string) => {
    if (isSigningOut.current || !isAuthenticated) return

    isSigningOut.current = true
    console.log(`Session ended: ${reason}`)

    // Clear session timestamps
    localStorage.removeItem(LAST_ACTIVITY_KEY)
    localStorage.removeItem(SESSION_START_KEY)

    try {
      await signOut()
    } catch (error) {
      console.error('Error during auto sign out:', error)
    } finally {
      isSigningOut.current = false
    }
  }, [isAuthenticated, signOut])

  // Update last activity timestamp
  const updateLastActivity = useCallback(() => {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString())
  }, [])

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
        updateLastActivity()  // Persist to localStorage for cross-session tracking
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
  }, [isAuthenticated, idleTimeout, resetIdleTimer, updateLastActivity])

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

  // Check maximum session duration on mount and periodically
  // This handles the case where Cognito refresh tokens keep the session alive
  // longer than desired (e.g., 30 days by default)
  useEffect(() => {
    if (!isAuthenticated || maxSessionMs <= 0) return

    const checkSessionExpiry = () => {
      const lastActivityStr = localStorage.getItem(LAST_ACTIVITY_KEY)
      const sessionStartStr = localStorage.getItem(SESSION_START_KEY)
      const now = Date.now()

      // If no session start, this is a new session - initialize it
      if (!sessionStartStr) {
        localStorage.setItem(SESSION_START_KEY, now.toString())
        localStorage.setItem(LAST_ACTIVITY_KEY, now.toString())
        return
      }

      // Check if last activity exceeds max session duration
      if (lastActivityStr) {
        const lastActivity = parseInt(lastActivityStr, 10)
        const timeSinceActivity = now - lastActivity

        if (timeSinceActivity > maxSessionMs) {
          console.log(`Session expired: ${Math.round(timeSinceActivity / 1000 / 60 / 60)} hours since last activity (max: ${maxSessionHours} hours)`)
          handleSignOut('session expired (max duration exceeded)')
          return
        }
      }

      // Also check absolute session start time (prevent sessions from lasting forever with activity)
      const sessionStart = parseInt(sessionStartStr, 10)
      const sessionDuration = now - sessionStart
      const maxAbsoluteSessionMs = maxSessionMs * 2 // Allow 2x max session if actively used

      if (sessionDuration > maxAbsoluteSessionMs) {
        console.log(`Session expired: ${Math.round(sessionDuration / 1000 / 60 / 60)} hours since session start (max: ${maxSessionHours * 2} hours)`)
        handleSignOut('session expired (absolute max duration exceeded)')
        return
      }
    }

    // Check immediately on mount
    checkSessionExpiry()

    // Also check periodically (every 5 minutes) in case user leaves tab open
    const intervalId = setInterval(checkSessionExpiry, 5 * 60 * 1000)

    return () => {
      clearInterval(intervalId)
    }
  }, [isAuthenticated, maxSessionMs, maxSessionHours, handleSignOut])

  return {
    resetIdleTimer
  }
}

export default useSessionManager
