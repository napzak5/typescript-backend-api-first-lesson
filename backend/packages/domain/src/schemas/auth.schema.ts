import { z } from 'zod'
import {
  type ApiAuthEmailVerificationConfirmRequest,
  type ApiAuthEmailVerificationSendRequest,
  type ApiAuthLoginRequest,
  type ApiAuthPasswordChangeRequest,
  type ApiAuthPasswordForgotRequest,
  type ApiAuthPasswordResetConfirmRequest,
  type ApiAuthPasswordResetVerifyRequest,
  type ApiAuthRegisterRequest,
  type ApiAuthTokenRefreshRequest,
  type ApiAuthTwoFactorBackupCodesRequest,
  type ApiAuthTwoFactorDisableRequest,
  type ApiAuthTwoFactorEnableRequest,
  type ApiAuthTwoFactorVerifyRequest,
  type ApiSessionSearchRequest,
  sessionIdSchema,
} from '../models/auth'
import type {
  ApiAuthStaffInvitationAcceptRequest,
  ApiAuthStaffInvitationJoinRequest,
  ApiAuthStaffInvitationVerifyRequest,
} from '../models/staff-invitation'
import { lowerCaseEmail, passwordOf } from './rules'

/**
 * Validation of authentication requests. The length limits are those of the
 * API. A password that is only presented is not held to the rules for new
 * passwords; which new passwords are refused as too easy to guess is decided
 * by the use case, which knows whose password it is.
 */

const MIN_NEW_PASSWORD_LENGTH = 15

/** A password a user presents to prove who they are. */
const presentedPasswordSchema = passwordOf(1)

/** A password a user chooses. */
const newPasswordSchema = passwordOf(MIN_NEW_PASSWORD_LENGTH)

/** A token that was mailed; what it must look like is not told. */
const mailedTokenSchema = z.string().min(1).max(255)

/** The code of an authenticator app, or a backup code typed in any spacing. */
const secondFactorCodeSchema = z.string().min(1).max(64)

/** The code of an authenticator app and nothing else. */
const appCodeSchema = z.string().regex(/^[0-9]{6}$/)

export const authLoginRequestSchema = z.strictObject({
  email: lowerCaseEmail,
  password: presentedPasswordSchema,
  rememberMe: z.boolean(),
  twoFactorCode: secondFactorCodeSchema.nullable(),
}) satisfies z.ZodType<ApiAuthLoginRequest>

export const authTokenRefreshRequestSchema = z.strictObject({
  refreshToken: z.string().min(1).max(255),
}) satisfies z.ZodType<ApiAuthTokenRefreshRequest>

export const authRegisterRequestSchema = z.strictObject({
  email: lowerCaseEmail,
  password: newPasswordSchema,
}) satisfies z.ZodType<ApiAuthRegisterRequest>

export const authEmailVerificationSendRequestSchema = z.strictObject({
  email: lowerCaseEmail,
}) satisfies z.ZodType<ApiAuthEmailVerificationSendRequest>

export const authEmailVerificationConfirmRequestSchema = z.strictObject({
  token: mailedTokenSchema,
}) satisfies z.ZodType<ApiAuthEmailVerificationConfirmRequest>

export const authPasswordForgotRequestSchema = z.strictObject({
  email: lowerCaseEmail,
}) satisfies z.ZodType<ApiAuthPasswordForgotRequest>

export const authPasswordResetVerifyRequestSchema = z.strictObject({
  token: mailedTokenSchema,
}) satisfies z.ZodType<ApiAuthPasswordResetVerifyRequest>

export const authPasswordResetConfirmRequestSchema = z.strictObject({
  token: mailedTokenSchema,
  newPassword: newPasswordSchema,
}) satisfies z.ZodType<ApiAuthPasswordResetConfirmRequest>

export const authStaffInvitationVerifyRequestSchema = z.strictObject({
  token: mailedTokenSchema,
}) satisfies z.ZodType<ApiAuthStaffInvitationVerifyRequest>

export const authStaffInvitationAcceptRequestSchema = z.strictObject({
  token: mailedTokenSchema,
  password: newPasswordSchema,
}) satisfies z.ZodType<ApiAuthStaffInvitationAcceptRequest>

export const authStaffInvitationJoinRequestSchema = z.strictObject({
  token: mailedTokenSchema,
}) satisfies z.ZodType<ApiAuthStaffInvitationJoinRequest>

export const authPasswordChangeRequestSchema = z.strictObject({
  currentPassword: presentedPasswordSchema,
  newPassword: newPasswordSchema,
}) satisfies z.ZodType<ApiAuthPasswordChangeRequest>

export const authTwoFactorEnableRequestSchema = z.strictObject({
  password: presentedPasswordSchema,
}) satisfies z.ZodType<ApiAuthTwoFactorEnableRequest>

export const authTwoFactorVerifyRequestSchema = z.strictObject({
  code: appCodeSchema,
}) satisfies z.ZodType<ApiAuthTwoFactorVerifyRequest>

export const authTwoFactorDisableRequestSchema = z.strictObject({
  password: presentedPasswordSchema,
  code: secondFactorCodeSchema,
}) satisfies z.ZodType<ApiAuthTwoFactorDisableRequest>

export const authTwoFactorBackupCodesRequestSchema = z.strictObject({
  code: secondFactorCodeSchema,
}) satisfies z.ZodType<ApiAuthTwoFactorBackupCodesRequest>

/** The cursor of a page is the ID of the last session of the page before. */
export const sessionSearchRequestSchema = z.strictObject({
  limit: z.number().int().min(1).max(100).exactOptional(),
  cursor: sessionIdSchema.exactOptional(),
}) satisfies z.ZodType<ApiSessionSearchRequest>

/** A query of the sessions that passed the rules of its own. */
export type SessionSearchRequest = z.infer<typeof sessionSearchRequestSchema>
