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

interface SessionManagerOptions {
  idleTimeoutMinutes?: number      // Default: 30 minutes
  logoutOnClose?: boolean          // Default: true
  maxSessionHours?: number         // Default: 12 hours - max time before forced re-login
}

const LAST_ACTIVITY_KEY = 'tiltedtrades_last_activity'
const SESSION_START_KEY = 'tiltedtrades_session_start'
const BROWSER_SESSION_STORAGE_KEY = 'tiltedtrades_browser_session_marker'

/**
 * Check if this is a new browser session (browser was closed and reopened)
 * This runs synchronously before React to catch the state early
 *
 * IMPORTANT: We need to distinguish between:
 * 1. Browser close + reopen (should logout) - sessionStorage is empty AND no navigation type
 * 2. Page refresh (should NOT logout) - can use performance.navigation or PerformanceNavigationTiming
 * 3. Normal navigation (should NOT logout) - sessionStorage marker exists
 */
function checkBrowserSessionOnLoad(): boolean {
  const sessionMarker = sessionStorage.getItem(BROWSER_SESSION_STORAGE_KEY)
  const hasLocalStorageSession = localStorage.getItem(SESSION_START_KEY) !== null

  // If sessionStorage marker exists, this is definitely not a new browser session
  if (sessionMarker) {
    return false
  }

  // Check if this is a page refresh - if so, don't treat it as browser close
  const isPageRefresh = checkIfPageRefresh()

  if (hasLocalStorageSession && !sessionMarker && !isPageRefresh) {
    // localStorage has session data but sessionStorage is empty and not a refresh
    // This means browser was closed and reopened = new browser session
    console.log('Detected new browser session (browser was closed)')
    return true
  }

  // Mark this browser session as active
  sessionStorage.setItem(BROWSER_SESSION_STORAGE_KEY, Date.now().toString())

  return false
}

/**
 * Check if the current page load is a refresh rather than a new navigation
 */
function checkIfPageRefresh(): boolean {
  // Modern browsers: use PerformanceNavigationTiming
  if (typeof performance !== 'undefined' && performance.getEntriesByType) {
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    if (navEntries.length > 0) {
      const navType = navEntries[0].type
      // 'reload' means page refresh, 'navigate' means new navigation, 'back_forward' means history nav
      if (navType === 'reload') {
        console.log('Page refresh detected via PerformanceNavigationTiming')
        return true
      }
    }
  }

  // Fallback for older browsers: use deprecated performance.navigation
  // performance.navigation.type: 0=navigate, 1=reload, 2=back_forward
  if (typeof performance !== 'undefined' && performance.navigation) {
    if (performance.navigation.type === 1) {
      console.log('Page refresh detected via performance.navigation (legacy)')
      return true
    }
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

  return {
    resetIdleTimer
  }
}

export default useSessionManager
