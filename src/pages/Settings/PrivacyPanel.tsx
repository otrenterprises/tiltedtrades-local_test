import { useForm } from 'react-hook-form'
import { Shield, Eye, EyeOff, Users, Trophy, ChartBar } from 'lucide-react'
import { UserPreferences, UpdatePreferencesRequest } from '@/types/api/user.types'

interface PrivacyPanelProps {
  preferences?: UserPreferences
  onUpdate: (updates: UpdatePreferencesRequest) => void
  isUpdating: boolean
}

export default function PrivacyPanel({ preferences, onUpdate, isUpdating }: PrivacyPanelProps) {
  const { register, handleSubmit } = useForm<UpdatePreferencesRequest>({
    defaultValues: {
      privacySettings: {
        showOnLeaderboard: preferences?.privacySettings?.showOnLeaderboard || false,
        showRealName: preferences?.privacySettings?.showRealName || false,
        showStats: preferences?.privacySettings?.showStats || false,
      },
    },
  })

  const onSubmit = (data: UpdatePreferencesRequest) => {
    onUpdate(data)
  }

  if (!preferences) return null

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-2">Privacy Settings</h2>
        <p className="text-gray-400 text-sm">
          Control what information is visible to other users
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Privacy Information */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <Shield className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-400 mb-1">
                Your Privacy Matters
              </h3>
              <p className="text-sm text-gray-300">
                We respect your privacy. All settings below are optional and you have full control
                over what information is shared publicly.
              </p>
            </div>
          </div>
        </div>

        {/* Leaderboard Visibility */}
        <div className="border-b border-gray-800 pb-6">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center">
            <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
            Leaderboard Settings
          </h3>

          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="showOnLeaderboard"
                {...register('privacySettings.showOnLeaderboard')}
                className="mt-1 w-5 h-5 bg-gray-800 border-gray-700 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-gray-900"
              />
              <div className="flex-1">
                <label htmlFor="showOnLeaderboard" className="block text-sm font-medium text-white cursor-pointer">
                  Appear on Public Leaderboard
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Allow your trading performance to be displayed on the public leaderboard
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="showRealName"
                {...register('privacySettings.showRealName')}
                className="mt-1 w-5 h-5 bg-gray-800 border-gray-700 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-gray-900"
              />
              <div className="flex-1">
                <label htmlFor="showRealName" className="block text-sm font-medium text-white cursor-pointer">
                  Display Real Name
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Show your real name instead of username on public profiles
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Visibility */}
        <div className="border-b border-gray-800 pb-6">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center">
            <ChartBar className="w-5 h-5 mr-2 text-green-400" />
            Statistics Visibility
          </h3>

          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="showStats"
                {...register('privacySettings.showStats')}
                className="mt-1 w-5 h-5 bg-gray-800 border-gray-700 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-gray-900"
              />
              <div className="flex-1">
                <label htmlFor="showStats" className="block text-sm font-medium text-white cursor-pointer">
                  Share Trading Statistics
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  Allow other users to view your trading statistics on your public profile
                </p>
              </div>
            </div>
          </div>

          {/* What's Shared */}
          <div className="mt-6 bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center">
              <Eye className="w-4 h-4 mr-2" />
              Information visible when statistics are shared:
            </h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                Total number of trades
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                Win rate percentage
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                Profit factor
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                Total P&L (if leaderboard is enabled)
              </li>
            </ul>
          </div>

          {/* What's Not Shared */}
          <div className="mt-4 bg-gray-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center">
              <EyeOff className="w-4 h-4 mr-2" />
              Information never shared publicly:
            </h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li className="flex items-center">
                <span className="w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                Individual trade details
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                Account numbers or broker information
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                Personal notes or journal entries
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-red-400 rounded-full mr-2"></span>
                Email address or contact information
              </li>
            </ul>
          </div>
        </div>

        {/* Data Sharing */}
        <div className="pb-6">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center">
            <Users className="w-5 h-5 mr-2 text-purple-400" />
            Data Usage
          </h3>

          <div className="bg-gray-800 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-3">
              We take your privacy seriously. Your data is:
            </p>
            <ul className="space-y-2 text-sm text-gray-500">
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                Encrypted at rest and in transit
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                Never sold to third parties
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                Only used to improve your trading experience
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                Deletable at any time upon request
              </li>
            </ul>
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
            {isUpdating ? 'Saving...' : 'Save Privacy Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}