import type { Locator, Page } from '@playwright/test'
import { ADMIN, DASHBOARD } from './applications'
import { salonId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, test } from './fixtures'
import { ADMIN_START, enterCredentials, heading, OWNER } from './sign-in'

/*
 * The links of the header on a screen as narrow as a phone, which has no
 * room for all of them: the row scrolls sideways. The link of the screen
 * that is open is brought into sight, when a screen is opened at its
 * address, when the links of the role of whoever signed in come (the
 * staff ledger before the settings, the profile after them) and when the
 * application goes to another screen, and the row alone moves, not the
 * page.
 */

/** A link of the header */
const menuLink = (page: Page, name: string): Locator =>
  page
    .getByRole('navigation', { name: 'メインメニュー' })
    .getByRole('link', { name })

/** How far the page is scrolled down */
const scrolledDown = (page: Page): Promise<number> =>
  page.evaluate(() => window.scrollY)

test.describe('the links of the header, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should bring the last link of the reports into sight when the dashboard opens at its address', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(
      `${DASHBOARD.origin}/salons/${await salonId(api)}/reports/categories`,
    )

    // Act
    await enterCredentials(page, OWNER, api.seedPassword)

    // Assert
    await expect(heading(page, '区分別の売上')).toBeFocused()
    const current = menuLink(page, '区分別の売上')
    await expect(current).toHaveAttribute('aria-current', 'page')
    await expect(current).toBeInViewport({ ratio: 1 })
    expect(await scrolledDown(page)).toBe(0)
    await expectSoundPage(page)
  })

  test('should bring the link of the settings into sight when the links of the role come, and again when the admin application goes back to them', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/settings`)

    // Act
    await enterCredentials(page, OWNER, api.seedPassword)

    // Assert
    await expect(heading(page, 'サロンの設定')).toBeFocused()
    const settings = menuLink(page, '設定')
    await expect(settings).toBeInViewport({ ratio: 1 })

    // Arrange
    await menuLink(page, '予約').click()
    await expect(heading(page, ADMIN_START)).toBeFocused()
    await expect(settings).not.toBeInViewport()

    // Act
    await page.goBack()

    // Assert
    await expect(heading(page, 'サロンの設定')).toBeFocused()
    await expect(settings).toHaveAttribute('aria-current', 'page')
    await expect(settings).toBeInViewport({ ratio: 1 })
    expect(await scrolledDown(page)).toBe(0)
  })
})
