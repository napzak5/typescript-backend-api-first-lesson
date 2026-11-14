import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type { DbUser } from '../../../models/auth'
import { type DomainError, DomainErrors } from '../../../shared'
import type { AuthUseCaseDependencies } from './dependencies'
import { countWrongGuess } from './guess-limit'
import { isLocked } from './session-policy'

type SecondFactorDependencies = Pick<
  AuthUseCaseDependencies,
  'userRepository' | 'passwordHasher' | 'twoFactorAuthenticator'
>

export type SecondFactorCheck =
  /**
   * `backupCodesLeft`: how many backup codes the user has after this one
   * was used up; null when the code came from the authenticator app.
   */
  { type: 'accepted'; backupCodesLeft: number | null } | { type: 'refused' }

/** What the authenticator app shows. */
const APP_CODE = /^[0-9]{6}$/

/** A backup code without the hyphens it is shown with. */
const BACKUP_CODE = /^[A-Z2-7]{16}$/

/**
 * A backup code as it is hashed and compared: users copy it from a note,
 * in whatever case and spacing. Only the letters a code is made of change
 * case: upper-casing the whole text would turn other letters into them too
 * (`ı` into `I`, `ſ` into `S`).
 */
export const normalizeBackupCode = (typed: string): string =>
  typed
    .replace(/[\s-]/g, '')
    .replace(/[a-z]/g, (letter) => letter.toUpperCase())

const storedBackupCodesSchema = z.array(z.string())

const storedBackupCodes = (user: DbUser): Result<string[], DomainError> => {
  const parsed = storedBackupCodesSchema.safeParse(user.backupCodes)

  return parsed.success
    ? Result.success(parsed.data)
    : Result.error(
        DomainErrors.database(
          `The stored backup codes of user ${user.id} are not a list of hashes`,
          parsed.error,
        ),
      )
}

/** Accepts the code of the app when it is right and its time step was not used before. */
const acceptAppCode = async (
  { userRepository, twoFactorAuthenticator }: SecondFactorDependencies,
  user: DbUser,
  sealedSecret: string,
  code: string,
  now: Date,
): Promise<Result<SecondFactorCheck, DomainError>> => {
  const step = twoFactorAuthenticator.matchingStep(sealedSecret, code, now)
  if (step === null) {
    return Result.success({ type: 'refused' })
  }

  return Result.map(
    await userRepository.useTwoFactorStep(user.id, sealedSecret, step),
    (used) =>
      used ? { type: 'accepted', backupCodesLeft: null } : { type: 'refused' },
  )
}

/** Accepts a backup code the user still holds, and uses it up. */
const acceptBackupCode = async (
  { userRepository, passwordHasher }: SecondFactorDependencies,
  user: DbUser,
  typed: string,
): Promise<Result<SecondFactorCheck, DomainError>> => {
  const code = normalizeBackupCode(typed)
  if (!BACKUP_CODE.test(code)) {
    return Result.success({ type: 'refused' })
  }
  const stored = storedBackupCodes(user)
  if (stored.type === 'error') {
    return stored
  }

  // One after the other: every comparison is a password hash, and ten at
  // once would take ten times its memory.
  for (const backupCodeHash of stored.data) {
    const verified = await passwordHasher.verify(code, backupCodeHash)
    if (verified.type === 'error') {
      return verified
    }
    if (verified.data.type === 'match') {
      return Result.map(
        await userRepository.useBackupCode(user.id, backupCodeHash),
        (left) =>
          left === null
            ? { type: 'refused' }
            : { type: 'accepted', backupCodesLeft: left },
      )
    }
  }

  return Result.success({ type: 'refused' })
}

const checkCode = async (
  dependencies: SecondFactorDependencies,
  user: DbUser,
  now: Date,
  accept: (
    sealedSecret: string,
  ) => Promise<Result<SecondFactorCheck, DomainError>>,
): Promise<Result<SecondFactorCheck, DomainError>> => {
  if (isLocked(user, now) || user.twoFactorSecret === null) {
    return Result.success({ type: 'refused' })
  }

  const checked = await accept(user.twoFactorSecret)
  if (checked.type === 'error' || checked.data.type === 'accepted') {
    return checked
  }

  const counted = await countWrongGuess(
    dependencies.userRepository,
    user.id,
    now,
  )
  return counted.type === 'error'
    ? counted
    : Result.success({ type: 'refused' })
}

/**
 * Checks a code of the authenticator app against the secret the user holds,
 * whether two-factor authentication is enabled or still being set up. A
 * code is accepted once. The check is under the same limit on guesses as
 * the password: a wrong code counts, and nothing is accepted while the
 * account is locked.
 */
export const checkAppCode = (
  dependencies: SecondFactorDependencies,
  user: DbUser,
  code: string,
  now: Date,
): Promise<Result<SecondFactorCheck, DomainError>> =>
  checkCode(dependencies, user, now, (sealedSecret) =>
    APP_CODE.test(code)
      ? acceptAppCode(dependencies, user, sealedSecret, code, now)
      : Promise.resolve(Result.success({ type: 'refused' })),
  )

/**
 * Checks the second factor of a user: a code of the authenticator app, or
 * one of the backup codes, which is used up by this. Under the same limit
 * on guesses as `checkAppCode`.
 */
export const checkSecondFactor = (
  dependencies: SecondFactorDependencies,
  user: DbUser,
  code: string,
  now: Date,
): Promise<Result<SecondFactorCheck, DomainError>> =>
  checkCode(dependencies, user, now, (sealedSecret) =>
    APP_CODE.test(code)
      ? acceptAppCode(dependencies, user, sealedSecret, code, now)
      : acceptBackupCode(dependencies, user, code),
  )
