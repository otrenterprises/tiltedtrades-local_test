/**
 * AWS Amplify Configuration
 * Configures Amplify for authentication (and future AWS services)
 */

import { Amplify } from 'aws-amplify'
import config from './environment'

// Build Cognito auth configuration
const authConfig: any = {
  userPoolId: config.cognito.userPoolId,
  userPoolClientId: config.cognito.clientId,
  signUpVerificationMethod: 'code' as const,
  loginWith: {
    email: true,
    username: false,
  },
  passwordFormat: {
    minLength: 8,
    requireLowercase: true,
    requireUppercase: true,
    requireNumbers: true,
    requireSpecialCharacters: true,
  }
}

// Only add identityPoolId if it exists (needed for S3/other AWS services)
if (config.cognito.identityPoolId) {
  authConfig.identityPoolId = config.cognito.identityPoolId
}

// Build AWS configuration object
const awsConfig: any = {
  Auth: {
    Cognito: authConfig
  }
}

// Add S3 config when bucket is configured (for future use)
if (config.s3.bucketName) {
  awsConfig.Storage = {
    S3: {
      bucket: config.s3.bucketName,
      region: config.s3.region,
    }
  }
}

// Configure Amplify
Amplify.configure(awsConfig)

export default awsConfig
