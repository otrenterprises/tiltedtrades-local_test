/**
 * Environment configuration for TiltedTrades Local Test
 * Centralizes all environment variables and provides type-safe access
 * Structure matches production for easy migration to full AWS integration
 */

interface EnvironmentConfig {
  api: {
    baseUrl: string
    region: string
  }
  cognito: {
    userPoolId: string
    clientId: string
    identityPoolId?: string
  }
  s3: {
    bucketName: string
    region: string
  }
  app: {
    url: string
  }
  isDevelopment: boolean
  isProduction: boolean
}

export const config: EnvironmentConfig = {
  api: {
    baseUrl: import.meta.env.VITE_API_BASE_URL || '',
    region: import.meta.env.VITE_AWS_REGION || 'us-east-1'
  },
  cognito: {
    userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || 'us-east-1_VePlciWu5',
    clientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '78tbqlscvaa6lgomedi7001qfg',
    identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID
  },
  s3: {
    bucketName: import.meta.env.VITE_S3_BUCKET_NAME || '',
    region: import.meta.env.VITE_S3_REGION || 'us-east-1'
  },
  app: {
    url: import.meta.env.VITE_APP_URL || 'http://localhost:5173'
  },
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD
}

// Validate required configuration
const validateConfig = () => {
  const required = [
    { value: config.cognito.userPoolId, name: 'VITE_COGNITO_USER_POOL_ID' },
    { value: config.cognito.clientId, name: 'VITE_COGNITO_CLIENT_ID' }
  ]

  const missing = required.filter(item => !item.value)

  if (missing.length > 0) {
    console.warn(
      'Missing required environment variables:',
      missing.map(m => m.name).join(', '),
      '\nCheck .env.local file.'
    )
  }
}

// Only validate in development
if (config.isDevelopment) {
  validateConfig()
}

export default config
