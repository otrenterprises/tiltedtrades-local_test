import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatCurrency } from '@/utils/formatting/currency'

interface ChartDataPoint {
  date: string
  'Account Value': number
  'Funding': number
  'Trading P&L': number
}

interface AccountValueChartProps {
  chartData: ChartDataPoint[]
}

export function AccountValueChart({ chartData }: AccountValueChartProps) {
  if (chartData.length === 0) return null

  return (
    <div className="bg-dark-secondary border border-dark-border rounded-lg p-4 md:p-6">
      <h3 className="text-base md:text-lg font-semibold text-slate-50 mb-3 md:mb-4">Account Value History</h3>
      {/* Responsive chart height: smaller on mobile */}
      <ResponsiveContainer width="100%" height={200} className="md:!h-[300px]">
        <LineChart data={chartData} margin={{ top: 5, right: 5, left: -10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="date"
            stroke="#9CA3AF"
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis
            stroke="#9CA3AF"
            tick={{ fontSize: 10 }}
            width={50}
            tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{ backgroundColor: '#1F2937', border: 'none', fontSize: 12 }}
            labelStyle={{ color: '#9CA3AF' }}
            formatter={(value: number) => formatCurrency(value)}
          />
          {/* Hide default legend, use custom one below */}
          <Legend wrapperStyle={{ display: 'none' }} />
          <Line
            type="monotone"
            dataKey="Account Value"
            stroke="#3B82F6"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="Funding"
            stroke="#10B981"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="5 5"
          />
          <Line
            type="monotone"
            dataKey="Trading P&L"
            stroke="#F59E0B"
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="5 5"
          />
        </LineChart>
      </ResponsiveContainer>
      {/* Mobile: Wrap legend items, Desktop: Single row */}
      <div className="mt-3 md:mt-4 text-[10px] md:text-xs text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-2 md:gap-6">
        <div className="flex items-center gap-1.5 md:gap-2">
          <div className="w-5 md:w-8 h-0.5 bg-blue-500"></div>
          <span className="hidden sm:inline">Account Value (Funding + Trading P&L)</span>
          <span className="sm:hidden">Account Value</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <div className="w-5 md:w-8 h-0.5 bg-green-500" style={{ borderTop: '2px dashed' }}></div>
          <span className="hidden sm:inline">Funding Balance</span>
          <span className="sm:hidden">Funding</span>
        </div>
        <div className="flex items-center gap-1.5 md:gap-2">
          <div className="w-5 md:w-8 h-0.5 bg-amber-500" style={{ borderTop: '2px dashed' }}></div>
          <span className="hidden sm:inline">Cumulative Trading P&L</span>
          <span className="sm:hidden">Trading P&L</span>
        </div>
      </div>
    </div>
  )
}
