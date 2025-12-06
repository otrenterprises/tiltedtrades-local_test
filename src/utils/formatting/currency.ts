/**
 * Format number as currency
 */
export function formatCurrency(amount: number, short: boolean = false): string {
  if (short && Math.abs(amount) >= 1000) {
    const absAmount = Math.abs(amount)
    const sign = amount < 0 ? '-' : ''
    if (absAmount >= 1000000) {
      return `${sign}$${(absAmount / 1000000).toFixed(1)}M`
    }
    if (absAmount >= 1000) {
      return `${sign}$${(absAmount / 1000).toFixed(1)}K`
    }
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

/**
 * Format P&L with color indication
 */
export function formatPL(amount: number): string {
  const formatted = formatCurrency(amount)
  return amount >= 0 ? `+${formatted}` : formatted
}

/**
 * Get color class for P&L
 */
export function getPLColor(amount: number): string {
  if (amount > 0) return 'text-profit'
  if (amount < 0) return 'text-loss'
  return 'text-tertiary'
}
