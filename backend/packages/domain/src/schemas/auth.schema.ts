import { z } from 'zod'
import type {
  ApiAuthLoginRequest,
  ApiAuthTokenRefreshRequest,
} from '../models/auth'

/**
 * Validation of authentication requests. The length limits are those of the
 * API; a password is not checked against the rules for new passwords when it
 * is only presented.
 */

/** Addresses are stored and compared in lower case. */
const emailSchema = z
  .email()
  .max(255)
  .transform((value) => value.toLowerCase())

export const authLoginRequestSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(128),
  rememberMe: z.boolean(),
  twoFactorCode: z.string().min(1).max(64).nullable(),
}) satisfies z.ZodType<ApiAuthLoginRequest>

export const authTokenRefreshRequestSchema = z.strictObject({
  refreshToken: z.string().min(1).max(255),
}) satisfies z.ZodType<ApiAuthTokenRefreshRequest>
