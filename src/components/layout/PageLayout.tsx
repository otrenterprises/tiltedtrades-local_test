import { ReactNode } from 'react'
import { useNavigation } from '@/contexts/NavigationContext'

interface PageLayoutProps {
  children: ReactNode
  title?: string
  subtitle?: string
  actions?: ReactNode
}

export function PageLayout({ children, title, subtitle, actions }: PageLayoutProps) {
  const { isExpanded } = useNavigation()

  return (
    <div className={`min-h-screen bg-dark transition-all duration-300 ${isExpanded ? 'ml-60' : 'ml-16'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {(title || subtitle || actions) && (
          <div className="mb-8">
            <div className="flex items-start justify-between">
              <div>
                {title && (
                  <h1 className="text-3xl font-bold text-slate-50 mb-2">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="text-slate-400 text-sm">
                    {subtitle}
                  </p>
                )}
              </div>
              {actions && (
                <div className="flex items-center gap-3">
                  {actions}
                </div>
              )}
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
