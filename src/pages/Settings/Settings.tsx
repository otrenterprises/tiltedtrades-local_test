import React, { useState } from 'react'
import { Settings as SettingsIcon, User, Shield, Bell, Palette, Key } from 'lucide-react'
import { useSettings } from '@/hooks/useSettings'
import { useNavigation } from '@/contexts/NavigationContext'
import GeneralPanel from './GeneralPanel'
import PreferencesPanel from './PreferencesPanel'
import PrivacyPanel from './PrivacyPanel'
import NotificationPanel from './NotificationPanel'
import LoadingSpinner from '@/components/feedback/LoadingSpinner'
import ErrorMessage from '@/components/feedback/ErrorMessage'

type TabType = 'general' | 'preferences' | 'privacy' | 'notifications' | 'api'

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
]

export default function Settings() {
  const [activeTab, setActiveTab] = useState<TabType>('general')
  const { isExpanded } = useNavigation()
  const { profile, preferences, isLoading, error, updateProfile, updatePreferences, isUpdating } = useSettings()

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

  const renderPanel = () => {
    switch (activeTab) {
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
          <div className="bg-gray-900 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-4">API Key Management</h3>
            <p className="text-gray-400 mb-6">
              API keys allow you to integrate TiltedTrades with external applications and services.
            </p>
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <p className="text-gray-500 text-center">
                API key management coming soon. This feature will allow you to generate and manage
                API keys for programmatic access to your trading data.
              </p>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div className={`min-h-screen bg-gray-950 text-white p-4 md:p-6 lg:p-8 transition-all duration-300 ${isExpanded ? 'ml-60' : 'ml-16'}`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <SettingsIcon className="w-8 h-8 text-blue-500" />
            <h1 className="text-3xl font-bold">Settings</h1>
          </div>
          <p className="text-gray-400">Manage your account settings and preferences</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-gray-900 rounded-lg p-4">
              <nav className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-start space-x-3 px-3 py-3 rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-500/10 text-blue-400'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
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
              <div className="bg-gray-900 rounded-lg p-4 mt-4">
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
          <div className="lg:col-span-3">
            {renderPanel()}
          </div>
        </div>
      </div>
    </div>
  )
}