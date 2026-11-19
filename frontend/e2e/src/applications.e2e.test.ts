import type { Page } from '@playwright/test'
import { ADMIN, DASHBOARD, PORTAL } from './applications'
import { findAccessibilityViolations, measureLayout } from './checks'
import { expect, test } from './fixtures'
import {
  CUSTOMER,
  enterCredentials,
  heading,
  MANAGER,
  STAFF,
  signInButton,
  signOutButton,
} from './sign-in'

/** The page is accessible, nothing of it sticks out of the window, and nothing is laid out with flex. */
const expectSoundPage = async (page: Page): Promise<void> => {
  expect(await findAccessibilityViolations(page)).toEqual([])
  expect(await measureLayout(page)).toEqual({ overflow: 0, flex: 0 })
}

const NOT_FOR_THIS_ACCOUNT = 'このアプリケーションは利用できません'

test.describe('the admin application', () => {
  test('should open for a member of the staff of a salon', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(ADMIN.origin)

    // Act
    await enterCredentials(page, STAFF, api.seedPassword)

    // Assert
    await expect(heading(page, ADMIN.title)).toBeFocused()
    await expect(page).toHaveTitle(ADMIN.title)
    await expectSoundPage(page)
  })

  test('should tell a customer that it is not for their account, and let them sign out', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(ADMIN.origin)
    await enterCredentials(page, CUSTOMER, api.seedPassword)
    await expect(heading(page, NOT_FOR_THIS_ACCOUNT)).toBeFocused()
    await expectSoundPage(page)

    // Act
    await page
      .getByRole('main')
      .getByRole('button', { name: 'サインアウト' })
      .click()

    // Assert
    await expect(heading(page, 'サインイン')).toBeVisible()
    expect(await api.query('select id from sessions')).toEqual([])
  })
})

test.describe('the dashboard application', () => {
  test('should open for a manager', async ({ page, api }) => {
    // Arrange
    await page.goto(DASHBOARD.origin)

    // Act
    await enterCredentials(page, MANAGER, api.seedPassword)

    // Assert
    await expect(heading(page, DASHBOARD.title)).toBeFocused()
    await expectSoundPage(page)
  })

  test('should tell a member of the staff that it is not for their account', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(DASHBOARD.origin)

    // Act
    await enterCredentials(page, STAFF, api.seedPassword)

    // Assert
    await expect(heading(page, NOT_FOR_THIS_ACCOUNT)).toBeFocused()
    await expect(page.getByRole('main')).toContainText(STAFF)
  })
})

test.describe('the portal application', () => {
  test('should show its pages to a visitor, with the way to sign in', async ({
    page,
  }) => {
    // Act
    await page.goto(PORTAL.origin)

    // Assert
    await expect(heading(page, PORTAL.title)).toBeVisible()
    await expect(
      page.getByRole('banner').getByRole('link', { name: 'サインイン' }),
    ).toBeVisible()
    await expectSoundPage(page)
  })

  test('should sign a customer in on its sign-in screen, and bring them to the first page', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(PORTAL.origin)
    await page
      .getByRole('banner')
      .getByRole('link', { name: 'サインイン' })
      .click()
    await expect(heading(page, 'サインイン')).toBeFocused()
    await expect(page).toHaveURL(`${PORTAL.origin}/sign-in`)

    // Act
    await enterCredentials(page, CUSTOMER, api.seedPassword)

    // Assert
    await expect(heading(page, PORTAL.title)).toBeFocused()
    await expect(page).toHaveURL(`${PORTAL.origin}/`)
    await expect(page.getByRole('banner')).toContainText(CUSTOMER)
    await expectSoundPage(page)
  })

  test('should leave a customer who signs out on the page they were on', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${PORTAL.origin}/sign-in`)
    await enterCredentials(page, CUSTOMER, api.seedPassword)
    await expect(heading(page, PORTAL.title)).toBeFocused()

    // Act
    await signOutButton(page).click()

    // Assert
    await expect(page.getByText('サインアウトしました。')).toBeVisible()
    await expect(heading(page, PORTAL.title)).toBeVisible()
    await expect(page).toHaveURL(`${PORTAL.origin}/`)
    await expect(
      page.getByRole('banner').getByRole('link', { name: 'サインイン' }),
    ).toBeVisible()
  })
})

test.describe('on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the sign-in screen and its messages into the width', async ({
    page,
  }) => {
    // Arrange
    await page.goto(ADMIN.origin)

    // Act
    await signInButton(page).click()

    // Assert
    await expect(
      page.getByText('メールアドレスを入力してください。'),
    ).toBeVisible()
    await expectSoundPage(page)
  })

  test('should fit the header of a signed-in user into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(ADMIN.origin)

    // Act
    await enterCredentials(page, STAFF, api.seedPassword)

    // Assert
    await expect(heading(page, ADMIN.title)).toBeFocused()
    await expect(signOutButton(page)).toBeVisible()
    await expectSoundPage(page)
  })

  test('should fit the first page of the portal into the width', async ({
    page,
  }) => {
    // Act
    await page.goto(PORTAL.origin)

    // Assert
    await expect(heading(page, PORTAL.title)).toBeVisible()
    await expectSoundPage(page)
  })
})
