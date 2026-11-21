import type {
  AuthCrudEnableTwoFactor200,
  AuthCrudLogin200,
} from '@beauty-salon-frontend/api-client'
import {
  type APIRequestContext,
  expect,
  type Locator,
  type Page,
} from '@playwright/test'
import * as z from 'zod'
import type { TestApi } from './fixtures'

/** Accounts of the seed data, by what they may use. */
export const OWNER = 'owner@beautysalon.jp'
export const MANAGER = 'manager@beautysalon.jp'
export const STAFF = 'stylist1@beautysalon.jp'
export const CUSTOMER = 'customer1@example.com'
/** The operator of the platform: a member of no salon */
export const OPERATOR = 'admin@beautysalon.jp'

/** Somebody who registers in a test: an account without a profile */
export const NEWCOMER = 'newcomer@example.com'
export const NEWCOMER_PASSWORD = 'a passphrase that only this test knows'

/** The first screen of the portal, for everybody: the search of the salons. */
export const PORTAL_START = 'サロンを探す'

/**
 * The first screen of the admin application for a member of the staff of a
 * salon: the bookings of their salon, today.
 */
export const ADMIN_START = '予約台帳'

/**
 * The first screen of the dashboard for the owner and a manager: the sales
 * report of their salon.
 */
export const DASHBOARD_START = '売上レポート'

/** The heading of the screen: where the focus is after the screen changed. */
export const heading = (page: Page, name: string): Locator =>
  page.getByRole('heading', { level: 1, name })

export const emailField = (page: Page): Locator =>
  page.getByRole('textbox', { name: 'メールアドレス' })

export const passwordField = (page: Page): Locator =>
  page.getByLabel('パスワード', { exact: true })

export const signInButton = (page: Page): Locator =>
  page.getByRole('button', { name: 'サインイン' })

/** The sign-out of the header, which every screen has for who is signed in. */
export const signOutButton = (page: Page): Locator =>
  page.getByRole('banner').getByRole('button', { name: 'サインアウト' })

/** Fills in the sign-in screen and sends it, as a user with a pointer does. */
export const enterCredentials = async (
  page: Page,
  email: string,
  password: string,
): Promise<void> => {
  await emailField(page).fill(email)
  await passwordField(page).fill(password)
  await signInButton(page).click()
}

/** What a test reads of a sign-in: the access token */
const signedInSchema = z.object({
  data: z.object({ accessToken: z.string() }),
}) satisfies z.ZodType<{
  data: Pick<AuthCrudLogin200['data'], 'accessToken'>
}>

/** What a test reads of the set-up of a second factor: the secret and the backup codes */
const setUpSchema = z.object({
  data: z.object({ secret: z.string(), backupCodes: z.array(z.string()) }),
}) satisfies z.ZodType<{
  data: Pick<AuthCrudEnableTwoFactor200['data'], 'secret' | 'backupCodes'>
}>

/**
 * An access token of an account of the seed data: for what a test asks of
 * the API without a screen, in the name of that account.
 */
export const accessTokenOf = async (
  request: APIRequestContext,
  api: TestApi,
  email: string,
): Promise<string> => {
  const signedIn = await request.post(`${api.origin}/api/v1/auth/login`, {
    data: {
      email,
      password: api.seedPassword,
      rememberMe: false,
      twoFactorCode: null,
    },
  })

  return signedInSchema.parse(await signedIn.json()).data.accessToken
}

/**
 * An account whose address is confirmed, and that has not said who its
 * customer is: registered as a client that is no screen does it.
 */
export const registerNewcomer = async (
  request: APIRequestContext,
  api: TestApi,
): Promise<void> => {
  const registered = await request.post(`${api.origin}/api/v1/auth/register`, {
    data: { email: NEWCOMER, password: NEWCOMER_PASSWORD },
  })
  expect(registered.status()).toBe(204)
  const token = new URL(await api.mailedLink(NEWCOMER)).hash.replace(
    '#token=',
    '',
  )
  const confirmed = await request.post(
    `${api.origin}/api/v1/auth/verify-email/confirm`,
    { data: { token } },
  )
  expect(confirmed.status()).toBe(204)
}

/**
 * Sets up two-factor authentication for an account through the API, for a
 * test of what comes after it: the screens that set it up are tested in
 * `two-factor.e2e.test.ts`. The secret is what `api.authenticatorCode`
 * makes the codes from.
 */
export const setUpTwoFactor = async (
  request: APIRequestContext,
  api: TestApi,
  email: string,
): Promise<{ secret: string; backupCodes: string[] }> => {
  const headers = {
    Authorization: `Bearer ${await accessTokenOf(request, api, email)}`,
  }
  const setUp = await request.post(`${api.origin}/api/v1/auth/2fa/enable`, {
    headers,
    data: { password: api.seedPassword },
  })
  const { secret, backupCodes } = setUpSchema.parse(await setUp.json()).data
  await request.post(`${api.origin}/api/v1/auth/2fa/verify`, {
    headers,
    data: { code: await api.authenticatorCode(secret) },
  })
  await request.post(`${api.origin}/api/v1/auth/logout`, { headers })

  return { secret, backupCodes }
}
