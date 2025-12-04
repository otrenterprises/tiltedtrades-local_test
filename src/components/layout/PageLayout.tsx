import { ReactNode } from 'react'
import { useNavigation } from '@/contexts/NavigationContext'

interface PageLayoutProps {
  children: ReactNode
  title?: string
  subtitle?: string | ReactNode
  actions?: ReactNode
}

export function PageLayout({ children, title, subtitle, actions }: PageLayoutProps) {
  const { isExpanded } = useNavigation()

  return (
    // ml-0 on mobile, sidebar margin on desktop
    // pb-20 on mobile for bottom nav clearance, pb-0 on desktop
    <div className={`min-h-screen bg-dark transition-all duration-300 ml-0 ${isExpanded ? 'md:ml-60' : 'md:ml-16'} pb-20 md:pb-0`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-8">
        {(title || subtitle || actions) && (
          <div className="mb-4 md:mb-8">
            {/* Stack on mobile, side-by-side on desktop */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
              <div>
                {title && (
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-50 mb-1 md:mb-2">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <div className="text-slate-400 text-sm">
                    {subtitle}
                  </div>
                )}
              </div>
              {actions && (
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
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
