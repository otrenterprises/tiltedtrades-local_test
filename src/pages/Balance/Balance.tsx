import { useState, useMemo } from 'react'
import { Plus, Edit, Trash2, TrendingUp, TrendingDown, DollarSign, Repeat, Receipt } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { PageLayout } from '@/components/layout/PageLayout'
import { formatCurrency } from '@/utils/formatting/currency'
import { BalanceEntryModal } from '@/components/balance/BalanceEntryModal'
import { useTrades } from '@/hooks/useTrades'
import { useBalance, useDeleteBalanceEntry, useDeleteBalanceTemplate } from '@/hooks/useBalance'
import { ApiBalanceEntry, ApiRecurringTemplate } from '@/types/api/balance.types'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

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
        commissionAdj += entry.amount // Already signed (negative for costs, positive for rebates)
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

    // Create a map of dates to funding balance
    const fundingByDate = new Map<string, number>()
    entries.forEach(entry => {
      fundingByDate.set(entry.date, entry.balance || 0)
    })

    // Create a map of dates to cumulative trading P&L
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

    // Get all unique dates (funding + trading)
    const allDates = new Set([...fundingByDate.keys(), ...tradingPLByDate.keys()])
    const sortedDates = Array.from(allDates).sort()

    // Build history with running values
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

  // Prepare chart data (sample last 60 entries for readability)
  const chartData = accountValueHistory.slice(-60).map(item => ({
    date: format(parseISO(item.date), 'MM/dd'),
    'Account Value': item.accountValue,
    'Funding': item.fundingBalance,
    'Trading P&L': item.tradingPL
  }))

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
        {/* Current Account Value Card */}
        <div className="bg-gradient-to-br from-accent to-premium rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm opacity-90 mb-1">Current Account Value</p>
              <p className="text-4xl font-bold mb-2">{formatCurrency(currentAccountValue)}</p>
              <div className="flex items-center gap-4 text-sm opacity-90">
                <span>Funding: {formatCurrency(currentBalance)}</span>
                <span className={totalTradingPL >= 0 ? 'text-green-300' : 'text-red-300'}>
                  Trading P&L: {formatCurrency(totalTradingPL)}
                </span>
              </div>
            </div>
            <DollarSign className="w-16 h-16 opacity-20" />
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <div className="bg-dark-secondary border border-dark-border rounded-lg p-4 md:p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs md:text-sm text-slate-400">Total Deposits</p>
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-profit flex-shrink-0" />
            </div>
            <p className="text-lg md:text-2xl font-bold text-profit truncate">{formatCurrency(totalDeposits)}</p>
          </div>

          <div className="bg-dark-secondary border border-dark-border rounded-lg p-4 md:p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs md:text-sm text-slate-400">Total Withdrawals</p>
              <TrendingDown className="w-4 h-4 md:w-5 md:h-5 text-loss flex-shrink-0" />
            </div>
            <p className="text-lg md:text-2xl font-bold text-loss truncate">{formatCurrency(totalWithdrawals)}</p>
          </div>

          <div className="bg-dark-secondary border border-dark-border rounded-lg p-4 md:p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs md:text-sm text-slate-400">Total Fees</p>
              <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-caution flex-shrink-0" />
            </div>
            <p className="text-lg md:text-2xl font-bold text-caution truncate">{formatCurrency(totalFees)}</p>
          </div>

          <div className="bg-dark-secondary border border-dark-border rounded-lg p-4 md:p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs md:text-sm text-slate-400">Commission Adj.</p>
              <Receipt className="w-4 h-4 md:w-5 md:h-5 text-purple-400 flex-shrink-0" />
            </div>
            <p className={`text-lg md:text-2xl font-bold truncate ${totalCommissionAdjustments >= 0 ? 'text-profit' : 'text-loss'}`}>
              {formatCurrency(totalCommissionAdjustments)}
            </p>
          </div>
        </div>

        {/* Account Value Chart */}
        {chartData.length > 0 && (
          <div className="bg-dark-secondary border border-dark-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4">Account Value History</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" />
                <YAxis stroke="#9CA3AF" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none' }}
                  labelStyle={{ color: '#9CA3AF' }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="Account Value"
                  stroke="#3B82F6"
                  strokeWidth={3}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="Funding"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                />
                <Line
                  type="monotone"
                  dataKey="Trading P&L"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="5 5"
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 text-xs text-slate-400 flex items-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-blue-500"></div>
                <span>Account Value (Funding + Trading P&L)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-green-500" style={{ borderTop: '2px dashed' }}></div>
                <span>Funding Balance</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-0.5 bg-amber-500" style={{ borderTop: '2px dashed' }}></div>
                <span>Cumulative Trading P&L</span>
              </div>
            </div>
          </div>
        )}

        {/* Recurring Fees Section */}
        {templates.length > 0 && (
          <div className="bg-dark-secondary border border-dark-border rounded-lg p-6">
            <h3 className="text-lg font-semibold text-slate-50 mb-4 flex items-center gap-2">
              <Repeat className="w-5 h-5 text-accent" />
              Recurring Fees
            </h3>
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.entryId}
                  className="flex items-center justify-between p-3 bg-dark-tertiary rounded-lg"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">{template.description}</p>
                    <p className="text-xs text-slate-400">
                      Day {template.dayOfMonth} of each month
                      {template.endDate && ` until ${format(parseISO(template.endDate), 'MM/dd/yyyy')}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="text-sm font-semibold text-loss">{formatCurrency(-template.amount)}</p>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEditTemplate(template)}
                        className="p-2 hover:bg-dark-border rounded transition-colors"
                      >
                        <Edit className="w-4 h-4 text-slate-400 hover:text-slate-200" />
                      </button>
                      <button
                        onClick={() => handleDeleteTemplate(template.entryId)}
                        className="p-2 hover:bg-dark-border rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Entries Table */}
        <div className="bg-dark-secondary border border-dark-border rounded-lg p-6">
          <h3 className="text-lg font-semibold text-slate-50 mb-4">Transaction History</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b-2 border-dark-border">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Date</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-300">Description</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-300">Amount</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-300">Balance</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No entries yet. Click "Add Entry" to get started.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => {
                    const isGenerated = entry.generatedFromTemplate
                    // For commission_adjustment, amount is already signed. For others, sign based on type
                    const displayAmount = entry.type === 'commission_adjustment'
                      ? entry.amount
                      : entry.type === 'deposit'
                        ? entry.amount
                        : -entry.amount

                    // Determine type badge style
                    const getTypeBadgeStyle = () => {
                      switch (entry.type) {
                        case 'deposit':
                          return 'bg-profit/20 text-profit'
                        case 'withdrawal':
                          return 'bg-loss/20 text-loss'
                        case 'fee':
                          return 'bg-caution/20 text-caution'
                        case 'commission_adjustment':
                          return 'bg-purple-500/20 text-purple-400'
                        default:
                          return 'bg-slate-500/20 text-slate-400'
                      }
                    }

                    // Format type label
                    const getTypeLabel = () => {
                      if (entry.type === 'commission_adjustment') {
                        return 'Commission Adj.'
                      }
                      return entry.type.charAt(0).toUpperCase() + entry.type.slice(1)
                    }

                    return (
                      <tr
                        key={entry.entryId}
                        className="border-b border-dark-border/50 hover:bg-dark-tertiary/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {format(parseISO(entry.date), 'MM/dd/yyyy')}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${getTypeBadgeStyle()}`}
                          >
                            {isGenerated && <Repeat className="w-3 h-3" />}
                            {entry.type === 'commission_adjustment' && <Receipt className="w-3 h-3" />}
                            {getTypeLabel()}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-300">
                          {entry.description}
                          {entry.type === 'commission_adjustment' && entry.commissionMeta && (
                            <span className="block text-xs text-slate-400 mt-1">
                              {entry.commissionMeta.tradeCount && `${entry.commissionMeta.tradeCount} trades`}
                              {entry.commissionMeta.contractCount && `, ${entry.commissionMeta.contractCount} contracts`}
                              {entry.commissionMeta.startDate && ` (${entry.commissionMeta.startDate}`}
                              {entry.commissionMeta.endDate && ` - ${entry.commissionMeta.endDate})`}
                            </span>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-sm text-right font-semibold font-mono ${
                          displayAmount >= 0 ? 'text-profit' : 'text-loss'
                        }`}>
                          {formatCurrency(displayAmount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-mono text-slate-300">
                          {formatCurrency(entry.balance || 0)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {!isGenerated && (
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleEditEntry(entry)}
                                className="p-2 hover:bg-dark-border rounded transition-colors"
                              >
                                <Edit className="w-4 h-4 text-slate-400 hover:text-slate-200" />
                              </button>
                              <button
                                onClick={() => handleDeleteEntry(entry.entryId)}
                                className="p-2 hover:bg-dark-border rounded transition-colors"
                              >
                                <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-400" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
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
