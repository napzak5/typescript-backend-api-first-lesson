import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import { otpauthUri } from '../../business-logic/auth/_shared/two-factor-setup'
import type {
  ApiAuthTwoFactorBackupCodesResponse,
  ApiAuthTwoFactorSetupResponse,
  ApiUserResponse,
  DbUser,
} from '../../models/auth'
import { type DomainError, parseStored } from '../../shared'
import { timestampSchema } from './columns'

/**
 * A row of `users` → API response. The columns that go out are named one by
 * one, so that a secret (the password hash, a token, the two-factor secret)
 * or a column added later never reaches a response by default.
 */

const convertedColumnsSchema = z.object({
  lastPasswordChange: timestampSchema.nullable(),
  lockedUntil: timestampSchema.nullable(),
  lastLoginAt: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
}) satisfies z.ZodType<
  Pick<
    ApiUserResponse,
    | 'lastPasswordChange'
    | 'lockedUntil'
    | 'lastLoginAt'
    | 'createdAt'
    | 'updatedAt'
  >
>

export const UserReadMapper = {
  toApiUser(user: DbUser): Result<ApiUserResponse, DomainError> {
    const {
      id,
      email,
      role,
      status,
      emailVerified,
      twoFactorStatus,
      failedLoginAttempts,
      lastLoginIp,
      customerId,
      staffId,
    } = user

    return Result.map(
      parseStored(
        convertedColumnsSchema,
        user,
        `Stored user ${user.id} does not match the API model`,
      ),
      (converted) => ({
        id,
        email,
        role,
        status,
        emailVerified,
        twoFactorStatus,
        failedLoginAttempts,
        lastLoginIp,
        customerId,
        staffId,
        ...converted,
      }),
    )
  },

  /**
   * What the start of a two-factor setup answers with, the only place the
   * secret and the backup codes are shown: the secret as it is, and as the
   * address an authenticator app reads from a QR code, which names the
   * account by its email.
   */
  toApiTwoFactorSetup(
    email: string,
    secret: string,
    backupCodes: string[],
  ): ApiAuthTwoFactorSetupResponse {
    return { qrCodeUrl: otpauthUri(email, secret), secret, backupCodes }
  },

  /** The new backup codes, shown this once. */
  toApiTwoFactorBackupCodes(
    backupCodes: string[],
  ): ApiAuthTwoFactorBackupCodesResponse {
    return { backupCodes }
  },
}
