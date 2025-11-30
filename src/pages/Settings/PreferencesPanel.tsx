import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Calculator, Globe, Calendar, DollarSign, Palette, BarChart3 } from 'lucide-react'
import { UserPreferences, UpdatePreferencesRequest } from '@/types/api/user.types'
import { getTimezones, getDateFormats, getCurrencies } from '@/hooks/useSettings'

interface PreferencesPanelProps {
  preferences?: UserPreferences
  onUpdate: (updates: UpdatePreferencesRequest) => void
  isUpdating: boolean
}

export default function PreferencesPanel({ preferences, onUpdate, isUpdating }: PreferencesPanelProps) {
  const { register, handleSubmit, watch } = useForm<UpdatePreferencesRequest>({
    defaultValues: {
      calculationMethod: preferences?.calculationMethod || 'fifo',
      commissionTier: preferences?.commissionTier || 'standard',
      timezone: preferences?.timezone || 'America/New_York',
      dateFormat: preferences?.dateFormat || 'MM/DD/YYYY',
      currency: preferences?.currency || 'USD',
      displayPreferences: {
        defaultView: preferences?.displayPreferences?.defaultView || 'overview',
        chartsPerPage: preferences?.displayPreferences?.chartsPerPage || 10,
        theme: preferences?.displayPreferences?.theme || 'dark',
      },
      riskSettings: {
        defaultRiskPerTrade: preferences?.riskSettings?.defaultRiskPerTrade || 2,
        maxDailyLoss: preferences?.riskSettings?.maxDailyLoss || 500,
      },
    },
  })

  const theme = watch('displayPreferences.theme')

  // Apply theme changes immediately for preview
  useEffect(() => {
    if (theme) {
      if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.classList.toggle('dark', prefersDark)
      } else {
        document.documentElement.classList.toggle('dark', theme === 'dark')
      }
    }
  }, [theme])

  const onSubmit = (data: UpdatePreferencesRequest) => {
    onUpdate(data)
  }

  if (!preferences) return null

  const timezones = getTimezones()
  const dateFormats = getDateFormats()
  const currencies = getCurrencies()

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-2">Display & Trading Preferences</h2>
        <p className="text-gray-400 text-sm">
          Customize how your trading data is calculated and displayed
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Trading Calculation Settings */}
        <div className="border-b border-gray-800 pb-6">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center">
            <Calculator className="w-5 h-5 mr-2 text-blue-400" />
            Trading Calculations
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Calculation Method */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                P&L Calculation Method
              </label>
              <select
                {...register('calculationMethod')}
                className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
              >
                <option value="fifo">FIFO (First In, First Out)</option>
                <option value="perPosition">Per Position</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Method used to calculate profit and loss
              </p>
            </div>

            {/* Commission Tier */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Commission Tier
              </label>
              <select
                {...register('commissionTier')}
                className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
              >
                <option value="retail">Retail ($1.00 per contract)</option>
                <option value="standard">Standard ($0.65 per contract)</option>
                <option value="professional">Professional ($0.50 per contract)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Commission rate for trade calculations
              </p>
            </div>
          </div>
        </div>

        {/* Display Settings */}
        <div className="border-b border-gray-800 pb-6">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center">
            <Palette className="w-5 h-5 mr-2 text-purple-400" />
            Display Settings
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Theme */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Theme
              </label>
              <select
                {...register('displayPreferences.theme')}
                className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
              >
                <option value="dark">Dark Mode</option>
                <option value="light">Light Mode</option>
                <option value="auto">Auto (System)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Choose your preferred color scheme
              </p>
            </div>

            {/* Default View */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Default Dashboard View
              </label>
              <select
                {...register('displayPreferences.defaultView')}
                className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
              >
                <option value="overview">Overview</option>
                <option value="trades">Recent Trades</option>
                <option value="stats">Statistics</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                What to show when you first log in
              </p>
            </div>

            {/* Charts Per Page */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Charts Per Page
              </label>
              <input
                type="number"
                {...register('displayPreferences.chartsPerPage', {
                  min: 5,
                  max: 50,
                  valueAsNumber: true
                })}
                className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
              />
              <p className="text-xs text-gray-500 mt-1">
                Number of charts to display per page (5-50)
              </p>
            </div>
          </div>
        </div>

        {/* Regional Settings */}
        <div className="border-b border-gray-800 pb-6">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center">
            <Globe className="w-5 h-5 mr-2 text-green-400" />
            Regional Settings
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Timezone */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                <Globe className="inline w-4 h-4 mr-1" />
                Timezone
              </label>
              <select
                {...register('timezone')}
                className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
              >
                {timezones.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Your local timezone for displaying dates
              </p>
            </div>

            {/* Date Format */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                Date Format
              </label>
              <select
                {...register('dateFormat')}
                className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
              >
                {dateFormats.map((format) => (
                  <option key={format.value} value={format.value}>
                    {format.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                How dates are displayed throughout the app
              </p>
            </div>

            {/* Currency */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                <DollarSign className="inline w-4 h-4 mr-1" />
                Currency
              </label>
              <select
                {...register('currency')}
                className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
              >
                {currencies.map((currency) => (
                  <option key={currency.value} value={currency.value}>
                    {currency.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Default currency for displaying values
              </p>
            </div>
          </div>
        </div>

        {/* Risk Management */}
        <div className="pb-6">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-red-400" />
            Risk Management
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Default Risk Per Trade */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Default Risk Per Trade (%)
              </label>
              <input
                type="number"
                step="0.5"
                {...register('riskSettings.defaultRiskPerTrade', {
                  min: 0.5,
                  max: 10,
                  valueAsNumber: true
                })}
                className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
              />
              <p className="text-xs text-gray-500 mt-1">
                Default risk percentage for position sizing
              </p>
            </div>

            {/* Max Daily Loss */}
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Max Daily Loss ($)
              </label>
              <input
                type="number"
                step="100"
                {...register('riskSettings.maxDailyLoss', {
                  min: 100,
                  valueAsNumber: true
                })}
                className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
              />
              <p className="text-xs text-gray-500 mt-1">
                Alert when daily loss exceeds this amount
              </p>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-800">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            disabled={isUpdating}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isUpdating}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isUpdating ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      </form>
    </div>
  )
}