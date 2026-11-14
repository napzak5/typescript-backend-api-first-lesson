import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type { ApiUserResponse, DbUser } from '../../models/auth'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { timestampSchema } from './columns'

/**
 * A row of `users` → API response. The columns that go out are named one by
 * one, so that a secret (the password hash, a token, the two-factor secret)
 * or a column added later never reaches a response by default.
 */

const convertedColumnsSchema = z.object({
  permissions: z.array(z.string()),
  trustedIpAddresses: z.array(z.string()).nullable(),
  lastPasswordChange: timestampSchema.nullable(),
  lockedUntil: timestampSchema.nullable(),
  lastLoginAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export const UserReadMapper = {
  toApiUser(user: DbUser): Result<ApiUserResponse, DomainError> {
    const {
      id,
      email,
      role,
      status,
      emailVerified,
      twoFactorEnabled,
      twoFactorStatus,
      failedLoginAttempts,
      lastLoginIp,
      customerId,
      staffId,
    } = user

    return Result.mapError(
      Result.map(
        parseWith(convertedColumnsSchema, user, 'Invalid stored user'),
        (converted) => ({
          id,
          email,
          role,
          status,
          emailVerified,
          twoFactorEnabled,
          twoFactorStatus,
          failedLoginAttempts,
          lastLoginIp,
          customerId,
          staffId,
          ...converted,
        }),
      ),
      // The request was fine; the stored row is not.
      (error) =>
        DomainErrors.database(
          `Stored user ${user.id} does not match the API model`,
          error,
        ),
    )
  },
}
