/**
 * Mobile Settings Toggle
 * Compact icons for Net/Gross P&L and FIFO/Per Position toggles
 * Displayed on mobile view only, in the top right of page headers
 *
 * Uses SettingsContext to access and modify settings
 */

import { useSettings } from '@/contexts/SettingsContext'

interface MobileSettingsToggleProps {
  // Which toggles to show on this page
  showPLToggle?: boolean      // Show Net/Gross toggle
  showMethodToggle?: boolean  // Show FIFO/Per Position toggle
}

export function MobileSettingsToggle({
  showPLToggle = false,
  showMethodToggle = false,
}: MobileSettingsToggleProps) {
  const { showGrossPL, setShowGrossPL, calculationMethod, setCalculationMethod } = useSettings()

  if (!showPLToggle && !showMethodToggle) {
    return null
  }

  return (
    // Only visible on mobile (md:hidden)
    <div className="flex items-center gap-1.5 md:hidden">
      {/* Net/Gross P&L Toggle */}
      {showPLToggle && (
        <button
          onClick={() => setShowGrossPL(!showGrossPL)}
          className="w-8 h-8 bg-tertiary hover:bg-tertiary/80 rounded-lg flex items-center justify-center transition-colors border border-theme"
          title={`P&L: ${showGrossPL ? 'Gross' : 'Net'} (tap to toggle)`}
          aria-label={`Toggle P&L display. Currently showing ${showGrossPL ? 'Gross' : 'Net'} P&L`}
        >
          <span className="text-xs font-bold text-accent">
            {showGrossPL ? 'G' : 'N'}
          </span>
        </button>
      )}

      {/* FIFO/Per Position Toggle */}
      {showMethodToggle && (
        <button
          onClick={() => setCalculationMethod(calculationMethod === 'fifo' ? 'perPosition' : 'fifo')}
          className="w-8 h-8 bg-tertiary hover:bg-tertiary/80 rounded-lg flex items-center justify-center transition-colors border border-theme"
          title={`Method: ${calculationMethod === 'fifo' ? 'FIFO' : 'Per Position'} (tap to toggle)`}
          aria-label={`Toggle calculation method. Currently using ${calculationMethod === 'fifo' ? 'FIFO' : 'Per Position'}`}
        >
          <span className="text-xs font-bold text-accent">
            {calculationMethod === 'fifo' ? 'F' : 'P'}
          </span>
        </button>
      )}
    </div>
  )
}

export default MobileSettingsToggle
