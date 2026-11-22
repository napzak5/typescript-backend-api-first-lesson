import { idOf, testApi } from '@beauty-salon-frontend/testing/api'
import * as z from 'zod'

/*
 * What the screen tests of the accounts arrange in the database, and read
 * back from it. The accounts of the seed data sign in with the password
 * of the seed; none of them is locked or has two factors.
 */

/** The ID of the account of an address of mail. */
export const userIdOf = async (email: string): Promise<string> =>
  idOf('select id::text from users where email = $1 and "deletedAt" is null', [
    email,
  ])

/** Lets wrong passwords have locked the account of the address ten minutes ago, for five minutes more. */
export const arrangeLock = (email: string): Promise<unknown> =>
  testApi().query(
    `update users set status = 'locked', "failedLoginAttempts" = 5,
                      "lockedUntil" = now() + interval '5 minutes'
     where email = $1`,
    [email],
  )

/** Lets the account of the address sign in with two factors. */
export const arrangeTwoFactor = (email: string): Promise<unknown> =>
  testApi().query(
    `update users set "twoFactorStatus" = 'enabled', "twoFactorSecret" = 'arranged',
                      "backupCodes" = '[]'::jsonb
     where email = $1`,
    [email],
  )

const storedSchema = z.array(
  z.object({
    status: z.string(),
    failedLoginAttempts: z.number(),
    locked: z.boolean(),
    twoFactorStatus: z.string(),
    secretKept: z.boolean(),
    backupCodesKept: z.boolean(),
  }),
)

/** What the account of the address keeps of its lock and of its second factor. */
export const storedAccountOf = async (email: string) =>
  storedSchema.parse(
    await testApi().query(
      `select status::text, "failedLoginAttempts",
              "lockedUntil" is not null as locked,
              "twoFactorStatus"::text as "twoFactorStatus",
              "twoFactorSecret" is not null as "secretKept",
              "backupCodes" is not null as "backupCodesKept"
       from users where email = $1`,
      [email],
    ),
  )

/** Lets the user have signed in meanwhile, which lifts the lock. */
export const unlockedMeanwhile = (email: string): Promise<unknown> =>
  testApi().query(
    `update users set status = 'active', "failedLoginAttempts" = 0, "lockedUntil" = null
     where email = $1`,
    [email],
  )

/** Lets the user have turned the second factor off meanwhile. */
export const twoFactorOffMeanwhile = (email: string): Promise<unknown> =>
  testApi().query(
    `update users set "twoFactorStatus" = 'disabled', "twoFactorSecret" = null,
                      "backupCodes" = null
     where email = $1`,
    [email],
  )

/** Lets the account of the address have been deleted meanwhile. */
export const deletedMeanwhile = (email: string): Promise<unknown> =>
  testApi().query('update users set "deletedAt" = now() where email = $1', [
    email,
  ])

const untilSchema = z.tuple([z.object({ until: z.string() })])

/** The moment the lock of the account of the address lasts until. */
export const lockedUntilOf = async (email: string): Promise<string> =>
  untilSchema.parse(
    await testApi().query(
      `select to_json("lockedUntil") #>> '{}' as until from users where email = $1`,
      [email],
    ),
  )[0].until

/** Lets a customer of the ledger have no account, as one whom a salon registered. */
export const arrangeNoAccount = async (email: string): Promise<void> => {
  await testApi().query(
    'update users set "customerId" = null where email = $1',
    [email],
  )
  await testApi().query(
    'update customers set "userId" = null where email = $1',
    [email],
  )
}
