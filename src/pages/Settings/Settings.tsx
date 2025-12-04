import React, { useState } from 'react'
import { Settings as SettingsIcon, User, Shield, Bell, Palette, Key, Info, ChevronDown, ChevronRight } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'
import { useNavigation } from '@/contexts/NavigationContext'
import GeneralPanel from './GeneralPanel'
import PreferencesPanel from './PreferencesPanel'
import PrivacyPanel from './PrivacyPanel'
import NotificationPanel from './NotificationPanel'
import SiteInfoPanel from './SiteInfoPanel'
import LoadingSpinner from '@/components/feedback/LoadingSpinner'
import ErrorMessage from '@/components/feedback/ErrorMessage'

type TabType = 'general' | 'preferences' | 'privacy' | 'notifications' | 'api' | 'siteinfo'

interface Tab {
  id: TabType
  label: string
  icon: React.ReactNode
  description: string
}

const tabs: Tab[] = [
  {
    id: 'general',
    label: 'General',
    icon: <User className="w-4 h-4" />,
    description: 'Profile information and account settings',
  },
  {
    id: 'preferences',
    label: 'Display & Trading',
    icon: <Palette className="w-4 h-4" />,
    description: 'Customize display preferences and trading calculations',
  },
  {
    id: 'privacy',
    label: 'Privacy',
    icon: <Shield className="w-4 h-4" />,
    description: 'Control your privacy and visibility settings',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: <Bell className="w-4 h-4" />,
    description: 'Manage email and platform notifications',
  },
  {
    id: 'api',
    label: 'API Keys',
    icon: <Key className="w-4 h-4" />,
    description: 'Manage API keys for external integrations',
  },
  {
    id: 'siteinfo',
    label: 'Site Info',
    icon: <Info className="w-4 h-4" />,
    description: 'Quick guide to TiltedTrades features',
  },
]

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabType>('general')
  const [expandedMobileSections, setExpandedMobileSections] = useState<Set<TabType>>(new Set())
  const { isExpanded } = useNavigation()
  const { profile, preferences, isLoading, error, updateProfile, updatePreferences, isUpdating } = useSettings()

  const toggleMobileSection = (tabId: TabType) => {
    setExpandedMobileSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(tabId)) {
        newSet.delete(tabId)
      } else {
        newSet.add(tabId)
      }
      return newSet
    })
  }

  if (isLoading) {
    return <LoadingSpinner fullScreen />
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ErrorMessage
          title="Failed to load settings"
          message={error instanceof Error ? error.message : 'An error occurred'}
        />
      </div>
    )
  }

  // Render panel content by tab id (used for both desktop and mobile)
  const renderPanelContent = (tabId: TabType) => {
    switch (tabId) {
      case 'general':
        return (
          <GeneralPanel
            profile={profile ?? undefined}
            onUpdate={updateProfile}
            isUpdating={isUpdating}
          />
        )
      case 'preferences':
        return (
          <PreferencesPanel
            preferences={preferences ?? undefined}
            onUpdate={updatePreferences}
            isUpdating={isUpdating}
          />
        )
      case 'privacy':
        return (
          <PrivacyPanel
            preferences={preferences ?? undefined}
            onUpdate={updatePreferences}
            isUpdating={isUpdating}
          />
        )
      case 'notifications':
        return (
          <NotificationPanel
            preferences={preferences ?? undefined}
            onUpdate={updatePreferences}
            isUpdating={isUpdating}
          />
        )
      case 'api':
        return (
          <div className="bg-dark-secondary rounded-lg p-4 md:p-6">
            <h3 className="text-base md:text-lg font-semibold text-white mb-3 md:mb-4">API Key Management</h3>
            <p className="text-sm text-gray-400 mb-4 md:mb-6">
              API keys allow you to integrate TiltedTrades with external applications and services.
            </p>
            <div className="bg-dark-tertiary rounded-lg p-4 md:p-6 border border-dark-border">
              <p className="text-sm text-gray-500 text-center">
                API key management coming soon. This feature will allow you to generate and manage
                API keys for programmatic access to your trading data.
              </p>
            </div>
          </div>
        )
      case 'siteinfo':
        return <SiteInfoPanel />
      default:
        return null
    }
  }

  return (
    <div className={`min-h-screen bg-dark text-white transition-all duration-300 ml-0 ${isExpanded ? 'md:ml-60' : 'md:ml-16'} pb-20 md:pb-0`}>
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-8">
        {/* Header */}
        <div className="mb-4 md:mb-8">
          <div className="flex items-center space-x-2 md:space-x-3 mb-1 md:mb-2">
            <SettingsIcon className="w-6 h-6 md:w-8 md:h-8 text-accent" />
            <h1 className="text-2xl md:text-3xl font-bold">Settings</h1>
          </div>
          <p className="text-sm md:text-base text-gray-400">Manage your account settings and preferences</p>
        </div>

        {/* ===== MOBILE: Accordion Layout (visible only on mobile) ===== */}
        <div className="md:hidden space-y-4">
          {tabs.map((tab) => {
            const isExpanded = expandedMobileSections.has(tab.id)
            return (
              <div key={tab.id} className="bg-dark-secondary rounded-lg overflow-hidden">
                {/* Section Header - Tappable */}
                <button
                  onClick={() => toggleMobileSection(tab.id)}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-dark-tertiary/30 transition-colors"
                >
                  <span className="text-accent">{tab.icon}</span>
                  <div className="flex-1">
                    <h2 className="font-medium text-white">{tab.label}</h2>
                    <p className="text-xs text-gray-500">{tab.description}</p>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  )}
                </button>
                {/* Section Content - Collapsible */}
                {isExpanded && (
                  <div className="p-0 border-t border-dark-border">
                    {renderPanelContent(tab.id)}
                  </div>
                )}
              </div>
            )
          })}

          {/* Account Info - Mobile */}
          {profile && (
            <div className="bg-dark-secondary rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-3">Account Info</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Member Since</span>
                  <span className="text-white">
                    {new Date(profile.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Trades</span>
                  <span className="text-white">{profile.totalTrades || 0}</span>
                </div>
                {profile.lastLoginAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Last Login</span>
                    <span className="text-white">
                      {new Date(profile.lastLoginAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ===== DESKTOP: Sidebar + Content Layout (hidden on mobile) ===== */}
        <div className="hidden md:grid md:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="md:col-span-1">
            <div className="bg-dark-secondary rounded-lg p-4">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-start space-x-3 px-3 py-3 rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-accent/10 text-accent'
                        : 'text-gray-400 hover:bg-dark-tertiary hover:text-white'
                    }`}
                  >
                    <span className="mt-0.5">{tab.icon}</span>
                    <div className="flex-1 text-left">
                      <div className="font-medium">{tab.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{tab.description}</div>
                    </div>
                  </button>
                ))}
              </nav>
            </div>

            {/* Quick Stats */}
            {profile && (
              <div className="bg-dark-secondary rounded-lg p-4 mt-4">
                <h3 className="text-sm font-medium text-gray-400 mb-3">Account Info</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Member Since</span>
                    <span className="text-white">
                      {new Date(profile.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total Trades</span>
                    <span className="text-white">{profile.totalTrades || 0}</span>
                  </div>
                  {profile.lastLoginAt && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Last Login</span>
                      <span className="text-white">
                        {new Date(profile.lastLoginAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Main Content Area */}
          <div className="md:col-span-3">
            {renderPanelContent(activeTab)}
          </div>
        </div>
      </div>
    </div>
  )
}
