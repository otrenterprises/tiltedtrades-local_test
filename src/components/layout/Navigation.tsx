import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { BarChart3, TrendingUp, Calendar, List, BookOpen, Trophy, Settings, Wallet, ChevronLeft, ChevronRight, Upload, LogOut, User, Menu, X, Sun, Moon, Monitor } from 'lucide-react'
import { CalculationMethod } from '@/utils/calculations/tradeMatching'
import { useNavigation } from '@/contexts/NavigationContext'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { FileUploadModal } from '@/components/upload/FileUploadModal'

interface NavigationProps {
  calculationMethod: CalculationMethod
  onCalculationMethodChange: (method: CalculationMethod) => void
  showGrossPL: boolean
  onShowGrossPLChange: (showGross: boolean) => void
}

export function Navigation({ calculationMethod, onCalculationMethodChange, showGrossPL, onShowGrossPLChange }: NavigationProps) {
  const { isExpanded, setIsExpanded } = useNavigation()
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [isClosingMenu, setIsClosingMenu] = useState(false)

  // Swipe-to-close state for mobile bottom sheet
  const [dragStartY, setDragStartY] = useState<number | null>(null)
  const [dragCurrentY, setDragCurrentY] = useState<number | null>(null)
  const dragThreshold = 100 // pixels to drag before closing

  // Handle graceful close animation for bottom sheet
  const handleCloseMenu = () => {
    setIsClosingMenu(true)
    setDragStartY(null)
    setDragCurrentY(null)
    setTimeout(() => {
      setShowMobileMenu(false)
      setIsClosingMenu(false)
    }, 300) // Match animation duration
  }

  // Touch handlers for swipe-to-close (header area only)
  const handleTouchStart = (e: React.TouchEvent) => {
    setDragStartY(e.touches[0].clientY)
    setDragCurrentY(e.touches[0].clientY)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartY === null) return
    const currentY = e.touches[0].clientY
    // Only track downward movement (positive delta)
    if (currentY > dragStartY) {
      setDragCurrentY(currentY)
    }
  }

  const handleTouchEnd = () => {
    if (dragStartY === null || dragCurrentY === null) return
    const dragDistance = dragCurrentY - dragStartY
    if (dragDistance > dragThreshold) {
      handleCloseMenu()
    } else {
      // Reset - snap back
      setDragStartY(null)
      setDragCurrentY(null)
    }
  }

  // Calculate drag offset for visual feedback
  const dragOffset = dragStartY !== null && dragCurrentY !== null
    ? Math.max(0, dragCurrentY - dragStartY)
    : 0

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  // All navigation links for desktop sidebar
  const navLinks = [
    { to: '/app', icon: BarChart3, label: 'Dashboard' },
    { to: '/app/trades', icon: List, label: 'Trade Log' },
    { to: '/app/balance', icon: Wallet, label: 'Balance' },
    { to: '/app/journals', icon: BookOpen, label: 'Journals' },
    { to: '/app/analytics', icon: TrendingUp, label: 'Analytics' },
    { to: '/app/calendar', icon: Calendar, label: 'Calendar' },
    // { to: '/app/leaderboard', icon: Trophy, label: 'Leaderboard' }, // Commented out for local testing (no multi-user)
    { to: '/app/settings', icon: Settings, label: 'Settings' },
  ]

  // Mobile bottom nav links (user-specified order: Dash, Calendar, Balance, Trades, More)
  const mobileNavLinks = [
    { to: '/app', icon: BarChart3, label: 'Dash' },
    { to: '/app/calendar', icon: Calendar, label: 'Calendar' },
    { to: '/app/balance', icon: Wallet, label: 'Balance' },
    { to: '/app/trades', icon: List, label: 'Trades' },
  ]

  // ALL links for the bottom sheet menu (shows all navigation options)
  const allMobileLinks = [
    { to: '/app', icon: BarChart3, label: 'Dashboard' },
    { to: '/app/calendar', icon: Calendar, label: 'Calendar' },
    { to: '/app/balance', icon: Wallet, label: 'Balance' },
    { to: '/app/trades', icon: List, label: 'Trade Log' },
    { to: '/app/journals', icon: BookOpen, label: 'Journals' },
    { to: '/app/analytics', icon: TrendingUp, label: 'Analytics' },
    { to: '/app/settings', icon: Settings, label: 'Settings' },
  ]

  return (
    <>
      {/* ===== DESKTOP SIDEBAR (hidden on mobile) ===== */}
      <nav
        className={`hidden md:flex fixed left-0 top-0 h-screen border-r border-theme bg-secondary z-50 shadow-lg transition-all duration-300 flex-col ${
          isExpanded ? 'w-60' : 'w-16'
        }`}
      >
      {/* Logo and Brand */}
      <div className="p-4 border-b border-theme flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-accent to-premium rounded-lg flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          {isExpanded && (
            <div className="overflow-hidden">
              <h1 className="text-lg font-bold text-primary whitespace-nowrap">TiltedTrades</h1>
              <p className="text-xs text-tertiary whitespace-nowrap">Futures Trading Journal</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto py-4 px-2">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === '/app'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-3 mb-1 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-tertiary text-primary'
                  : 'text-secondary hover:text-primary hover:bg-tertiary/50'
              }`
            }
            title={!isExpanded ? link.label : undefined}
          >
            <link.icon className="w-5 h-5 flex-shrink-0" />
            {isExpanded && <span className="whitespace-nowrap">{link.label}</span>}
          </NavLink>
        ))}
      </div>

      {/* Upload Button */}
      <div className="border-t border-theme px-3 py-4 flex-shrink-0">
        <button
          onClick={() => setShowUploadModal(true)}
          className="w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white"
          title={!isExpanded ? 'Upload Data' : undefined}
        >
          <Upload className="w-4 h-4 flex-shrink-0" />
          {isExpanded && <span className="whitespace-nowrap">Upload Data</span>}
        </button>
      </div>

      {/* Net/Gross P&L Toggle */}
      <div className="border-t border-theme px-3 py-2.5 flex-shrink-0">
        {isExpanded ? (
          <div className="space-y-1.5">
            <span className="text-xs text-tertiary block">P&L Display:</span>
            <div className="flex bg-tertiary rounded-lg p-0.5">
              <button
                onClick={() => onShowGrossPLChange(false)}
                className={`flex-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                  !showGrossPL
                    ? 'bg-accent text-white'
                    : 'text-secondary hover:text-white'
                }`}
              >
                Net
              </button>
              <button
                onClick={() => onShowGrossPLChange(true)}
                className={`flex-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                  showGrossPL
                    ? 'bg-accent text-white'
                    : 'text-secondary hover:text-white'
                }`}
              >
                Gross
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={() => onShowGrossPLChange(!showGrossPL)}
              className="w-8 h-8 bg-tertiary hover:bg-tertiary/80 rounded-lg flex items-center justify-center transition-colors"
              title={`P&L: ${showGrossPL ? 'Gross' : 'Net'} (click to toggle)`}
            >
              <span className="text-xs font-bold text-accent">
                {showGrossPL ? 'G' : 'N'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Calculation Method Toggle */}
      <div className="border-t border-theme px-3 py-2.5 flex-shrink-0">
        {isExpanded ? (
          <div className="space-y-1.5">
            <span className="text-xs text-tertiary block">P&L Method:</span>
            <div className="flex bg-tertiary rounded-lg p-0.5">
              <button
                onClick={() => onCalculationMethodChange('fifo')}
                className={`flex-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                  calculationMethod === 'fifo'
                    ? 'bg-accent text-white'
                    : 'text-secondary hover:text-white'
                }`}
              >
                FIFO
              </button>
              <button
                onClick={() => onCalculationMethodChange('perPosition')}
                className={`flex-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                  calculationMethod === 'perPosition'
                    ? 'bg-accent text-white'
                    : 'text-secondary hover:text-white'
                }`}
              >
                Per Pos
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={() => onCalculationMethodChange(calculationMethod === 'fifo' ? 'perPosition' : 'fifo')}
              className="w-8 h-8 bg-tertiary hover:bg-tertiary/80 rounded-lg flex items-center justify-center transition-colors"
              title={`P&L: ${calculationMethod === 'fifo' ? 'FIFO' : 'Per Position'} (click to toggle)`}
            >
              <span className="text-xs font-bold text-accent">
                {calculationMethod === 'fifo' ? 'F' : 'P'}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* User Info & Logout */}
      <div className="border-t border-theme px-3 py-2.5 flex-shrink-0">
        {isExpanded ? (
          <div className="space-y-2">
            {/* User Info */}
            <div className="flex items-center gap-2 text-xs text-tertiary">
              <User className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate" title={user?.email}>
                {user?.email || 'Not logged in'}
              </span>
            </div>
            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-secondary hover:text-white hover:bg-red-600/20 border border-theme hover:border-red-500"
            >
              <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full flex items-center justify-center py-1.5 rounded-lg text-tertiary hover:text-secondary transition-colors"
            title={user?.email ? `Signed in as: ${user.email}` : 'Not signed in'}
          >
            <User className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Toggle Button */}
      <div className="border-t border-theme p-2 flex-shrink-0">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center py-2 rounded-lg text-secondary hover:text-primary hover:bg-tertiary/50 transition-colors"
          title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {isExpanded ? (
            <ChevronLeft className="w-5 h-5" />
          ) : (
            <ChevronRight className="w-5 h-5" />
          )}
        </button>
      </div>

        {/* Upload Modal */}
        <FileUploadModal
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => setShowUploadModal(false)}
        />
      </nav>

      {/* ===== MOBILE BOTTOM NAVIGATION (visible only on mobile) ===== */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-secondary border-t border-theme z-50 safe-area-bottom">
        <div className="flex justify-around items-center h-16">
          {mobileNavLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/app'}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center min-w-[64px] h-full px-2 transition-colors ${
                  isActive
                    ? 'text-accent'
                    : 'text-tertiary active:text-secondary'
                }`
              }
            >
              <link.icon className="w-6 h-6" />
              <span className="text-[10px] mt-1 font-medium">{link.label}</span>
            </NavLink>
          ))}

          {/* More Menu Button */}
          <button
            onClick={() => setShowMobileMenu(true)}
            className="flex flex-col items-center justify-center min-w-[64px] h-full px-2 text-tertiary active:text-secondary transition-colors"
          >
            <Menu className="w-6 h-6" />
            <span className="text-[10px] mt-1 font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* ===== MOBILE BOTTOM SHEET MENU ===== */}
      {showMobileMenu && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 bg-black/60 z-50"
            onClick={handleCloseMenu}
          />

          {/* Bottom Sheet */}
          <div
            className={`md:hidden fixed bottom-0 left-0 right-0 bg-secondary border-t border-theme rounded-t-2xl z-50 flex flex-col max-h-[85vh] ${isClosingMenu ? 'animate-slide-down' : 'animate-slide-up'}`}
            style={{
              transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
              transition: dragOffset > 0 ? 'none' : undefined
            }}
          >
            {/* Swipeable Header Area (drag handle + header) */}
            <div
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              className="flex-shrink-0 cursor-grab active:cursor-grabbing"
            >
              {/* Drag Handle Indicator */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1.5 bg-tertiary rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-4 pb-3 border-b border-theme">
                <div className="w-10" /> {/* Spacer for centering */}
                <h2 className="text-lg font-semibold text-primary">Menu</h2>
                <button
                  onClick={handleCloseMenu}
                  className="p-2 rounded-lg text-tertiary active:text-secondary active:bg-tertiary/50 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Content - entire menu scrolls */}
            <div className="flex-1 overflow-y-auto">
              {/* Navigation Links - row layout */}
              <div className="p-4 space-y-2">
                {allMobileLinks.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.to === '/app'}
                    onClick={handleCloseMenu}
                    className={({ isActive }) =>
                      `flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-medium transition-colors touch-target ${
                        isActive
                          ? 'bg-accent/20 text-accent border border-accent/30'
                          : 'bg-tertiary/50 text-secondary active:bg-tertiary border border-transparent'
                      }`
                    }
                  >
                    <link.icon className="w-5 h-5 flex-shrink-0" />
                    <span>{link.label}</span>
                  </NavLink>
                ))}

                {/* Upload Button - full width */}
                <button
                  onClick={() => {
                    handleCloseMenu()
                    setTimeout(() => setShowUploadModal(true), 300)
                  }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 mt-2 rounded-xl text-sm font-medium bg-accent active:bg-accent/90 text-white touch-target"
                >
                  <Upload className="w-5 h-5 flex-shrink-0" />
                  <span>Upload Data</span>
                </button>
              </div>

              {/* Settings Section - P&L toggles */}
              <div className="border-t border-theme p-4 space-y-4">
                {/* P&L Display Toggle */}
                <div className="space-y-2">
                  <span className="text-xs text-tertiary block">P&L Display:</span>
                  <div className="flex bg-tertiary rounded-lg p-0.5">
                    <button
                      onClick={() => onShowGrossPLChange(false)}
                      className={`flex-1 px-3 py-2.5 text-sm font-medium rounded-md transition-colors touch-target ${
                        !showGrossPL
                          ? 'bg-accent text-white'
                          : 'text-secondary active:text-white'
                      }`}
                    >
                      Net
                    </button>
                    <button
                      onClick={() => onShowGrossPLChange(true)}
                      className={`flex-1 px-3 py-2.5 text-sm font-medium rounded-md transition-colors touch-target ${
                        showGrossPL
                          ? 'bg-accent text-white'
                          : 'text-secondary active:text-white'
                      }`}
                    >
                      Gross
                    </button>
                  </div>
                </div>

                {/* Calculation Method Toggle */}
                <div className="space-y-2">
                  <span className="text-xs text-tertiary block">P&L Method:</span>
                  <div className="flex bg-tertiary rounded-lg p-0.5">
                    <button
                      onClick={() => onCalculationMethodChange('fifo')}
                      className={`flex-1 px-3 py-2.5 text-sm font-medium rounded-md transition-colors touch-target ${
                        calculationMethod === 'fifo'
                          ? 'bg-accent text-white'
                          : 'text-secondary active:text-white'
                      }`}
                    >
                      FIFO
                    </button>
                    <button
                      onClick={() => onCalculationMethodChange('perPosition')}
                      className={`flex-1 px-3 py-2.5 text-sm font-medium rounded-md transition-colors touch-target ${
                        calculationMethod === 'perPosition'
                          ? 'bg-accent text-white'
                          : 'text-secondary active:text-white'
                      }`}
                    >
                      Per Pos
                    </button>
                  </div>
                </div>

                {/* Theme Toggle */}
                <div className="space-y-2">
                  <span className="text-xs text-tertiary block">Theme:</span>
                  <div className="flex bg-tertiary rounded-lg p-0.5">
                    <button
                      onClick={() => setTheme('light')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-md transition-colors touch-target ${
                        theme === 'light'
                          ? 'bg-accent text-white'
                          : 'text-secondary active:text-white'
                      }`}
                    >
                      <Sun className="w-4 h-4" />
                      <span>Light</span>
                    </button>
                    <button
                      onClick={() => setTheme('dark')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-md transition-colors touch-target ${
                        theme === 'dark'
                          ? 'bg-accent text-white'
                          : 'text-secondary active:text-white'
                      }`}
                    >
                      <Moon className="w-4 h-4" />
                      <span>Dark</span>
                    </button>
                    <button
                      onClick={() => setTheme('system')}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-md transition-colors touch-target ${
                        theme === 'system'
                          ? 'bg-accent text-white'
                          : 'text-secondary active:text-white'
                      }`}
                    >
                      <Monitor className="w-4 h-4" />
                      <span>Auto</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* User Info & Logout */}
              <div className="border-t border-theme p-4 space-y-3 safe-area-bottom">
                <div className="flex items-center gap-2 text-sm text-tertiary">
                  <User className="w-4 h-4" />
                  <span className="truncate">{user?.email || 'Not logged in'}</span>
                </div>
                <button
                  onClick={() => {
                    handleCloseMenu()
                    setTimeout(handleLogout, 300)
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors text-secondary active:text-white border border-theme active:border-red-500 active:bg-red-600/20 touch-target"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Upload Modal (shared between desktop and mobile) */}
      <FileUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={() => setShowUploadModal(false)}
      />
    </>
  )
}
