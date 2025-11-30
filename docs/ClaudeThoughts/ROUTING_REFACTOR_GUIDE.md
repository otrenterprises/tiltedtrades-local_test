# React Routing Analysis & Refactoring Guide

**Generated:** November 29, 2025  
**File:** `src/App.tsx`  
**Purpose:** Actionable recommendations for Claude Code to improve routing structure

---

## Executive Summary

The current routing implementation is **functional and follows React Router v6 patterns correctly**. However, there are several cleanup opportunities and one inconsistency that should be addressed. This document provides specific, line-by-line guidance for refactoring.

**Priority Level:** Low-Medium (no bugs, just cleanup)

---

## Current Route Structure

```
PUBLIC ROUTES (no auth required)
├── /                      → AuthCheck component (redirects based on auth state)
├── /landing               → Landing page
├── /login                 → LoginForm
├── /signup                → SignupForm
├── /confirm-signup        → ConfirmSignUp
├── /forgot-password       → ForgotPassword
├── /reset-password        → ResetPassword
└── /*                     → Redirects to /

PROTECTED ROUTES (requires authentication)
└── /app/*                 → ProtectedRoute wrapper
    ├── /app               → DashboardNew (calculationMethod prop)
    ├── /app/trades        → TradeLog (calculationMethod prop)
    ├── /app/trades/:tradeId/journal → JournalEditor
    ├── /app/balance       → Balance
    ├── /app/journals      → JournalList
    ├── /app/journal/:tradeId → TradeDetail  ⚠️ INCONSISTENT
    ├── /app/analytics     → AnalyticsAPI (calculationMethod prop)
    ├── /app/calendar      → CalendarNew
    ├── /app/settings      → Settings
    └── /app/*             → Redirects to /app

DISABLED ROUTES (commented out)
    ├── /app/leaderboard   → Leaderboard
    └── /app/profile/:userId → PublicProfile
```

---

## Issue #1: Dead Code Block (HIGH PRIORITY)

### Location
`src/App.tsx` lines 56-83

### Problem
```typescript
// Lines 56-58: These are hardcoded and never change
const isLandingDomain = false
const isAppDomain = true

// Lines 60-83: This entire block NEVER executes
if (isLandingDomain && !isAppDomain) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="*" element={<Landing />} />
        </Routes>
        <Toaster ... />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

### Why It's Dead Code
- `isLandingDomain` is always `false`
- `isAppDomain` is always `true`  
- The condition `false && !true` = `false && false` = `false`
- This block was likely for a multi-subdomain setup (e.g., `www.tiltedtrader.com` vs `app.tiltedtrader.com`) that was never implemented or was removed

### Action Required
**DELETE lines 56-83 entirely.**

### Refactored Code
```typescript
function App() {
  const [calculationMethod, setCalculationMethod] = useState<CalculationMethod>('fifo')

  // DELETE: Lines 56-83 (dead landing domain code)
  
  // Keep everything from line 85 onwards
  return (
    <QueryClientProvider client={queryClient}>
      ...
    </QueryClientProvider>
  )
}
```

---

## Issue #2: Inconsistent Journal Route Naming (MEDIUM PRIORITY)

### Location
`src/App.tsx` lines 116-118

### Problem
```typescript
// Line 116: Nested under /trades with "journal" singular
<Route path="/trades/:tradeId/journal" element={<JournalEditor />} />

// Line 117: Top-level with "journal" singular  
<Route path="/journal/:tradeId" element={<TradeDetail />} />

// Line 118: Top-level with "journals" plural
<Route path="/journals" element={<JournalList />} />
```

### Why It's Confusing
| Current Route | Component | Naming Issue |
|--------------|-----------|--------------|
| `/app/journals` | JournalList | ✅ Plural (list) |
| `/app/journal/:tradeId` | TradeDetail | ❌ Singular (should be plural) |
| `/app/trades/:tradeId/journal` | JournalEditor | ❌ Nested under trades |

A user navigating would expect:
- `/journals` → list of journals
- `/journals/123` → view journal for trade 123
- `/journals/123/edit` → edit that journal

### Action Required
**Rename routes for consistency.**

### Refactored Code
```typescript
// BEFORE (lines 116-118):
<Route path="/trades/:tradeId/journal" element={<JournalEditor />} />
<Route path="/journal/:tradeId" element={<TradeDetail />} />
<Route path="/journals" element={<JournalList />} />

// AFTER:
<Route path="/journals" element={<JournalList />} />
<Route path="/journals/:tradeId" element={<TradeDetail />} />
<Route path="/journals/:tradeId/edit" element={<JournalEditor />} />
```

### Files That Need Link Updates
After changing routes, update navigation links in these files:

| File | What to Change |
|------|----------------|
| `src/pages/TradeLog/TradeLog.tsx` | Links to journal editor |
| `src/pages/Journal/JournalList.tsx` | Links to trade detail |
| `src/components/layout/Navigation.tsx` | Sidebar links (if any) |

**Search for these patterns:**
```bash
grep -r "journal/:tradeId" src/
grep -r "/trades/:tradeId/journal" src/
grep -r "to=\"/app/journal" src/
```

---

## Issue #3: Props Drilling for calculationMethod (LOW PRIORITY)

### Location
`src/App.tsx` lines 54, 108-109, 113-114, 119

### Current Implementation
```typescript
// Line 54: State lives in App component
const [calculationMethod, setCalculationMethod] = useState<CalculationMethod>('fifo')

// Lines 108-109: Passed to Navigation
<Navigation
  calculationMethod={calculationMethod}
  onCalculationMethodChange={setCalculationMethod}
/>

// Lines 113, 114, 119: Passed to page components
<Route path="/" element={<DashboardNew calculationMethod={calculationMethod} />} />
<Route path="/trades" element={<TradeLog calculationMethod={calculationMethod} />} />
<Route path="/analytics" element={<AnalyticsAPI calculationMethod={calculationMethod} />} />
```

### Why It's Suboptimal
- State is lifted to App.tsx unnecessarily
- Props drilled through multiple components
- Project already uses Zustand for NavigationContext
- Adding more pages that need this prop requires modifying App.tsx

### Action Required (Optional)
**Move to Zustand store or dedicated context.**

### Option A: Add to Existing NavigationContext
```typescript
// src/contexts/NavigationContext.tsx
interface NavigationState {
  // existing state...
  calculationMethod: 'fifo' | 'perPosition'
  setCalculationMethod: (method: 'fifo' | 'perPosition') => void
}
```

### Option B: Create Dedicated Store
```typescript
// src/stores/calculationStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface CalculationStore {
  method: 'fifo' | 'perPosition'
  setMethod: (method: 'fifo' | 'perPosition') => void
}

export const useCalculationStore = create<CalculationStore>()(
  persist(
    (set) => ({
      method: 'fifo',
      setMethod: (method) => set({ method }),
    }),
    { name: 'calculation-method' }  // Persists to localStorage
  )
)
```

### Usage After Refactor
```typescript
// In any component:
import { useCalculationStore } from '@/stores/calculationStore'

function DashboardNew() {
  const { method, setMethod } = useCalculationStore()
  // ...
}
```

### Benefits
- No prop drilling
- Persists user preference across sessions
- Any component can access without prop chain
- Cleaner App.tsx

---

## Issue #4: Toaster Placement (COSMETIC)

### Location
`src/App.tsx` lines 142-152

### Current Implementation
```typescript
<div className="min-h-screen" style={{ backgroundColor: '#0F172A' }}>
  <Routes>...</Routes>
</div>
  <Toaster ... />  {/* Outside the div, inconsistent indentation */}
```

### Action Required
**Move Toaster inside the div for proper DOM hierarchy.**

```typescript
<div className="min-h-screen" style={{ backgroundColor: '#0F172A' }}>
  <Routes>...</Routes>
  <Toaster
    position="top-right"
    toastOptions={{
      duration: 4000,
      style: {
        background: '#1F2937',
        color: '#F3F4F6',
        border: '1px solid #374151',
      },
    }}
  />
</div>
```

---

## Complete Refactored App.tsx

Here is the complete refactored file with all issues addressed:

```typescript
import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'

// Contexts
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { NavigationProvider } from '@/contexts/NavigationContext'

// Components
import { Navigation } from './components/layout/Navigation'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { LoginForm } from './components/auth/LoginForm'
import { SignupForm } from './components/auth/SignupForm'

// Pages
import Landing from './pages/Landing'
import { DashboardNew } from './pages/Dashboard/DashboardNew'
import { TradeLog } from './pages/TradeLog/TradeLog'
import { Balance } from './pages/Balance/Balance'
import { AnalyticsAPI } from './pages/Analytics/AnalyticsAPI'
import { CalendarNew } from './pages/Calendar/CalendarNew'
import { JournalList } from './pages/Journal/JournalList'
import { JournalEditor } from './pages/Journal/JournalEditor'
import { TradeDetail } from './pages/Journal/TradeDetail'
import Settings from './pages/Settings/Settings'

// Auth pages
import { ConfirmSignUp } from './pages/Auth/ConfirmSignUp'
import { ForgotPassword } from './pages/Auth/ForgotPassword'
import { ResetPassword } from './pages/Auth/ResetPassword'

// Hooks
import { useSessionManager } from './hooks/useSessionManager'

// Types
import { CalculationMethod } from './utils/calculations/tradeMatching'

// React Query client configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
})

function App() {
  const [calculationMethod, setCalculationMethod] = useState<CalculationMethod>('fifo')

  // REMOVED: Dead landing domain code (was lines 56-83)

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NavigationProvider>
          <BrowserRouter>
            <div className="min-h-screen" style={{ backgroundColor: '#0F172A' }}>
              <Routes>
                {/* Public Routes */}
                <Route path="/landing" element={<Landing />} />
                <Route path="/login" element={<LoginForm />} />
                <Route path="/signup" element={<SignupForm />} />
                <Route path="/confirm-signup" element={<ConfirmSignUp />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />

                {/* Protected App Routes */}
                <Route
                  path="/app/*"
                  element={
                    <ProtectedRoute>
                      <SessionManager>
                        <Navigation
                          calculationMethod={calculationMethod}
                          onCalculationMethodChange={setCalculationMethod}
                        />
                        <Routes>
                          <Route path="/" element={<DashboardNew calculationMethod={calculationMethod} />} />
                          <Route path="/trades" element={<TradeLog calculationMethod={calculationMethod} />} />
                          <Route path="/balance" element={<Balance />} />
                          
                          {/* FIXED: Consistent journal routes */}
                          <Route path="/journals" element={<JournalList />} />
                          <Route path="/journals/:tradeId" element={<TradeDetail />} />
                          <Route path="/journals/:tradeId/edit" element={<JournalEditor />} />
                          
                          <Route path="/analytics" element={<AnalyticsAPI calculationMethod={calculationMethod} />} />
                          <Route path="/calendar" element={<CalendarNew />} />
                          <Route path="/settings" element={<Settings />} />
                          
                          {/* Disabled routes for future multi-user feature */}
                          {/* <Route path="/leaderboard" element={<Leaderboard />} /> */}
                          {/* <Route path="/profile/:userId" element={<PublicProfile />} /> */}
                          
                          <Route path="*" element={<Navigate to="/app" replace />} />
                        </Routes>
                      </SessionManager>
                    </ProtectedRoute>
                  }
                />

                {/* Default redirect based on auth status */}
                <Route path="/" element={<AuthCheck />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              
              {/* FIXED: Toaster inside main div */}
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#1F2937',
                    color: '#F3F4F6',
                    border: '1px solid #374151',
                  },
                }}
              />
            </div>
          </BrowserRouter>
        </NavigationProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

// Component to check auth and redirect accordingly
function AuthCheck() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-400">Loading...</p>
        </div>
      </div>
    )
  }

  return isAuthenticated ? <Navigate to="/app" replace /> : <Navigate to="/landing" replace />
}

// Session manager component
function SessionManager({ children }: { children: React.ReactNode }) {
  useSessionManager({
    idleTimeoutMinutes: 30,
    logoutOnClose: true
  })

  return <>{children}</>
}

export default App
```

---

## Files Requiring Updates After Route Changes

If implementing the journal route consistency fix, these files need link updates:

### 1. TradeLog.tsx
```typescript
// Find links like:
navigate(`/app/trades/${tradeId}/journal`)
// Change to:
navigate(`/app/journals/${tradeId}/edit`)
```

### 2. JournalList.tsx
```typescript
// Find links like:
navigate(`/app/journal/${tradeId}`)
// Change to:
navigate(`/app/journals/${tradeId}`)
```

### 3. JournalEditor.tsx
```typescript
// Find navigation after save:
navigate(`/app/journal/${tradeId}`)
// Change to:
navigate(`/app/journals/${tradeId}`)
```

### 4. Navigation.tsx
```typescript
// Check sidebar links point to correct routes
```

---

## Summary Checklist

| Task | Priority | Effort | Status |
|------|----------|--------|--------|
| Delete dead landing domain code (lines 56-83) | HIGH | 5 min | ⬜ TODO |
| Fix journal route naming consistency | MEDIUM | 15 min | ⬜ TODO |
| Move Toaster inside main div | LOW | 2 min | ⬜ TODO |
| Move calculationMethod to Zustand | LOW | 30 min | ⬜ OPTIONAL |

---

## Testing After Changes

After applying these changes, verify:

1. **Auth flow works:**
   - Visit `/` → should redirect to `/landing` or `/app`
   - Login → should redirect to `/app`
   - Logout → should redirect to `/landing`

2. **Protected routes work:**
   - Visit `/app/trades` while logged out → should redirect to `/login`
   - Visit `/app/trades` while logged in → should show TradeLog

3. **Journal navigation works:**
   - `/app/journals` → shows JournalList
   - Click a journal → goes to `/app/journals/:tradeId`
   - Click edit → goes to `/app/journals/:tradeId/edit`
   - Save → returns to `/app/journals/:tradeId`

4. **Calculation method persists:**
   - Toggle FIFO/Per-Position in Navigation
   - Navigate between pages
   - Method should remain selected

---

*Report generated for Claude Code refactoring reference*
