/**
 * Authentication type definitions
 */

export interface User {
  userId: string
  email: string
  emailVerified: boolean
  username?: string
  attributes?: Record<string, string>
}

export interface AuthTokens {
  idToken: string
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface SignUpParams {
  email: string
  password: string
  username?: string
}

export interface SignInParams {
  email: string
  password: string
}

export interface ConfirmSignUpParams {
  email: string
  code: string
}

export interface ResetPasswordParams {
  email: string
}

export interface ConfirmResetPasswordParams {
  email: string
  code: string
  newPassword: string
}

export interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

export interface AuthContextValue extends AuthState {
  signIn: (params: SignInParams) => Promise<void>
  signUp: (params: SignUpParams) => Promise<void>
  confirmSignUp: (params: ConfirmSignUpParams) => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (params: ResetPasswordParams) => Promise<void>
  confirmResetPassword: (params: ConfirmResetPasswordParams) => Promise<void>
  clearError: () => void
}

export class AuthError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'AuthError'
    this.code = code
  }
}

export enum AuthErrorCode {
  USER_NOT_FOUND = 'UserNotFoundException',
  NOT_AUTHORIZED = 'NotAuthorizedException',
  CODE_MISMATCH = 'CodeMismatchException',
  EXPIRED_CODE = 'ExpiredCodeException',
  INVALID_PASSWORD = 'InvalidPasswordException',
  USER_NOT_CONFIRMED = 'UserNotConfirmedException',
  USERNAME_EXISTS = 'UsernameExistsException',
  TOO_MANY_REQUESTS = 'TooManyRequestsException',
  NETWORK_ERROR = 'NetworkError',
  UNKNOWN_ERROR = 'UnknownError'
}