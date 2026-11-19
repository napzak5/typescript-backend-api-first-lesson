import type { APIRequestContext, Locator, Page } from '@playwright/test'
import * as z from 'zod'
import type { TestApi } from './fixtures'

/** Accounts of the seed data, by what they may use. */
export const OWNER = 'owner@beautysalon.jp'
export const MANAGER = 'manager@beautysalon.jp'
export const STAFF = 'stylist1@beautysalon.jp'
export const CUSTOMER = 'customer1@example.com'

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

const signedInSchema = z.object({
  data: z.object({ accessToken: z.string() }),
})

const setUpSchema = z.object({
  data: z.object({ secret: z.string(), backupCodes: z.array(z.string()) }),
})

/**
 * Sets up two-factor authentication for an account, as its owner would: by
 * asking the API, for no screen does it yet. The secret is what
 * `api.authenticatorCode` makes the codes from.
 */
export const setUpTwoFactor = async (
  request: APIRequestContext,
  api: TestApi,
  email: string,
): Promise<{ secret: string; backupCodes: string[] }> => {
  const password = api.seedPassword
  const signedIn = await request.post(`${api.origin}/api/v1/auth/login`, {
    data: { email, password, rememberMe: false, twoFactorCode: null },
  })
  const { accessToken } = signedInSchema.parse(await signedIn.json()).data
  const headers = { Authorization: `Bearer ${accessToken}` }
  const setUp = await request.post(`${api.origin}/api/v1/auth/2fa/enable`, {
    headers,
    data: { password },
  })
  const { secret, backupCodes } = setUpSchema.parse(await setUp.json()).data
  await request.post(`${api.origin}/api/v1/auth/2fa/verify`, {
    headers,
    data: { code: await api.authenticatorCode(secret) },
  })
  await request.post(`${api.origin}/api/v1/auth/logout`, { headers })

  return { secret, backupCodes }
}
