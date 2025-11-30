import { useForm } from 'react-hook-form'
import { User, Mail, Globe, FileText } from 'lucide-react'
import { UserProfile, UpdateProfileRequest } from '@/types/api/user.types'

interface GeneralPanelProps {
  profile?: UserProfile
  onUpdate: (updates: UpdateProfileRequest) => void
  isUpdating: boolean
}

export default function GeneralPanel({ profile, onUpdate, isUpdating }: GeneralPanelProps) {
  const { register, handleSubmit, formState: { errors } } = useForm<UpdateProfileRequest>({
    defaultValues: {
      displayName: profile?.displayName || '',
      bio: profile?.bio || '',
      isPublic: profile?.isPublic || false,
    },
  })

  const onSubmit = (data: UpdateProfileRequest) => {
    onUpdate(data)
  }

  if (!profile) return null

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white mb-2">General Settings</h2>
        <p className="text-gray-400 text-sm">
          Manage your profile information and account settings
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Email (Read-only) */}
        <div>
          <label className="block text-sm font-medium text-gray-400 mb-2">
            <Mail className="inline w-4 h-4 mr-2" />
            Email Address
          </label>
          <input
            type="email"
            value={profile.email}
            disabled
            className="w-full px-4 py-2 bg-gray-800 text-gray-500 rounded-lg border border-gray-700 cursor-not-allowed"
          />
          <p className="text-xs text-gray-500 mt-1">
            Email cannot be changed for security reasons
          </p>
        </div>

        {/* Display Name */}
        <div>
          <label htmlFor="displayName" className="block text-sm font-medium text-gray-400 mb-2">
            <User className="inline w-4 h-4 mr-2" />
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            {...register('displayName', {
              maxLength: { value: 50, message: 'Display name must be less than 50 characters' },
            })}
            placeholder="Enter your display name"
            className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors"
          />
          {errors.displayName && (
            <p className="text-red-400 text-sm mt-1">{errors.displayName.message}</p>
          )}
        </div>

        {/* Bio */}
        <div>
          <label htmlFor="bio" className="block text-sm font-medium text-gray-400 mb-2">
            <FileText className="inline w-4 h-4 mr-2" />
            Bio
          </label>
          <textarea
            id="bio"
            {...register('bio', {
              maxLength: { value: 500, message: 'Bio must be less than 500 characters' },
            })}
            rows={4}
            placeholder="Tell us about yourself..."
            className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:border-blue-500 focus:outline-none transition-colors resize-none"
          />
          {errors.bio && (
            <p className="text-red-400 text-sm mt-1">{errors.bio.message}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            This will be displayed on your public profile if enabled
          </p>
        </div>

        {/* Public Profile Toggle */}
        <div className="flex items-start space-x-3">
          <input
            type="checkbox"
            id="isPublic"
            {...register('isPublic')}
            className="mt-1 w-5 h-5 bg-gray-800 border-gray-700 rounded text-blue-500 focus:ring-blue-500 focus:ring-offset-0 focus:ring-offset-gray-900"
          />
          <div className="flex-1">
            <label htmlFor="isPublic" className="block text-sm font-medium text-white cursor-pointer">
              <Globe className="inline w-4 h-4 mr-2" />
              Make Profile Public
            </label>
            <p className="text-xs text-gray-500 mt-1">
              Allow other users to view your profile and trading statistics
            </p>
          </div>
        </div>

        {/* Account Stats */}
        <div className="border-t border-gray-800 pt-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Account Statistics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Total Trades</p>
              <p className="text-lg font-semibold text-white">{profile.totalTrades || 0}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Win Rate</p>
              <p className="text-lg font-semibold text-white">
                {profile.winRate ? `${(profile.winRate * 100).toFixed(1)}%` : 'N/A'}
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Total P&L</p>
              <p className={`text-lg font-semibold ${
                (profile.totalPL || 0) >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                ${Math.abs(profile.totalPL || 0).toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Profit Factor</p>
              <p className="text-lg font-semibold text-white">
                {profile.profitFactor?.toFixed(2) || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-3 pt-4">
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
            {isUpdating ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}