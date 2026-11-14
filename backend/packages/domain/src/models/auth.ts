import type { sessions, users } from '@beauty-salon-backend/database'
import type { components, operations } from '@beauty-salon-backend/generated'
import {
  type DeepRequired,
  type Omit,
  Result,
} from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { type DomainError, parseWith, uuidSchema } from '../shared'
import { salonIdSchema } from './salon'

// IDs: UUIDs that have been checked.
export const userIdSchema = uuidSchema.brand<'UserId'>()
export type UserId = z.infer<typeof userIdSchema>

export const sessionIdSchema = uuidSchema.brand<'SessionId'>()
export type SessionId = z.infer<typeof sessionIdSchema>

export const staffIdSchema = uuidSchema.brand<'StaffId'>()
export type StaffId = z.infer<typeof staffIdSchema>

export const customerIdSchema = uuidSchema.brand<'CustomerId'>()
export type CustomerId = z.infer<typeof customerIdSchema>

const userIdParameterSchema = z.object({ userId: userIdSchema })

export const parseUserId = (userId: unknown): Result<UserId, DomainError> =>
  Result.map(
    parseWith(userIdParameterSchema, { userId }, 'Invalid user ID'),
    (parameters) => parameters.userId,
  )

const sessionIdParameterSchema = z.object({ sessionId: sessionIdSchema })

export const parseSessionId = (
  sessionId: unknown,
): Result<SessionId, DomainError> =>
  Result.map(
    parseWith(sessionIdParameterSchema, { sessionId }, 'Invalid session ID'),
    (parameters) => parameters.sessionId,
  )

// API types, generated from TypeSpec
export type ApiUserResponse = components['schemas']['Models.UserResponse']
export type ApiSessionResponse = components['schemas']['Models.SessionResponse']
export type ApiSessionSearchRequest = NonNullable<
  operations['SessionCrud_getSessions']['parameters']['query']
>
export type ApiAuthLoginRequest =
  components['schemas']['Models.AuthLoginRequest']
export type ApiAuthLoginResponse =
  components['schemas']['Models.AuthLoginResponse']
export type ApiAuthTokenRefreshRequest =
  components['schemas']['Models.AuthTokenRefreshRequest']
export type ApiAuthRegisterRequest =
  components['schemas']['Models.AuthRegisterRequest']
export type ApiAuthEmailVerificationSendRequest =
  components['schemas']['Models.AuthEmailVerificationSendRequest']
export type ApiAuthEmailVerificationConfirmRequest =
  components['schemas']['Models.AuthEmailVerificationConfirmRequest']
export type ApiAuthPasswordForgotRequest =
  components['schemas']['Models.AuthPasswordForgotRequest']
export type ApiAuthPasswordResetVerifyRequest =
  components['schemas']['Models.AuthPasswordResetVerifyRequest']
export type ApiAuthPasswordResetConfirmRequest =
  components['schemas']['Models.AuthPasswordResetConfirmRequest']
export type ApiAuthPasswordChangeRequest =
  components['schemas']['Models.AuthPasswordChangeRequest']
export type ApiAuthTwoFactorEnableRequest =
  components['schemas']['Models.AuthTwoFactorEnableRequest']
export type ApiAuthTwoFactorSetupResponse =
  components['schemas']['Models.AuthTwoFactorSetupResponse']
export type ApiAuthTwoFactorVerifyRequest =
  components['schemas']['Models.AuthTwoFactorVerifyRequest']
export type ApiAuthTwoFactorDisableRequest =
  components['schemas']['Models.AuthTwoFactorDisableRequest']
export type ApiAuthTwoFactorBackupCodesRequest =
  components['schemas']['Models.AuthTwoFactorBackupCodesRequest']
export type ApiAuthTwoFactorBackupCodesResponse =
  components['schemas']['Models.AuthTwoFactorBackupCodesResponse']

// Database types, inferred from the Drizzle schema
export type DbUser = DeepRequired<typeof users.$inferSelect>
export type DbSession = DeepRequired<typeof sessions.$inferSelect>

/** A session before it is stored; the database assigns `id` and `createdAt`. */
export type DbNewSession = DeepRequired<
  Omit<typeof sessions.$inferInsert, 'id' | 'createdAt'>
>

/**
 * A user as the authentication reads it: the row, and the salon of the staff
 * member the user is linked to. `staffSalonId` is null when the user has no
 * staff member, or when that staff member is deleted or inactive.
 */
export type UserAccount = {
  user: DbUser
  staffSalonId: string | null
}

export type SessionWithAccount = {
  session: DbSession
  account: UserAccount
}

/** What the tokens of a session become when they are issued again. */
export type SessionRotation = Pick<
  DbNewSession,
  'tokenHash' | 'refreshTokenHash' | 'expiresAt' | 'lastActivityAt'
>

/** Where a login came from; either part may be unknown. */
export type ClientInfo = {
  ipAddress: string | null
  userAgent: string | null
}

const salonRoleSchema = z.enum(['owner', 'manager', 'staff'])

/**
 * What an actor may reach:
 * - `platform`: every salon (role `admin`)
 * - `salon`: the salon of the actor's staff member (roles `owner`,
 *   `manager`, `staff`)
 * - `customer`: the actor's own customer record (role `customer`)
 * - `none`: a role without the record it needs, for example a staff user
 *   whose staff member was removed. Such a user can sign in and reach
 *   nothing that needs a scope.
 */
export const actorScopeSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('platform') }),
  z.object({
    type: z.literal('salon'),
    role: salonRoleSchema,
    salonId: salonIdSchema,
    staffId: staffIdSchema,
  }),
  z.object({ type: z.literal('customer'), customerId: customerIdSchema }),
  z.object({ type: z.literal('none') }),
])
export type ActorScope = z.infer<typeof actorScopeSchema>

/** The signed-in user on whose behalf a request runs. */
export const actorSchema = z.object({
  userId: userIdSchema,
  sessionId: sessionIdSchema,
  scope: actorScopeSchema,
})
export type Actor = z.infer<typeof actorSchema>
