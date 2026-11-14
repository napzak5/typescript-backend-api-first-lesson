import { z } from 'zod'
import type {
  ApiAuthEmailVerificationConfirmRequest,
  ApiAuthEmailVerificationSendRequest,
  ApiAuthLoginRequest,
  ApiAuthPasswordChangeRequest,
  ApiAuthPasswordForgotRequest,
  ApiAuthPasswordResetConfirmRequest,
  ApiAuthPasswordResetVerifyRequest,
  ApiAuthRegisterRequest,
  ApiAuthTokenRefreshRequest,
} from '../models/auth'

/**
 * Validation of authentication requests. The length limits are those of the
 * API. A password that is only presented is not held to the rules for new
 * passwords; which new passwords are refused as too easy to guess is decided
 * by the use case, which knows whose password it is.
 */

/** Addresses are stored and compared in lower case. */
const emailSchema = z
  .email()
  .max(255)
  .transform((value) => value.toLowerCase())

const MAX_PASSWORD_LENGTH = 128
const MIN_NEW_PASSWORD_LENGTH = 15

/**
 * A password, in the one form it is hashed and compared in. The same text
 * can be typed as different sequences of code points; NFC makes them one.
 * Length counts code points, not UTF-16 units, so that a character outside
 * the basic plane counts once (NIST SP 800-63B-4, 3.1.1.2).
 */
const passwordOf = (minimum: number) =>
  z
    .string()
    .transform((value) => value.normalize('NFC'))
    .check((context) => {
      const length = [...context.value].length

      if (length < minimum) {
        context.issues.push({
          code: 'too_small',
          origin: 'string',
          minimum,
          inclusive: true,
          input: context.value,
          message: `Too small: expected string to have >=${minimum} characters`,
        })
      }
      if (length > MAX_PASSWORD_LENGTH) {
        context.issues.push({
          code: 'too_big',
          origin: 'string',
          maximum: MAX_PASSWORD_LENGTH,
          inclusive: true,
          input: context.value,
          message: `Too big: expected string to have <=${MAX_PASSWORD_LENGTH} characters`,
        })
      }
    })

/** A password a user presents to prove who they are. */
const presentedPasswordSchema = passwordOf(1)

/** A password a user chooses. */
const newPasswordSchema = passwordOf(MIN_NEW_PASSWORD_LENGTH)

/** A token that was mailed; what it must look like is not told. */
const mailedTokenSchema = z.string().min(1).max(255)

export const authLoginRequestSchema = z.strictObject({
  email: emailSchema,
  password: presentedPasswordSchema,
  rememberMe: z.boolean(),
  twoFactorCode: z.string().min(1).max(64).nullable(),
}) satisfies z.ZodType<ApiAuthLoginRequest>

export const authTokenRefreshRequestSchema = z.strictObject({
  refreshToken: z.string().min(1).max(255),
}) satisfies z.ZodType<ApiAuthTokenRefreshRequest>

export const authRegisterRequestSchema = z.strictObject({
  email: emailSchema,
  password: newPasswordSchema,
}) satisfies z.ZodType<ApiAuthRegisterRequest>

export const authEmailVerificationSendRequestSchema = z.strictObject({
  email: emailSchema,
}) satisfies z.ZodType<ApiAuthEmailVerificationSendRequest>

export const authEmailVerificationConfirmRequestSchema = z.strictObject({
  token: mailedTokenSchema,
}) satisfies z.ZodType<ApiAuthEmailVerificationConfirmRequest>

export const authPasswordForgotRequestSchema = z.strictObject({
  email: emailSchema,
}) satisfies z.ZodType<ApiAuthPasswordForgotRequest>

export const authPasswordResetVerifyRequestSchema = z.strictObject({
  token: mailedTokenSchema,
}) satisfies z.ZodType<ApiAuthPasswordResetVerifyRequest>

export const authPasswordResetConfirmRequestSchema = z.strictObject({
  token: mailedTokenSchema,
  newPassword: newPasswordSchema,
}) satisfies z.ZodType<ApiAuthPasswordResetConfirmRequest>

export const authPasswordChangeRequestSchema = z.strictObject({
  currentPassword: presentedPasswordSchema,
  newPassword: newPasswordSchema,
}) satisfies z.ZodType<ApiAuthPasswordChangeRequest>
