import { afterEach, describe, expect, it, vi } from 'vitest'
import * as z from 'zod'
import { CUSTOMER, STYLIST, TOKYO } from '../fixtures/seed'
import {
  giveBack,
  refuse,
  takeAway,
  unreadable,
  whenAskedFor,
} from './failures'
import { idOf, salonIdOf, testApi } from './test-api'

/*
 * What these tests read of the answers of the API is not checked against the
 * types generated from the contract: this package cannot depend on the API
 * client (see `test-api.integration.test.ts`).
 */
const signedInSchema = z.object({
  data: z.object({ accessToken: z.string() }),
})

/** The status the API answers a request of `path` with, as an account signed in with `accessToken`. */
const statusOf = async (path: string, accessToken = ''): Promise<number> =>
  (
    await fetch(`${testApi().origin}/api/v1${path}`, {
      headers:
        accessToken === '' ? {} : { Authorization: `Bearer ${accessToken}` },
    })
  ).status

/** Signs an account of the seed data in; the test fails when the API does not let it. */
const accessTokenOf = async (email: string): Promise<string> => {
  const answer = await fetch(`${testApi().origin}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password: testApi().seedPassword,
      rememberMe: false,
      twoFactorCode: null,
    }),
  })
  expect(answer.status).toBe(200)

  return signedInSchema.parse(await answer.json()).data.accessToken
}

const lastSignInOf = async (email: string): Promise<unknown> =>
  testApi().query(
    `select "lastLoginAt"::text as moment from users where email = $1`,
    [email],
  )

describe('how a test makes the API fail', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should let the database refuse what it was told to, and write the rest', async () => {
    // Arrange
    const salonId = await salonIdOf(TOKYO)

    // Act
    await refuse('update', 'salons')

    // Assert
    await expect(
      testApi().query(`update salons set name = name where id = $1`, [salonId]),
    ).rejects.toThrow('refused by the test')
    expect(
      await testApi().query(
        `update services set name = name where "salonId" = $1 returning id`,
        [salonId],
      ),
    ).not.toEqual([])
  })

  it('should let the database refuse writes to two tables', async () => {
    // Act
    await refuse('insert', 'salons')
    await refuse('insert', 'services')

    // Assert
    await expect(
      testApi().query(`insert into salons select * from salons limit 1`),
    ).rejects.toThrow('refused by the test')
    await expect(
      testApi().query(`insert into services select * from services limit 1`),
    ).rejects.toThrow('refused by the test')
  })

  it('should take a table away, which the API answers an error of the server for, and give it back', async () => {
    // Act
    await takeAway('salons')

    // Assert
    expect(await statusOf('/salons')).toBe(500)
    await giveBack('salons')
    expect(await statusOf('/salons')).toBe(200)
  })

  it('should take a column away, and leave what reads the others as it was', async () => {
    // Arrange
    await takeAway('staff', 'bio')

    // Act: the sign-in reads the columns of `staff` that are there
    const accessToken = await accessTokenOf(STYLIST)

    // Assert
    expect(await statusOf('/staff-profiles/me', accessToken)).toBe(500)
    await giveBack('staff', 'bio')
    expect(await statusOf('/staff-profiles/me', accessToken)).toBe(200)
  })

  it('should change the database the moment a request is sent, the first time only, and send it then', async () => {
    // Arrange
    const tokyo = await salonIdOf(TOKYO)
    whenAskedFor(`GET /salons/${tokyo}`, () => takeAway('salons'))

    // Act: another request leaves the database as it is
    const list = await statusOf('/salons')
    const first = await statusOf(`/salons/${tokyo}`)
    await giveBack('salons')
    const second = await statusOf(`/salons/${tokyo}`)

    // Assert
    expect([list, first, second]).toEqual([200, 500, 200])
  })

  it('should give a row a moment the API cannot answer with, and give the row its moment back', async () => {
    // Arrange
    const accessToken = await accessTokenOf(CUSTOMER)
    const before = await lastSignInOf(CUSTOMER)

    // Act
    const readable = await unreadable(
      'users',
      'lastLoginAt',
      await idOf('select id from users where email = $1', [CUSTOMER]),
    )

    // Assert: the account is still signed in, and cannot be shown
    expect(await statusOf('/auth/me', accessToken)).toBe(500)
    await readable()
    expect(await statusOf('/auth/me', accessToken)).toBe(200)
    expect(await lastSignInOf(CUSTOMER)).toEqual(before)
  })

  it('should give back a moment that was none', async () => {
    // Arrange
    const id = await idOf('select id from users where email = $1', [CUSTOMER])
    await testApi().query(
      `update users set "lastLoginAt" = null where id = $1`,
      [id],
    )

    // Act
    const readable = await unreadable('users', 'lastLoginAt', id)
    await readable()

    // Assert
    expect(await lastSignInOf(CUSTOMER)).toEqual([{ moment: null }])
  })

  it('should fail the test that names a row that is none', async () => {
    // Act, Assert
    await expect(
      unreadable('users', 'lastLoginAt', crypto.randomUUID()),
    ).rejects.toThrow()
  })
})
