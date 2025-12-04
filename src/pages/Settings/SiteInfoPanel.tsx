import { BarChart3, List, Wallet, BookOpen, TrendingUp, Calendar, AlertTriangle, Upload } from 'lucide-react'

const sections = [
  {
    icon: BarChart3,
    title: 'Dashboard',
    description: 'Your trading performance at a glance. View key metrics like total P&L, win rate, profit factor, and expectancy. Interactive equity curve chart with daily/weekly/monthly grouping options.',
  },
  {
    icon: List,
    title: 'Trade Log',
    description: 'Complete list of all your matched trades. Sort by date, filter results, and quickly add journal notes to any trade. Click the journal icon to view or create detailed trade analysis.',
  },
  {
    icon: Wallet,
    title: 'Balance',
    description: 'Track your account balance, deposits, withdrawals, and fees. Add manual entries for commission adjustments or recurring fees. Create templates for repeated transactions like monthly fees.',
  },
  {
    icon: BookOpen,
    title: 'Journals',
    description: 'Document your trading decisions with detailed journal entries. Add setup notes, entry/exit reasoning, and attach chart images. Override commissions for specific trades if needed.',
  },
  {
    icon: TrendingUp,
    title: 'Analytics',
    description: 'Deep dive into your trading patterns. Analyze performance by symbol, time of day, day of week, and more. Identify your strengths and areas for improvement.',
  },
  {
    icon: Calendar,
    title: 'Calendar',
    description: 'Visual calendar showing daily P&L. View by day, week, or month. Quickly identify profitable and losing days. Toggle between including or excluding commissions in the display.',
  },
]

export default function SiteInfoPanel() {
  return (
    <div className="space-y-4 md:space-y-6">
      {/* Navigation Toggles Section */}
      <div className="bg-dark-secondary rounded-lg p-4 md:p-6">
        <h3 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">Navigation Toggles</h3>
        <p className="text-sm text-gray-400 mb-4">
          These toggles in the navigation control how your P&L is displayed across the entire application.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Net/Gross Card */}
          <div className="bg-dark-tertiary rounded-lg p-4 border border-dark-border">
            <h4 className="text-sm font-semibold text-white mb-3">P&L Display: Net / Gross</h4>
            <div className="space-y-3">
              <div>
                <span className="text-xs font-medium text-accent">NET</span>
                <p className="text-sm text-gray-300 mt-1">
                  P&L after commissions are deducted. Shows your actual realized profit.
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-accent">GROSS</span>
                <p className="text-sm text-gray-300 mt-1">
                  P&L before any commissions. Shows raw trading performance.
                </p>
              </div>
            </div>
          </div>

          {/* FIFO/Per Position Card */}
          <div className="bg-dark-tertiary rounded-lg p-4 border border-dark-border">
            <h4 className="text-sm font-semibold text-white mb-3">P&L Method: FIFO / Per Position</h4>
            <div className="space-y-3">
              <div>
                <span className="text-xs font-medium text-accent">FIFO</span>
                <p className="text-sm text-gray-300 mt-1">
                  First-In, First-Out matching. Entries are matched with exits chronologically.
                </p>
              </div>
              <div>
                <span className="text-xs font-medium text-accent">PER POSITION</span>
                <p className="text-sm text-gray-300 mt-1">
                  Groups all entries/exits for the same symbol into single trades.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Sections */}
      <div className="bg-dark-secondary rounded-lg p-4 md:p-6">
        <h3 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">Main Sections</h3>
        <div className="space-y-3">
          {sections.map((section) => (
            <div
              key={section.title}
              className="bg-dark-tertiary rounded-lg p-4 border border-dark-border"
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-accent/20 rounded-lg flex items-center justify-center">
                  <section.icon className="w-4 h-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white mb-1">{section.title}</h4>
                  <p className="text-sm text-gray-300 leading-relaxed">{section.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Upload Requirements */}
      <div className="bg-dark-secondary rounded-lg p-4 md:p-6">
        <h3 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">Uploading Your Data</h3>

        {/* Warning Box */}
        <div className="bg-caution/10 border border-caution/30 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-caution flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-caution mb-2">File Requirements</h4>
              <p className="text-sm text-gray-300 mb-3">
                Your upload file <strong className="text-white">MUST</strong> be a Statement Report downloaded directly from CQG QTrader. The file must meet these requirements:
              </p>
              <ul className="text-sm text-gray-300 space-y-1.5 list-disc list-inside">
                <li>Downloaded from <span className="text-white">QTrader → Reports → Statement Report</span></li>
                <li>All columns included (do not hide or remove any columns)</li>
                <li>NOT modified after download (no edits to sheet name or headers)</li>
                <li>File format: <span className="text-white">.xlsx</span> or <span className="text-white">.xls</span></li>
              </ul>
              <p className="text-sm text-gray-400 mt-3 italic">
                The system validates the sheet name and column headers during upload. Modified files will fail validation.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Start */}
        <div className="bg-dark-tertiary rounded-lg p-4 border border-dark-border">
          <div className="flex items-center gap-2 mb-3">
            <Upload className="w-4 h-4 text-accent" />
            <h4 className="text-sm font-semibold text-white">Quick Start</h4>
          </div>
          <ol className="text-sm text-gray-300 space-y-2 list-decimal list-inside">
            <li>Click <span className="text-accent font-medium">"Upload Data"</span> in the navigation</li>
            <li>Select your unmodified QTrader Statement Report</li>
            <li>Data is automatically processed and matched into trades</li>
            <li>Use Nav toggles to switch between Net/Gross and FIFO/Per Position views</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
