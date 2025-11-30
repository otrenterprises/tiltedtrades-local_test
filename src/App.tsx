import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'

// Contexts - Using real Cognito Auth
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
// import { Leaderboard } from './pages/Leaderboard/Leaderboard' // Commented out for local testing
// import { PublicProfile } from './pages/Profile/PublicProfile' // Commented out for local testing
import Settings from './pages/Settings/Settings'

// Auth pages
import { ConfirmSignUp } from './pages/Auth/ConfirmSignUp'
import { ForgotPassword } from './pages/Auth/ForgotPassword'
import { ResetPassword } from './pages/Auth/ResetPassword'

// Hooks
import { useSessionManager } from './hooks/useSessionManager'

// Types
import { CalculationMethod } from './utils/calculations/tradeMatching'

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (was cacheTime in v4)
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
})

function App() {
  const [calculationMethod, setCalculationMethod] = useState<CalculationMethod>('fifo')

  // For local testing, we'll always use the app domain behavior
  const isLandingDomain = false
  const isAppDomain = true

  // If we're on the landing domain, show the landing page
  if (isLandingDomain && !isAppDomain) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="*" element={<Landing />} />
          </Routes>
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
        </BrowserRouter>
      </QueryClientProvider>
    )
  }

  // If we're on the app domain, show the full application
  // Components now fetch their own data via React Query hooks
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
                        <Route path="/trades/:tradeId/journal" element={<JournalEditor />} />
                        <Route path="/journal/:tradeId" element={<TradeDetail />} />
                        <Route path="/journals" element={<JournalList />} />
                        <Route path="/analytics" element={<AnalyticsAPI calculationMethod={calculationMethod} />} />
                        <Route path="/calendar" element={<CalendarNew />} />
                        {/* Leaderboard routes commented out for local testing (no multi-user) */}
                        {/* <Route path="/leaderboard" element={<Leaderboard />} /> */}
                        {/* <Route path="/profile/:userId" element={<PublicProfile />} /> */}
                        <Route path="/settings" element={<Settings />} />
                        <Route path="*" element={<Navigate to="/app" replace />} />
                      </Routes>
                    </SessionManager>
                  </ProtectedRoute>
                }
              />

              {/* Default redirect based on auth status */}
              <Route
                path="/"
                element={
                  <AuthCheck />
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
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

// Session manager component - handles idle timeout and browser close logout
function SessionManager({ children }: { children: React.ReactNode }) {
  // 30 minute idle timeout, logout on browser/tab close
  useSessionManager({
    idleTimeoutMinutes: 30,
    logoutOnClose: true
  })

  return <>{children}</>
}

export default App
