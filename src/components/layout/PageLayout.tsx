import { ReactNode } from 'react'
import { useNavigation } from '@/contexts/NavigationContext'

interface PageLayoutProps {
  children: ReactNode
  title?: string
  subtitle?: string | ReactNode
  actions?: ReactNode
  /** Mobile-only settings toggles displayed in header top-right */
  mobileSettings?: ReactNode
}

export function PageLayout({ children, title, subtitle, actions, mobileSettings }: PageLayoutProps) {
  const { isExpanded } = useNavigation()

  return (
    // ml-0 on mobile, sidebar margin on desktop
    // pb-20 on mobile for bottom nav clearance, pb-0 on desktop
    <div className={`min-h-screen bg-dark transition-all duration-300 ml-0 ${isExpanded ? 'md:ml-60' : 'md:ml-16'} pb-20 md:pb-0`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-8">
        {(title || subtitle || actions || mobileSettings) && (
          <div className="mb-4 md:mb-8">
            {/* Mobile: Title row with settings icons on right */}
            <div className="flex items-start justify-between gap-2 md:hidden">
              <div className="flex-1 min-w-0">
                {title && (
                  <h1 className="text-2xl font-bold text-slate-50 mb-1">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <div className="text-slate-400 text-sm">
                    {subtitle}
                  </div>
                )}
              </div>
              {mobileSettings && (
                <div className="flex-shrink-0 pt-1">
                  {mobileSettings}
                </div>
              )}
            </div>

            {/* Desktop: Original layout */}
            <div className="hidden md:flex md:flex-row md:items-start md:justify-between gap-4">
              <div>
                {title && (
                  <h1 className="text-3xl font-bold text-slate-50 mb-2">
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
                <div className="flex items-center gap-3 flex-wrap">
                  {actions}
                </div>
              )}
            </div>

            {/* Mobile actions (below title) */}
            {actions && (
              <div className="flex items-center gap-2 flex-wrap mt-3 md:hidden">
                {actions}
              </div>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
