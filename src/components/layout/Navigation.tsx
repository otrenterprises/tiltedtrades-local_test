import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { BarChart3, TrendingUp, Calendar, List, BookOpen, Trophy, Settings, Wallet, ChevronLeft, ChevronRight, Upload, LogOut, User } from 'lucide-react'
import { CalculationMethod } from '@/utils/calculations/tradeMatching'
import { useNavigation } from '@/contexts/NavigationContext'
import { useAuth } from '@/contexts/AuthContext'
import { FileUploadModal } from '@/components/upload/FileUploadModal'

interface NavigationProps {
  calculationMethod: CalculationMethod
  onCalculationMethodChange: (method: CalculationMethod) => void
}

export function Navigation({ calculationMethod, onCalculationMethodChange }: NavigationProps) {
  const { isExpanded, setIsExpanded } = useNavigation()
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [showUploadModal, setShowUploadModal] = useState(false)

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

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

  return (
    <nav
      className={`fixed left-0 top-0 h-screen border-r border-dark-border z-50 shadow-lg transition-all duration-300 flex flex-col ${
        isExpanded ? 'w-60' : 'w-16'
      }`}
      style={{ backgroundColor: '#1E293B' }}
    >
      {/* Logo and Brand */}
      <div className="p-4 border-b border-dark-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-accent to-premium rounded-lg flex items-center justify-center flex-shrink-0">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          {isExpanded && (
            <div className="overflow-hidden">
              <h1 className="text-lg font-bold text-slate-50 whitespace-nowrap">TiltedTrades</h1>
              <p className="text-xs text-slate-400 whitespace-nowrap">Futures Trading Journal</p>
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
                  ? 'bg-dark-tertiary text-slate-50'
                  : 'text-slate-300 hover:text-slate-50 hover:bg-dark-tertiary/50'
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
      <div className="border-t border-dark-border p-4 flex-shrink-0">
        <button
          onClick={() => setShowUploadModal(true)}
          className="w-full flex items-center justify-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white"
          title={!isExpanded ? 'Upload Data' : undefined}
        >
          <Upload className="w-5 h-5 flex-shrink-0" />
          {isExpanded && <span className="whitespace-nowrap">Upload Data</span>}
        </button>
      </div>

      {/* Calculation Method Toggle */}
      <div className="border-t border-dark-border p-4 flex-shrink-0">
        {isExpanded ? (
          <div className="space-y-2">
            <span className="text-xs text-slate-400 block">P&L Method:</span>
            <div className="flex bg-dark-tertiary rounded-lg p-1">
              <button
                onClick={() => onCalculationMethodChange('fifo')}
                className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  calculationMethod === 'fifo'
                    ? 'bg-accent text-white'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                FIFO
              </button>
              <button
                onClick={() => onCalculationMethodChange('perPosition')}
                className={`flex-1 px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  calculationMethod === 'perPosition'
                    ? 'bg-accent text-white'
                    : 'text-slate-300 hover:text-white'
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
              className="w-10 h-10 bg-dark-tertiary hover:bg-dark-tertiary/80 rounded-lg flex items-center justify-center transition-colors"
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
      <div className="border-t border-dark-border p-4 flex-shrink-0">
        {isExpanded ? (
          <div className="space-y-3">
            {/* User Info */}
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <User className="w-4 h-4 flex-shrink-0" />
              <span className="truncate" title={user?.email}>
                {user?.email || 'Not logged in'}
              </span>
            </div>
            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-slate-300 hover:text-white hover:bg-red-600/20 border border-slate-600 hover:border-red-500"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsExpanded(true)}
            className="w-full flex items-center justify-center py-2 rounded-lg text-slate-400 hover:text-slate-300 transition-colors"
            title={user?.email ? `Signed in as: ${user.email}` : 'Not signed in'}
          >
            <User className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Toggle Button */}
      <div className="border-t border-dark-border p-2 flex-shrink-0">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center py-2 rounded-lg text-slate-300 hover:text-slate-50 hover:bg-dark-tertiary/50 transition-colors"
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
  )
}
