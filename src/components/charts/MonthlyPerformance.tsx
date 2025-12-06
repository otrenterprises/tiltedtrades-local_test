import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { MonthlyPerformanceDataPoint } from '@/utils/chartHelpers'
import { formatCurrency } from '@/utils/formatting/currency'

interface MonthlyPerformanceProps {
  data: MonthlyPerformanceDataPoint[]
}

export function MonthlyPerformance({ data }: MonthlyPerformanceProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-tertiary">
        No monthly data available
      </div>
    )
  }

  return (
    <div className="bg-secondary border border-theme rounded-lg p-4 md:p-6">
      <div className="mb-4 md:mb-6">
        <h3 className="text-base md:text-lg font-semibold text-primary mb-0.5 md:mb-1">Monthly Performance</h3>
        <p className="text-xs md:text-sm text-tertiary">P&L by month</p>
      </div>

      {/* Responsive chart height */}
      <div className="h-[180px] sm:h-[240px] md:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="month"
            stroke="#94A3B8"
            tick={{ fill: '#94A3B8', fontSize: 12 }}
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
              if (name === 'pl') return [formatCurrency(value), 'P&L']
              if (name === 'winRate') return [`${value.toFixed(1)}%`, 'Win Rate']
              return [value, name]
            }}
          />
          <Bar dataKey="pl" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.pl >= 0 ? '#10B981' : '#EF4444'} />
            ))}
          </Bar>
        </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 md:mt-4 flex items-center justify-between text-xs text-tertiary">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-profit rounded"></div>
            <span>Profitable Months</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-loss rounded"></div>
            <span>Loss Months</span>
          </div>
        </div>
        <span>{data.length} months total</span>
      </div>
    </div>
  )
}
