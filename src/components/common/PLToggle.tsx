/**
 * P&L Toggle Component
 * Switch toggle for switching between Net P&L and Gross P&L display
 */

interface PLToggleProps {
  showGrossPL: boolean
  onToggle: (showGross: boolean) => void
}

export function PLToggle({ showGrossPL, onToggle }: PLToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <span className={`text-sm font-medium transition-colors ${!showGrossPL ? 'text-primary' : 'text-muted'}`}>
        Net
      </span>
      <button
        onClick={() => onToggle(!showGrossPL)}
        className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-secondary bg-tertiary border border-theme"
        role="switch"
        aria-checked={showGrossPL}
        aria-label={showGrossPL ? 'Showing Gross P&L' : 'Showing Net P&L'}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
            showGrossPL ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      <span className={`text-sm font-medium transition-colors ${showGrossPL ? 'text-primary' : 'text-muted'}`}>
        Gross
      </span>
    </div>
  )
}
