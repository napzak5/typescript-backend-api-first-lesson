import { Result } from '@beauty-salon-backend/utility'
import type { IPasswordHasher } from '../../../services/password-hasher'
import type { DomainError } from '../../../shared'
import { normalizeBackupCode } from './second-factor'

/** The name an authenticator app shows next to the codes of an account. */
const ISSUER = 'Beauty Salon'

/**
 * What an authenticator app reads, usually from a QR code, to add the
 * account (the "Key Uri Format" of Google Authenticator). The parameters
 * are the defaults of RFC 6238, which is what the apps assume.
 */
export const otpauthUri = (email: string, secret: string): string => {
  const parameters = Object.entries({
    secret,
    issuer: ISSUER,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  })
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('&')

  return `otpauth://totp/${encodeURIComponent(ISSUER)}:${encodeURIComponent(email)}?${parameters}`
}

/**
 * What is stored of backup codes. A code is shorter than a key, so it is
 * hashed like a password, with a salt and at a cost
 * (NIST SP 800-63B-4, 3.1.2.2).
 */
export const hashBackupCodes = async (
  passwordHasher: IPasswordHasher,
  backupCodes: string[],
): Promise<Result<string[], DomainError>> => {
  const hashes: string[] = []
  // One after the other, for the same reason they are compared that way.
  for (const backupCode of backupCodes) {
    const hashed = await passwordHasher.hash(normalizeBackupCode(backupCode))
    if (hashed.type === 'error') {
      return hashed
    }
    hashes.push(hashed.data)
  }

  return Result.success(hashes)
}
