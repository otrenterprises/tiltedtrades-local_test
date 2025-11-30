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
  const currentBalance = balanceData?.runningBalance || 0

  // Calculate total trading P&L
  const totalTradingPL = trades.reduce((sum, trade) => sum + trade.pl, 0)

  // Calculate account value (funding + trading P&L)
  const currentAccountValue = currentBalance + totalTradingPL

  // Calculate summary stats
  const { totalDeposits, totalWithdrawals, totalFees, totalCommissionAdjustments } = useMemo(() => {
    let deposits = 0
    let withdrawals = 0
    let fees = 0
    let commissionAdj = 0

    for (const entry of entries) {
      if (entry.type === 'deposit') {
        deposits += entry.amount
      } else if (entry.type === 'withdrawal') {
        withdrawals += entry.amount
      } else if (entry.type === 'fee') {
        fees += entry.amount
      } else if (entry.type === 'commission_adjustment') {
        commissionAdj += entry.amount
      }
    }

    return {
      totalDeposits: deposits,
      totalWithdrawals: withdrawals,
      totalFees: fees,
      totalCommissionAdjustments: commissionAdj
    }
  }, [entries])

  // Build account value history for chart
  const accountValueHistory = useMemo(() => {
    if (entries.length === 0) return []

    const fundingByDate = new Map<string, number>()
    entries.forEach(entry => {
      fundingByDate.set(entry.date, entry.balance || 0)
    })

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

    const allDates = new Set([...fundingByDate.keys(), ...tradingPLByDate.keys()])
    const sortedDates = Array.from(allDates).sort()

    const history: Array<{ date: string; accountValue: number; fundingBalance: number; tradingPL: number }> = []
    let lastFundingBalance = 0
    let lastTradingPL = 0

    sortedDates.forEach(date => {
      if (fundingByDate.has(date)) {
        lastFundingBalance = fundingByDate.get(date)!
      }
      if (tradingPLByDate.has(date)) {
        lastTradingPL = tradingPLByDate.get(date)!
      }

      history.push({
        date,
        fundingBalance: lastFundingBalance,
        tradingPL: lastTradingPL,
        accountValue: lastFundingBalance + lastTradingPL
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
          className="flex items-center gap-2 px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Entry
        </button>
      }
    >
      <div className="space-y-6">
        <AccountValueCard
          currentAccountValue={currentAccountValue}
          currentBalance={currentBalance}
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
          entries={entries}
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
