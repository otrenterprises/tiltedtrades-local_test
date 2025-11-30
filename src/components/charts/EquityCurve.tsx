import { useState, useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { EquityCurveDataPoint } from '@/utils/chartHelpers'
import { formatCurrency } from '@/utils/formatting/currency'
import { ChevronDown } from 'lucide-react'

interface EquityCurveProps {
  data: EquityCurveDataPoint[]
}

type TimeGrouping = 'trade' | 'day' | 'week' | 'month'

export function EquityCurve({ data }: EquityCurveProps) {
  const [timeGrouping, setTimeGrouping] = useState<TimeGrouping>('trade')
  const [showDropdown, setShowDropdown] = useState(false)

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-slate-400">
        No trade data available
      </div>
    )
  }

  const maxValue = Math.max(...data.map((d) => d.cumulative))
  const isProfit = data[data.length - 1]?.cumulative >= 0

  // Group data based on selected time period
  const groupedData = useMemo(() => {
    if (timeGrouping === 'trade') {
      return data
    }

    const grouped = new Map<string, EquityCurveDataPoint>()

    data.forEach((point) => {
      const date = new Date(point.date)
      let key: string
      let displayDate: string

      if (timeGrouping === 'day') {
        // Group by full date yyyy-mm-dd
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        key = `${year}-${month}-${day}`
        displayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      } else if (timeGrouping === 'week') {
        // Get week start (Sunday)
        const dayOfWeek = date.getDay()
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - dayOfWeek)
        const year = weekStart.getFullYear()
        const month = String(weekStart.getMonth() + 1).padStart(2, '0')
        const day = String(weekStart.getDate()).padStart(2, '0')
        key = `${year}-${month}-${day}`
        displayDate = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      } else {
        // month
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        key = `${year}-${month}`
        displayDate = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      }

      // Keep the last (most recent) cumulative value for each period
      grouped.set(key, {
        date: displayDate,
        cumulative: point.cumulative,
        pl: point.pl,
        trades: point.trades
      })
    })

    // Sort by key (which is in yyyy-mm-dd format) for chronological order
    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([_, value]) => value)
  }, [data, timeGrouping])

  const timeGroupingLabels = {
    trade: 'By Trade',
    day: 'By Day',
    week: 'By Week',
    month: 'By Month'
  }

  return (
    <div className="bg-dark-secondary border border-dark-border rounded-lg p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-50 mb-1">Equity Curve</h3>
          <p className="text-sm text-slate-400">Cumulative P&L over time</p>
        </div>

        {/* Time Grouping Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-2 px-3 py-2 bg-dark-tertiary border border-dark-border rounded-lg text-sm text-slate-300 hover:bg-dark-border transition-colors"
          >
            {timeGroupingLabels[timeGrouping]}
            <ChevronDown className="w-4 h-4" />
          </button>

          {showDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDropdown(false)}
              />
              <div className="absolute right-0 mt-2 w-40 bg-dark-tertiary border border-dark-border rounded-lg shadow-xl z-20">
                {(['trade', 'day', 'week', 'month'] as TimeGrouping[]).map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      setTimeGrouping(option)
                      setShowDropdown(false)
                    }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors first:rounded-t-lg last:rounded-b-lg ${
                      timeGrouping === option
                        ? 'bg-blue-900 text-blue-200'
                        : 'text-slate-300 hover:bg-dark-border'
                    }`}
                  >
                    {timeGroupingLabels[option]}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={groupedData} margin={{ top: 10, right: 30, left: 10, bottom: 0 }}>
            <defs>
              <linearGradient id="colorPL" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="#60A5FA"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="#60A5FA"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="date"
              stroke="#94A3B8"
              tick={{ fill: '#94A3B8', fontSize: 12 }}
              tickFormatter={(value) => {
                const [month, day] = value.split(' ')
                return `${month} ${day}`
              }}
            />
            <YAxis
              stroke="#94A3B8"
              tick={{ fill: '#94A3B8', fontSize: 12 }}
              tickFormatter={(value) => formatCurrency(value, true)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1E293B',
                border: '1px solid #475569',
                borderRadius: '8px',
                padding: '12px',
              }}
              labelStyle={{ color: '#F8FAFC', fontWeight: 600, marginBottom: '8px' }}
              itemStyle={{ color: '#CBD5E1' }}
              formatter={(value: number, name: string) => {
                if (name === 'cumulative') return [formatCurrency(value), 'Cumulative P&L']
                if (name === 'pl') return [formatCurrency(value), 'Trade P&L']
                return [value, name]
              }}
            />
            <Area
              type="monotone"
              dataKey="cumulative"
              stroke="#60A5FA"
              strokeWidth={2}
              fill="url(#colorPL)"
              activeDot={{ r: 6 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-slate-400 mb-1">Starting</p>
          <p className="text-sm font-semibold text-slate-300">$0.00</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Peak</p>
          <p className="text-sm font-semibold text-profit">{formatCurrency(maxValue)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-1">Current</p>
          <p className={`text-sm font-semibold ${isProfit ? 'text-profit' : 'text-loss'}`}>
            {formatCurrency(data[data.length - 1]?.cumulative || 0)}
          </p>
        </div>
      </div>
    </div>
  )
}
