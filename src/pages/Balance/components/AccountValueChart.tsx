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
  )
}
