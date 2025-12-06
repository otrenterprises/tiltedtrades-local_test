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

  // Single pass through entries to calculate:
  // - Summary totals (deposits, withdrawals, fees, commission adjustments)
  // - Cumulative values by date (for chart)
  // - Running funding balance per entry (for transaction table)
  const {
    totalDeposits,
    totalWithdrawals,
    totalFees,
    totalCommissionAdjustments,
    netFunding,
    entriesWithCorrectBalance,
    fundingByDate,
    feesByDate,
    commAdjByDate
  } = useMemo(() => {
    let deposits = 0
    let withdrawals = 0
    let fees = 0
    let commissionAdj = 0

    // Sort entries by date for cumulative calculations
    const sortedEntries = [...entries].sort((a, b) => a.date.localeCompare(b.date))

    // Maps for chart (by date) and table (by entry)
    const fundingByDateMap = new Map<string, number>()
    const feesByDateMap = new Map<string, number>()
    const commAdjByDateMap = new Map<string, number>()
    const balanceByEntryMap = new Map<string, number>()

    let cumulativeFunding = 0
    let cumulativeFees = 0
    let cumulativeCommAdj = 0

    for (const entry of sortedEntries) {
      if (entry.type === 'deposit') {
        deposits += entry.amount
        cumulativeFunding += entry.amount
      } else if (entry.type === 'withdrawal') {
        withdrawals += entry.amount
        cumulativeFunding -= entry.amount
      } else if (entry.type === 'fee') {
        fees += entry.amount
        cumulativeFees += entry.amount
      } else if (entry.type === 'commission_adjustment') {
        commissionAdj += entry.amount
        cumulativeCommAdj += entry.amount
      }

      // Store cumulative values by date (for chart)
      fundingByDateMap.set(entry.date, cumulativeFunding)
      feesByDateMap.set(entry.date, cumulativeFees)
      commAdjByDateMap.set(entry.date, cumulativeCommAdj)

      // Store running funding balance by entry (for table)
      balanceByEntryMap.set(entry.entryId, cumulativeFunding)
    }

    // Create entries with corrected balance values
    const correctedEntries = entries.map(entry => ({
      ...entry,
      balance: balanceByEntryMap.get(entry.entryId) ?? entry.balance
    }))

    return {
      totalDeposits: deposits,
      totalWithdrawals: withdrawals,
      totalFees: fees,
      totalCommissionAdjustments: commissionAdj,
      netFunding: deposits - withdrawals,
      entriesWithCorrectBalance: correctedEntries,
      fundingByDate: fundingByDateMap,
      feesByDate: feesByDateMap,
      commAdjByDate: commAdjByDateMap
    }
  }, [entries])

  // Calculate account value: Funding - Fees + Commission Adjustments + Trading P&L
  const currentAccountValue = netFunding - totalFees + totalCommissionAdjustments + totalTradingPL

  // Build account value history for chart (combines entry data with trade P&L)
  const accountValueHistory = useMemo(() => {
    if (entries.length === 0) return []

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

    // Combine all dates from entries and trades
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
        fundingBalance: lastFunding,
        tradingPL: lastTradingPL,
        accountValue
      })
    })

    return history
  }, [entries, trades, fundingByDate, feesByDate, commAdjByDate])

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
            <p className="text-tertiary">Loading balance data...</p>
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
