import { useState, useMemo } from 'react'
import { Plus } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { PageLayout } from '@/components/layout/PageLayout'
import { BalanceEntryModal } from '@/components/balance/BalanceEntryModal'
import { useTrades } from '@/hooks/useTrades'
import { useBalance, useDeleteBalanceEntry, useDeleteBalanceTemplate } from '@/hooks/useBalance'
import { ApiBalanceEntry, ApiRecurringTemplate } from '@/types/api/balance.types'
import {
  AccountValueCard,
  BalanceSummaryStats,
  AccountValueChart,
  RecurringFeesSection,
  TransactionTable,
} from './components'

export function Balance() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<ApiBalanceEntry | null>(null)
  const [editingTemplate, setEditingTemplate] = useState<ApiRecurringTemplate | null>(null)

  // Fetch balance data from API
  const { data: balanceData, isLoading: isLoadingBalance } = useBalance()
  const deleteEntry = useDeleteBalanceEntry()
  const deleteTemplate = useDeleteBalanceTemplate()

  // Fetch trades from API
  const { data: tradesData, isLoading: isLoadingTrades } = useTrades({ method: 'fifo' })
  const trades = tradesData?.trades || []

  // Extract data from balance response
  const entries = balanceData?.entries || []
  const templates = balanceData?.templates || []

  // Calculate total trading P&L
  const totalTradingPL = trades.reduce((sum, trade) => sum + trade.pl, 0)

  // Calculate summary stats and net funding (deposits - withdrawals only, excluding fees)
  // Also calculate correct running balance for each entry (funding only, not fees)
  const { totalDeposits, totalWithdrawals, totalFees, totalCommissionAdjustments, netFunding, entriesWithCorrectBalance } = useMemo(() => {
    let deposits = 0
    let withdrawals = 0
    let fees = 0
    let commissionAdj = 0

    // Sort entries by date to calculate running balance
    const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date))

    // Calculate running funding balance (deposits - withdrawals only)
    let runningFunding = 0
    const balanceMap = new Map<string, number>()

    for (const entry of sortedEntries) {
      if (entry.type === 'deposit') {
        deposits += entry.amount
        runningFunding += entry.amount
      } else if (entry.type === 'withdrawal') {
        withdrawals += entry.amount
        runningFunding -= entry.amount
      } else if (entry.type === 'fee') {
        fees += entry.amount
        // Fees don't affect running funding balance
      } else if (entry.type === 'commission_adjustment') {
        commissionAdj += entry.amount
        // Commission adjustments don't affect running funding balance
      }
      balanceMap.set(entry.entryId, runningFunding)
    }

    // Create entries with corrected balance values
    const correctedEntries = entries.map(entry => ({
      ...entry,
      balance: balanceMap.get(entry.entryId) ?? entry.balance
    }))

    // Net Funding = Deposits - Withdrawals (fees are separate, not part of funding)
    const funding = deposits - withdrawals

    return {
      totalDeposits: deposits,
      totalWithdrawals: withdrawals,
      totalFees: fees,
      totalCommissionAdjustments: commissionAdj,
      netFunding: funding,
      entriesWithCorrectBalance: correctedEntries
    }
  }, [entries])

  // Calculate account value: Funding - Fees + Commission Adjustments + Trading P&L
  // Note: fees are stored as positive but represent costs, so we subtract them
  const currentAccountValue = netFunding - totalFees + totalCommissionAdjustments + totalTradingPL

  // Build account value history for chart
  // Funding = Deposits - Withdrawals (NOT including fees)
  const accountValueHistory = useMemo(() => {
    if (entries.length === 0) return []

    // Sort entries by date to calculate running totals
    const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date))

    // Calculate cumulative funding, fees, and commission adjustments by date
    const fundingByDate = new Map<string, number>()
    const feesByDate = new Map<string, number>()
    const commAdjByDate = new Map<string, number>()

    let cumulativeFunding = 0
    let cumulativeFees = 0
    let cumulativeCommAdj = 0

    sortedEntries.forEach(entry => {
      if (entry.type === 'deposit') {
        cumulativeFunding += entry.amount
      } else if (entry.type === 'withdrawal') {
        cumulativeFunding -= entry.amount
      } else if (entry.type === 'fee') {
        cumulativeFees += entry.amount
      } else if (entry.type === 'commission_adjustment') {
        cumulativeCommAdj += entry.amount
      }

      fundingByDate.set(entry.date, cumulativeFunding)
      feesByDate.set(entry.date, cumulativeFees)
      commAdjByDate.set(entry.date, cumulativeCommAdj)
    })

    // Calculate cumulative trading P&L by date
    const tradingPLByDate = new Map<string, number>()
    let cumulativePL = 0
    const sortedTrades = [...trades]
      .filter(t => t.exitDate !== null)
      .sort((a, b) => new Date(a.exitDate!).getTime() - new Date(b.exitDate!).getTime())

    sortedTrades.forEach(trade => {
      cumulativePL += trade.pl
      const dateStr = format(trade.exitDate!, 'yyyy-MM-dd')
      tradingPLByDate.set(dateStr, cumulativePL)
    })

    // Combine all dates
    const allDates = new Set([...fundingByDate.keys(), ...tradingPLByDate.keys()])
    const sortedDates = Array.from(allDates).sort()

    const history: Array<{ date: string; accountValue: number; fundingBalance: number; tradingPL: number }> = []
    let lastFunding = 0
    let lastFees = 0
    let lastCommAdj = 0
    let lastTradingPL = 0

    sortedDates.forEach(date => {
      if (fundingByDate.has(date)) {
        lastFunding = fundingByDate.get(date)!
        lastFees = feesByDate.get(date) || lastFees
        lastCommAdj = commAdjByDate.get(date) || lastCommAdj
      }
      if (tradingPLByDate.has(date)) {
        lastTradingPL = tradingPLByDate.get(date)!
      }

      // Account Value = Funding - Fees + Commission Adjustments + Trading P&L
      const accountValue = lastFunding - lastFees + lastCommAdj + lastTradingPL

      history.push({
        date,
        fundingBalance: lastFunding, // Pure funding (deposits - withdrawals)
        tradingPL: lastTradingPL,
        accountValue
      })
    })

    return history
  }, [entries, trades])

  // Prepare chart data (sample last 60 entries for readability)
  const chartData = accountValueHistory.slice(-60).map(item => ({
    date: format(parseISO(item.date), 'MM/dd'),
    'Account Value': item.accountValue,
    'Funding': item.fundingBalance,
    'Trading P&L': item.tradingPL
  }))

  // Event handlers
  function handleAddEntry() {
    setEditingEntry(null)
    setEditingTemplate(null)
    setIsModalOpen(true)
  }

  function handleEditEntry(entry: ApiBalanceEntry) {
    setEditingEntry(entry)
    setEditingTemplate(null)
    setIsModalOpen(true)
  }

  function handleEditTemplate(template: ApiRecurringTemplate) {
    setEditingEntry(null)
    setEditingTemplate(template)
    setIsModalOpen(true)
  }

  async function handleDeleteEntry(entryId: string) {
    if (!confirm('Are you sure you want to delete this entry?')) return
    deleteEntry.mutate(entryId)
  }

  async function handleDeleteTemplate(templateId: string) {
    if (!confirm('Are you sure you want to delete this recurring fee template?')) return
    deleteTemplate.mutate(templateId)
  }

  function handleModalClose() {
    setIsModalOpen(false)
    setEditingEntry(null)
    setEditingTemplate(null)
  }

  function handleModalSave() {
    setIsModalOpen(false)
    setEditingEntry(null)
    setEditingTemplate(null)
  }

  // Loading state
  if (isLoadingBalance || isLoadingTrades) {
    return (
      <PageLayout title="Account Balance" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin w-12 h-12 border-4 border-accent border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-slate-400">Loading balance data...</p>
          </div>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Account Balance"
      subtitle="Track deposits, withdrawals, and fees"
      actions={
        <button
          onClick={handleAddEntry}
          className="flex items-center gap-2 px-3 py-2 md:px-4 bg-accent text-white rounded-lg hover:bg-accent/90 active:bg-accent/80 transition-colors text-sm md:text-base touch-target"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Entry</span>
          <span className="sm:hidden">Add</span>
        </button>
      }
    >
      <div className="space-y-4 md:space-y-6">
        <AccountValueCard
          currentAccountValue={currentAccountValue}
          netFunding={netFunding}
          totalTradingPL={totalTradingPL}
        />

        <BalanceSummaryStats
          totalDeposits={totalDeposits}
          totalWithdrawals={totalWithdrawals}
          totalFees={totalFees}
          totalCommissionAdjustments={totalCommissionAdjustments}
        />

        <AccountValueChart chartData={chartData} />

        <RecurringFeesSection
          templates={templates}
          onEditTemplate={handleEditTemplate}
          onDeleteTemplate={handleDeleteTemplate}
        />

        <TransactionTable
          entries={entriesWithCorrectBalance}
          onEditEntry={handleEditEntry}
          onDeleteEntry={handleDeleteEntry}
        />
      </div>

      {/* Balance Entry Modal */}
      {isModalOpen && (
        <BalanceEntryModal
          entry={editingEntry}
          template={editingTemplate}
          onClose={handleModalClose}
          onSave={handleModalSave}
        />
      )}
    </PageLayout>
  )
}
