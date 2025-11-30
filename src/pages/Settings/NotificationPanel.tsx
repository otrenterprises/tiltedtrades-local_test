import { useForm } from 'react-hook-form'
import { Bell, Mail, Upload, Calendar, TrendingUp, AlertCircle } from 'lucide-react'
import { UserPreferences, UpdatePreferencesRequest } from '@/types/api/user.types'

interface NotificationPanelProps {
  preferences?: UserPreferences
  onUpdate: (updates: UpdatePreferencesRequest) => void
  isUpdating: boolean
}

export default function NotificationPanel({ preferences, onUpdate, isUpdating }: NotificationPanelProps) {
  const { register, handleSubmit, watch } = useForm<UpdatePreferencesRequest>({
    defaultValues: {
      notifications: {
        email: preferences?.notifications?.email ?? true,
        uploadComplete: preferences?.notifications?.uploadComplete ?? true,
        weeklyReport: preferences?.notifications?.weeklyReport ?? false,
        monthlyReport: preferences?.notifications?.monthlyReport ?? true,
      },
    },
  })

  const emailEnabled = watch('notifications.email')

  const onSubmit = (data: UpdatePreferencesRequest) => {
    onUpdate(data)
  }

  if (!preferences) return null

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-2">Notification Preferences</h2>
        <p className="text-gray-400 text-sm">
          Manage how and when you receive notifications
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Email Notifications Master Toggle */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <input
              type="checkbox"
              id="email"
              {...register('notifications.email')}
              className="mt-1 w-5 h-5 bg-gray-700 border-gray-600 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-gray-900"
            />
            <div className="flex-1">
              <label htmlFor="email" className="block text-base font-medium text-white cursor-pointer flex items-center">
                <Mail className="w-5 h-5 mr-2 text-blue-400" />
                Enable Email Notifications
              </label>
              <p className="text-sm text-gray-500 mt-1">
                Receive important updates and reports via email
              </p>
            </div>
          </div>
        </div>

        {/* Individual Notification Settings */}
        <div className={`space-y-6 ${!emailEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          {/* Trading Activity */}
          <div className="border-b border-gray-800 pb-6">
            <h3 className="text-lg font-medium text-white mb-4 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-green-400" />
              Trading Activity
            </h3>

            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="uploadComplete"
                  {...register('notifications.uploadComplete')}
                  disabled={!emailEnabled}
                  className="mt-1 w-5 h-5 bg-gray-800 border-gray-700 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-gray-900 disabled:opacity-50"
                />
                <div className="flex-1">
                  <label htmlFor="uploadComplete" className="block text-sm font-medium text-white cursor-pointer flex items-center">
                    <Upload className="w-4 h-4 mr-2" />
                    File Upload Complete
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Get notified when your trade data has been processed
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Reports & Summaries */}
          <div className="border-b border-gray-800 pb-6">
            <h3 className="text-lg font-medium text-white mb-4 flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-purple-400" />
              Reports & Summaries
            </h3>

            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="weeklyReport"
                  {...register('notifications.weeklyReport')}
                  disabled={!emailEnabled}
                  className="mt-1 w-5 h-5 bg-gray-800 border-gray-700 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-gray-900 disabled:opacity-50"
                />
                <div className="flex-1">
                  <label htmlFor="weeklyReport" className="block text-sm font-medium text-white cursor-pointer">
                    Weekly Performance Summary
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Receive a summary of your trading performance every Monday
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  id="monthlyReport"
                  {...register('notifications.monthlyReport')}
                  disabled={!emailEnabled}
                  className="mt-1 w-5 h-5 bg-gray-800 border-gray-700 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-gray-900 disabled:opacity-50"
                />
                <div className="flex-1">
                  <label htmlFor="monthlyReport" className="block text-sm font-medium text-white cursor-pointer">
                    Monthly Performance Report
                  </label>
                  <p className="text-xs text-gray-500 mt-1">
                    Detailed monthly analysis sent on the 1st of each month
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Future Notifications (Coming Soon) */}
          <div className="pb-6">
            <h3 className="text-lg font-medium text-white mb-4 flex items-center">
              <Bell className="w-5 h-5 mr-2 text-yellow-400" />
              Coming Soon
            </h3>

            <div className="space-y-4 opacity-50">
              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  disabled
                  className="mt-1 w-5 h-5 bg-gray-800 border-gray-700 rounded text-gray-500 cursor-not-allowed"
                />
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-400">
                    Risk Alerts
                  </label>
                  <p className="text-xs text-gray-600 mt-1">
                    Get notified when you exceed daily loss limits
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  disabled
                  className="mt-1 w-5 h-5 bg-gray-800 border-gray-700 rounded text-gray-500 cursor-not-allowed"
                />
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-400">
                    Milestone Achievements
                  </label>
                  <p className="text-xs text-gray-600 mt-1">
                    Celebrate your trading milestones and achievements
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  disabled
                  className="mt-1 w-5 h-5 bg-gray-800 border-gray-700 rounded text-gray-500 cursor-not-allowed"
                />
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-400">
                    Leaderboard Updates
                  </label>
                  <p className="text-xs text-gray-600 mt-1">
                    Get notified when your ranking changes significantly
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Email Delivery Info */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-blue-400 mb-1">
                Email Delivery
              </h4>
              <p className="text-sm text-gray-300">
                Notifications are sent to {preferences?.userId ? 'your registered email' : 'the email associated with your account'}.
                Please check your spam folder if you're not receiving emails.
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
            {isUpdating ? 'Saving...' : 'Save Notification Settings'}
          </button>
        </div>
      </form>
    </div>
  )
}