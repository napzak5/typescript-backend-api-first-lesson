import type {
  ApiAuthEmailVerificationConfirmRequest,
  ApiAuthEmailVerificationSendRequest,
  ApiAuthPasswordChangeRequest,
  ApiAuthPasswordForgotRequest,
  ApiAuthPasswordResetConfirmRequest,
  ApiAuthPasswordResetVerifyRequest,
  ApiAuthRegisterRequest,
  ApiAuthTwoFactorBackupCodesRequest,
  ApiAuthTwoFactorDisableRequest,
  ApiAuthTwoFactorEnableRequest,
  ApiAuthTwoFactorVerifyRequest,
} from '../../models/auth'

/** The token of a mail, as whoever holds it presents it. */
type PresentedToken = { token: string }

/**
 * API request → what the use cases of an account work with. Nothing is
 * converted and no row is made: an email, a password, a token and a code
 * are text, and none of them but the email is kept as it is presented. The
 * use case stores the hash of a new password, finds an account by the hash
 * of a token, and compares a password and a code with what is stored.
 */
export const UserWriteMapper = {
  /** The email and the password of the account that is registered. */
  fromRegisterRequest(request: ApiAuthRegisterRequest): {
    email: string
    password: string
  } {
    return { email: request.email, password: request.password }
  },

  /** The email the verification mail goes to. */
  fromEmailVerificationSendRequest(
    request: ApiAuthEmailVerificationSendRequest,
  ): { email: string } {
    return { email: request.email }
  },

  fromEmailVerificationConfirmRequest(
    request: ApiAuthEmailVerificationConfirmRequest,
  ): PresentedToken {
    return { token: request.token }
  },

  /** The email the mail of a password reset goes to. */
  fromPasswordForgotRequest(request: ApiAuthPasswordForgotRequest): {
    email: string
  } {
    return { email: request.email }
  },

  fromPasswordResetVerifyRequest(
    request: ApiAuthPasswordResetVerifyRequest,
  ): PresentedToken {
    return { token: request.token }
  },

  /** The token, and the password the account gets. */
  fromPasswordResetConfirmRequest(
    request: ApiAuthPasswordResetConfirmRequest,
  ): PresentedToken & { newPassword: string } {
    return { token: request.token, newPassword: request.newPassword }
  },

  /** The password that shows who asks, and the one that takes its place. */
  fromPasswordChangeRequest(request: ApiAuthPasswordChangeRequest): {
    currentPassword: string
    newPassword: string
  } {
    return {
      currentPassword: request.currentPassword,
      newPassword: request.newPassword,
    }
  },

  /** The password that shows who starts the setup of the second factor. */
  fromTwoFactorEnableRequest(request: ApiAuthTwoFactorEnableRequest): {
    password: string
  } {
    return { password: request.password }
  },

  /** The code of the authenticator app that confirms the setup. */
  fromTwoFactorVerifyRequest(request: ApiAuthTwoFactorVerifyRequest): {
    code: string
  } {
    return { code: request.code }
  },

  /** The password and the code that show who turns the second factor off. */
  fromTwoFactorDisableRequest(request: ApiAuthTwoFactorDisableRequest): {
    password: string
    code: string
  } {
    return { password: request.password, code: request.code }
  },

  /** The code that shows who asks for new backup codes. */
  fromTwoFactorBackupCodesRequest(
    request: ApiAuthTwoFactorBackupCodesRequest,
  ): { code: string } {
    return { code: request.code }
  },
}
