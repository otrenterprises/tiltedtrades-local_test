import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { DistributionDataPoint } from '@/utils/chartHelpers'

interface WinLossDistributionProps {
  data: DistributionDataPoint[]
}

export function WinLossDistribution({ data }: WinLossDistributionProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-80 text-slate-400">
        No distribution data available
      </div>
    )
  }

  return (
    <div className="bg-dark-secondary border border-dark-border rounded-lg p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-slate-50 mb-1">Win/Loss Distribution</h3>
        <p className="text-sm text-slate-400">Distribution of trade outcomes</p>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="range"
            stroke="#94A3B8"
            tick={{ fill: '#94A3B8', fontSize: 10 }}
            angle={-45}
            textAnchor="end"
            height={80}
          />
          <YAxis
            stroke="#94A3B8"
            tick={{ fill: '#94A3B8', fontSize: 12 }}
            label={{ value: 'Number of Trades', angle: -90, position: 'insideLeft', fill: '#94A3B8' }}
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
              if (name === 'count') return [value, 'Trades']
              if (name === 'percentage') return [`${value.toFixed(1)}%`, 'Percentage']
              return [value, name]
            }}
          />
          <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
