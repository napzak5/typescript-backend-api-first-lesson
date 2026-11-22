import { CUSTOMER, MANAGER, STYLIST } from '@beauty-salon-frontend/testing/seed'
import { ADMIN, DASHBOARD, PORTAL } from '../support/applications'
import { expectSoundPage } from '../support/checks'
import { expect, test } from '../support/fixtures'
import { menu, menuButton } from '../support/main-menu'
import {
  ADMIN_START,
  DASHBOARD_START,
  enterCredentials,
  heading,
  PORTAL_START,
  signInButton,
  signOutButton,
} from '../support/sign-in'

const NOT_FOR_THIS_ACCOUNT = 'このアプリケーションは利用できません'

test.describe('the admin application', () => {
  test('should open for a member of the staff of a salon', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(ADMIN.origin)

    // Act
    await enterCredentials(page, STYLIST, api.seedPassword)

    // Assert
    await expect(heading(page, ADMIN_START)).toBeFocused()
    await expect(page).toHaveTitle(`${ADMIN_START} | ${ADMIN.title}`)
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
    await expect(heading(page, DASHBOARD_START)).toBeFocused()
    await expectSoundPage(page)
  })

  test('should tell a member of the staff that it is not for their account', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(DASHBOARD.origin)

    // Act
    await enterCredentials(page, STYLIST, api.seedPassword)

    // Assert
    await expect(heading(page, NOT_FOR_THIS_ACCOUNT)).toBeFocused()
    await expect(page.getByRole('main')).toContainText(STYLIST)
  })
})

test.describe('the portal application', () => {
  test('should show its pages to a visitor, with the way to sign in', async ({
    page,
  }) => {
    // Act
    await page.goto(PORTAL.origin)

    // Assert
    await expect(heading(page, PORTAL_START)).toBeVisible()
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
    await expect(heading(page, PORTAL_START)).toBeFocused()
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
    await expect(heading(page, PORTAL_START)).toBeFocused()

    // Act
    await signOutButton(page).click()

    // Assert
    await expect(page.getByText('サインアウトしました。')).toBeVisible()
    await expect(heading(page, PORTAL_START)).toBeVisible()
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

  test('should fit the header of a signed-in user, and the menu with the account, into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(ADMIN.origin)
    await enterCredentials(page, STYLIST, api.seedPassword)
    await expect(heading(page, ADMIN_START)).toBeFocused()
    await expectSoundPage(page)

    // Act
    await menuButton(page).click()

    // Assert
    await expect(
      menu(page).getByRole('button', { name: 'サインアウト' }),
    ).toBeVisible()
    await expectSoundPage(page)
  })

  test('should fit the first page of the portal into the width', async ({
    page,
  }) => {
    // Act
    await page.goto(PORTAL.origin)

    // Assert
    await expect(heading(page, PORTAL_START)).toBeVisible()
    await expectSoundPage(page)
  })
})
