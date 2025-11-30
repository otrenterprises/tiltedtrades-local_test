/**
 * Authentication Service
 * Handles all authentication operations with AWS Cognito
 */

import {
  signIn as amplifySignIn,
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  signOut as amplifySignOut,
  resetPassword as amplifyResetPassword,
  confirmResetPassword as amplifyConfirmResetPassword,
  getCurrentUser,
  fetchAuthSession,
  fetchUserAttributes,
  resendSignUpCode,
  autoSignIn,
  type SignInOutput
} from '@aws-amplify/auth'
import {
  User,
  AuthTokens,
  SignInParams,
  SignUpParams,
  ConfirmSignUpParams,
  ResetPasswordParams,
  ConfirmResetPasswordParams,
  AuthError,
  AuthErrorCode
} from '@/types/auth/auth.types'

class AuthService {
  /**
   * Sign in a user with email and password
   */
  async signIn({ email, password }: SignInParams): Promise<User> {
    try {
      const signInResult: SignInOutput = await amplifySignIn({
        username: email,
        password,
      })

      if (signInResult.isSignedIn) {
        const user = await this.getCurrentUser()
        return user
      }

      // Handle cases where additional steps are needed
      if (signInResult.nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
        throw new AuthError(
          'Please verify your email before signing in',
          AuthErrorCode.USER_NOT_CONFIRMED
        )
      }

      throw new AuthError('Sign in incomplete', AuthErrorCode.UNKNOWN_ERROR)
    } catch (error: any) {
      throw this.handleAuthError(error)
    }
  }

  /**
   * Sign up a new user
   */
  async signUp({ email, password, username }: SignUpParams): Promise<void> {
    try {
      const signUpResult = await amplifySignUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            preferred_username: username || email.split('@')[0]
          },
          autoSignIn: true // Automatically sign in after confirmation
        }
      })

      if (!signUpResult.isSignUpComplete) {
        // User needs to confirm email
        return
      }
    } catch (error: any) {
      throw this.handleAuthError(error)
    }
  }

  /**
   * Confirm user sign up with verification code
   */
  async confirmSignUp({ email, code }: ConfirmSignUpParams): Promise<User> {
    try {
      const confirmResult = await amplifyConfirmSignUp({
        username: email,
        confirmationCode: code
      })

      if (confirmResult.isSignUpComplete) {
        // In Amplify v6, autoSignIn may need to be called explicitly after confirmSignUp
        // if autoSignIn: true was set during signUp
        if (confirmResult.nextStep?.signUpStep === 'COMPLETE_AUTO_SIGN_IN') {
          try {
            const signInResult = await autoSignIn()
            if (signInResult.isSignedIn) {
              const user = await this.getCurrentUser()
              return user
            }
          } catch (autoSignInError: any) {
            // If autoSignIn fails because user is already signed in, that's fine
            // Just get the current user
            if (autoSignInError.message?.includes('already a signed in user') ||
                autoSignInError.name === 'UserAlreadyAuthenticatedException') {
              const user = await this.getCurrentUser()
              return user
            }
            throw autoSignInError
          }
        }

        // Check if user is already authenticated (autoSignIn may have happened automatically)
        const isAuth = await this.isAuthenticated()
        if (isAuth) {
          const user = await this.getCurrentUser()
          return user
        }

        // If not authenticated, the user needs to sign in manually
        throw new AuthError(
          'Email verified successfully. Please sign in with your credentials.',
          AuthErrorCode.USER_NOT_CONFIRMED
        )
      }

      throw new AuthError('Confirmation incomplete', AuthErrorCode.UNKNOWN_ERROR)
    } catch (error: any) {
      throw this.handleAuthError(error)
    }
  }

  /**
   * Resend confirmation code
   */
  async resendConfirmationCode(email: string): Promise<void> {
    try {
      await resendSignUpCode({
        username: email
      })
    } catch (error: any) {
      throw this.handleAuthError(error)
    }
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    try {
      await amplifySignOut()
    } catch (error: any) {
      throw this.handleAuthError(error)
    }
  }

  /**
   * Initiate password reset
   */
  async resetPassword({ email }: ResetPasswordParams): Promise<void> {
    try {
      await amplifyResetPassword({
        username: email
      })
    } catch (error: any) {
      throw this.handleAuthError(error)
    }
  }

  /**
   * Confirm password reset with code and new password
   */
  async confirmResetPassword({
    email,
    code,
    newPassword
  }: ConfirmResetPasswordParams): Promise<void> {
    try {
      await amplifyConfirmResetPassword({
        username: email,
        confirmationCode: code,
        newPassword
      })
    } catch (error: any) {
      throw this.handleAuthError(error)
    }
  }

  /**
   * Get the currently authenticated user
   */
  async getCurrentUser(): Promise<User> {
    try {
      const cognitoUser = await getCurrentUser()
      const attributes = await fetchUserAttributes()

      return {
        userId: cognitoUser.userId,
        email: attributes.email || '',
        emailVerified: attributes.email_verified === 'true',
        username: attributes.preferred_username,
        attributes: attributes as Record<string, string>
      }
    } catch (error: any) {
      throw this.handleAuthError(error)
    }
  }

  /**
   * Get current session tokens
   */
  async getTokens(): Promise<AuthTokens | null> {
    try {
      const session = await fetchAuthSession()

      if (!session.tokens) {
        return null
      }

      const { idToken, accessToken } = session.tokens

      return {
        idToken: idToken?.toString() || '',
        accessToken: accessToken?.toString() || '',
        refreshToken: '', // Refresh token is handled internally by Amplify
        expiresIn: 3600 // Default to 1 hour
      }
    } catch (error: any) {
      return null
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const session = await fetchAuthSession()
      return !!session.tokens
    } catch {
      return false
    }
  }

  /**
   * Get the ID token for API requests
   */
  async getIdToken(): Promise<string | null> {
    try {
      const session = await fetchAuthSession()
      return session.tokens?.idToken?.toString() || null
    } catch {
      return null
    }
  }

  /**
   * Handle and transform auth errors
   */
  private handleAuthError(error: any): AuthError {
    if (error instanceof AuthError) {
      return error
    }

    const errorCode = error.name || error.code || AuthErrorCode.UNKNOWN_ERROR
    let message = error.message || 'An error occurred during authentication'

    // Map common error codes to user-friendly messages
    switch (errorCode) {
      case 'UserNotFoundException':
        message = 'No account found with this email address'
        break
      case 'NotAuthorizedException':
        message = 'Incorrect email or password'
        break
      case 'CodeMismatchException':
        message = 'Invalid verification code'
        break
      case 'ExpiredCodeException':
        message = 'Verification code has expired'
        break
      case 'InvalidPasswordException':
        message = 'Password does not meet requirements'
        break
      case 'UserNotConfirmedException':
        message = 'Please verify your email address before signing in'
        break
      case 'UsernameExistsException':
        message = 'An account with this email already exists'
        break
      case 'TooManyRequestsException':
        message = 'Too many attempts. Please try again later'
        break
      case 'NetworkError':
        message = 'Network error. Please check your connection'
        break
    }

    return new AuthError(message, errorCode)
  }
}

// Export singleton instance
export const authService = new AuthService()

export default authService
