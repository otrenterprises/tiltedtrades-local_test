import { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  trend?: {
    value: number
    label?: string
  }
  icon?: ReactNode
  color?: 'profit' | 'loss' | 'accent' | 'caution' | 'premium' | 'neutral'
  className?: string
}

export function MetricCard({
  title,
  value,
  subtitle,
  trend,
  icon,
  color = 'neutral',
  className = '',
}: MetricCardProps) {
  const colorStyles = {
    profit: {
      bg: 'bg-profit-subtle border-profit/20',
      text: 'text-profit',
      icon: 'text-profit-light',
    },
    loss: {
      bg: 'bg-loss-subtle border-loss/20',
      text: 'text-loss',
      icon: 'text-loss-light',
    },
    accent: {
      bg: 'bg-accent/10 border-accent/20',
      text: 'text-accent',
      icon: 'text-accent-light',
    },
    caution: {
      bg: 'bg-caution/10 border-caution/20',
      text: 'text-caution',
      icon: 'text-caution-light',
    },
    premium: {
      bg: 'bg-premium/10 border-premium/20',
      text: 'text-premium',
      icon: 'text-premium-light',
    },
    neutral: {
      bg: 'bg-secondary border-theme',
      text: 'text-primary',
      icon: 'text-tertiary',
    },
  }

  const styles = colorStyles[color]

  return (
    <div
      className={`${styles.bg} border rounded-lg p-4 sm:p-6 transition-all hover:shadow-lg ${className}`}
    >
      <div className="flex items-start justify-between mb-3 sm:mb-4">
        <div className="flex-1 min-w-0">
          <p className="text-xs sm:text-sm font-medium text-tertiary mb-1 truncate">{title}</p>
        </div>
        {icon && <div className={`${styles.icon} flex-shrink-0 ml-2`}>{icon}</div>}
      </div>

      <div className="space-y-2">
        <div className={`text-xl sm:text-2xl lg:text-3xl font-bold font-mono ${styles.text} break-all`}>
          {value}
        </div>

        {(subtitle || trend) && (
          <div className="flex items-center justify-between gap-2">
            {subtitle && (
              <p className="text-xs text-muted truncate flex-1 min-w-0">{subtitle}</p>
            )}
            {trend && (
              <div className={`flex items-center gap-1 text-xs flex-shrink-0 ${
                trend.value > 0 ? 'text-profit' : trend.value < 0 ? 'text-loss' : 'text-tertiary'
              }`}>
                {trend.value > 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : trend.value < 0 ? (
                  <TrendingDown className="w-3 h-3" />
                ) : null}
                <span className="whitespace-nowrap">
                  {trend.value > 0 ? '+' : ''}
                  {trend.value.toFixed(1)}%
                  {trend.label && ` ${trend.label}`}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
