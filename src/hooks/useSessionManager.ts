/**
 * Session Manager Hook
 * Handles automatic logout on idle timeout and browser/tab close
 *
 * Also enforces maximum session duration using localStorage timestamps
 * to handle cases where Cognito refresh tokens keep the session alive
 * longer than desired (e.g., 30 days by default).
 *
 * Browser close detection strategy:
 * - Uses localStorage to track "browser session ID" (random ID per browser session)
 * - On each page load, checks if sessionStorage has the session marker
 * - If localStorage has auth but sessionStorage is empty = new browser session = logout
 * - This runs BEFORE React hydration to catch the state early
 */

import { useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { authService } from '@/services/auth/auth.service'

interface SessionManagerOptions {
  idleTimeoutMinutes?: number      // Default: 30 minutes
  logoutOnClose?: boolean          // Default: true
  maxSessionHours?: number         // Default: 12 hours - max time before forced re-login
}

const LAST_ACTIVITY_KEY = 'tiltedtrades_last_activity'
const SESSION_START_KEY = 'tiltedtrades_session_start'
const BROWSER_SESSION_STORAGE_KEY = 'tiltedtrades_browser_session_marker'
const LAST_VISIBILITY_KEY = 'tiltedtrades_last_visibility'

/**
 * Check if this is a new browser session (browser was closed and reopened)
 * This runs synchronously before React to catch the state early
 */
function checkBrowserSessionOnLoad(): boolean {
  const sessionMarker = sessionStorage.getItem(BROWSER_SESSION_STORAGE_KEY)
  const hasLocalStorageSession = localStorage.getItem(SESSION_START_KEY) !== null

  if (hasLocalStorageSession && !sessionMarker) {
    // localStorage has session data but sessionStorage is empty
    // This means browser was closed and reopened = new browser session
    return true
  }

  // Mark this browser session as active
  if (!sessionMarker) {
    sessionStorage.setItem(BROWSER_SESSION_STORAGE_KEY, Date.now().toString())
  }

  return false
}

// Run the check immediately when this module loads (before React)
const isNewBrowserSession = checkBrowserSessionOnLoad()

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

    // Clear all session timestamps
    localStorage.removeItem(LAST_ACTIVITY_KEY)
    localStorage.removeItem(SESSION_START_KEY)
    localStorage.removeItem(LAST_VISIBILITY_KEY)

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

  // Check on mount if browser was closed and we need to log out
  // Uses the pre-computed isNewBrowserSession value that was checked before React mounted
  const hasHandledBrowserClose = useRef(false)

  useEffect(() => {
    if (!logoutOnClose || hasHandledBrowserClose.current) return

    // If this is a new browser session and user appears authenticated,
    // we need to log them out
    if (isNewBrowserSession && isAuthenticated) {
      hasHandledBrowserClose.current = true
      console.log('Browser was closed - logging out user')

      // Clear session data
      localStorage.removeItem(SESSION_START_KEY)
      localStorage.removeItem(LAST_ACTIVITY_KEY)

      handleSignOut('browser session ended')
    }
  }, [isAuthenticated, logoutOnClose, handleSignOut])

  // Keep sessionStorage marker updated while session is active
  useEffect(() => {
    if (!isAuthenticated || !logoutOnClose) return

    // Ensure browser session marker exists
    if (!sessionStorage.getItem(BROWSER_SESSION_STORAGE_KEY)) {
      sessionStorage.setItem(BROWSER_SESSION_STORAGE_KEY, Date.now().toString())
    }
  }, [isAuthenticated, logoutOnClose])

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

  // Mobile background timeout detection using Page Visibility API
  // Mobile browsers don't truly "close" so sessionStorage detection doesn't work
  // Instead, we track how long the app was in background and log out if too long
  useEffect(() => {
    if (!isAuthenticated) return

    // Use the same timeout as idle timeout for consistency
    const MOBILE_BACKGROUND_TIMEOUT = idleTimeout

    const handleVisibilityChange = () => {
      const now = Date.now()

      if (document.hidden) {
        // Page going to background - record timestamp
        localStorage.setItem(LAST_VISIBILITY_KEY, now.toString())
      } else {
        // Page becoming visible - check how long it was hidden
        const lastVisibility = localStorage.getItem(LAST_VISIBILITY_KEY)
        if (lastVisibility) {
          const hiddenDuration = now - parseInt(lastVisibility, 10)

          // If hidden for longer than timeout, end session
          if (hiddenDuration > MOBILE_BACKGROUND_TIMEOUT) {
            console.log(`Session ended: app was in background for ${Math.round(hiddenDuration / 1000 / 60)} minutes`)
            handleSignOut('mobile background timeout')
            return
          }
        }

        // Page is visible and active - update activity and reset timer
        updateLastActivity()
        resetIdleTimer()
        // Clear visibility timestamp since we're now active
        localStorage.removeItem(LAST_VISIBILITY_KEY)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Also check on mount if we were in background too long (app was suspended)
    const lastVisibility = localStorage.getItem(LAST_VISIBILITY_KEY)
    if (lastVisibility && !document.hidden) {
      const hiddenDuration = Date.now() - parseInt(lastVisibility, 10)
      if (hiddenDuration > MOBILE_BACKGROUND_TIMEOUT) {
        console.log(`Session ended on mount: app was in background for ${Math.round(hiddenDuration / 1000 / 60)} minutes`)
        handleSignOut('mobile background timeout on resume')
      } else {
        // Clear the stale visibility timestamp
        localStorage.removeItem(LAST_VISIBILITY_KEY)
      }
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isAuthenticated, idleTimeout, handleSignOut, updateLastActivity, resetIdleTimer])

  // Periodic session validation - catches server-side token revocation
  // Also validates session on visibility restore for extra security
  useEffect(() => {
    if (!isAuthenticated) return

    const validateSession = async () => {
      try {
        const isValid = await authService.isAuthenticated()
        if (!isValid) {
          console.log('Session validation failed - tokens invalid or expired')
          handleSignOut('session validation failed')
        }
      } catch (error) {
        console.error('Session validation error:', error)
        // Don't sign out on network errors - let the idle/background timeouts handle it
      }
    }

    // Validate every 5 minutes while active
    const intervalId = setInterval(validateSession, 5 * 60 * 1000)

    return () => {
      clearInterval(intervalId)
    }
  }, [isAuthenticated, handleSignOut])

  return {
    resetIdleTimer
  }
}

export default useSessionManager
