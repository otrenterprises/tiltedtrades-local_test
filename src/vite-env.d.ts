/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENV: string
  readonly VITE_USE_LOCAL_DATA: string
  readonly VITE_AWS_REGION: string
  readonly VITE_COGNITO_USER_POOL_ID: string
  readonly VITE_COGNITO_CLIENT_ID: string
  readonly VITE_COGNITO_IDENTITY_POOL_ID?: string
  readonly VITE_API_BASE_URL: string
  readonly VITE_S3_BUCKET_NAME: string
  readonly VITE_S3_REGION: string
  readonly VITE_APP_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
