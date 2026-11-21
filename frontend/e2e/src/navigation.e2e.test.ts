import type { Page } from '@playwright/test'
import { ADMIN, PORTAL } from './applications'
import { salonId } from './bookings'
import { cornersUnderTheDialog, edgesOf, expectSoundPage } from './checks'
import { expect, test } from './fixtures'
import {
  MAIN_MENU,
  mainMenu,
  mainMenuLink,
  menu,
  menuButton,
} from './main-menu'
import {
  ADMIN_START,
  CUSTOMER,
  enterCredentials,
  heading,
  OWNER,
  PORTAL_START,
} from './sign-in'

/*
 * The links to the screens of an application. On a screen as wide as a
 * tablet they are a row under the header, and the row scrolls sideways when
 * it is longer than the screen. On a screen as narrow as a phone the
 * header is one row, the name and the button of the menu, and the links
 * and the account are in the menu: a sheet that comes up from the bottom
 * edge.
 */

/** How far the page is scrolled down */
const scrolledDown = (page: Page): Promise<number> =>
  page.evaluate(() => window.scrollY)

/** How high the header is */
const heightOfTheHeader = async (page: Page): Promise<number> => {
  const { top, bottom } = await edgesOf(page.getByRole('banner'))

  return bottom - top
}

test.describe('the links of the header, on a screen narrower than their row', () => {
  test.use({ viewport: { width: 700, height: 900 } })

  test('should bring the link of a screen far along the row into sight when the admin application opens at its address', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(
      `${ADMIN.origin}/salons/${await salonId(api)}/purchase-orders`,
    )

    // Act
    await enterCredentials(page, OWNER, api.seedPassword)

    // Assert
    await expect(heading(page, '発注')).toBeFocused()
    const current = mainMenuLink(page, '発注')
    await expect(current).toHaveAttribute('aria-current', 'page')
    await expect(current).toBeInViewport({ ratio: 1 })
    await expect(mainMenuLink(page, '予約')).not.toBeInViewport()
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
    const settings = mainMenuLink(page, '設定')
    await expect(settings).toBeInViewport({ ratio: 1 })

    // Arrange
    await mainMenuLink(page, '予約').click()
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

test.describe('the menu, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should keep the header to one row, the name and the button of the menu', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/bookings`)

    // Act
    await enterCredentials(page, OWNER, api.seedPassword)

    // Assert: as high as the button (a control: 36 pixels for a mouse, 40
    // for a finger), 8 pixels above and below it and the line under the
    // header. It was three rows and 129 pixels high
    await expect(heading(page, ADMIN_START)).toBeFocused()
    await expect(mainMenu(page)).toHaveCount(0)
    const [banner, name, button] = await Promise.all([
      edgesOf(page.getByRole('banner')),
      edgesOf(
        page.getByRole('banner').getByRole('link', { name: ADMIN.title }),
      ),
      edgesOf(menuButton(page)),
    ])
    const control = button.bottom - button.top
    expect([36, 40]).toContain(control)
    expect(banner.bottom - banner.top).toBe(control + 2 * 8 + 1)
    expect(button.right).toBe(390 - 16)
    expect(
      Math.abs((name.top + name.bottom) / 2 - (button.top + button.bottom) / 2),
    ).toBeLessThanOrEqual(1)
    await expectSoundPage(page)
  })

  test('should open the links and the account as a sheet on the bottom edge, and go to the screen of a link', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/bookings`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, ADMIN_START)).toBeFocused()

    // Act
    await menuButton(page).click()

    // Assert: on the bottom edge, as wide as the window, once it has come
    // up; the links share the width, two to a row; the account is shown whole
    await expect
      .poll(() => edgesOf(menu(page)))
      .toMatchObject({ left: 0, right: 390, bottom: 844 })
    expect(await cornersUnderTheDialog(page)).toEqual([true, true, true, true])
    const links = menu(page).getByRole('navigation', { name: MAIN_MENU })
    await expect(
      links.getByRole('link', { name: '予約', exact: true }),
    ).toHaveAttribute('aria-current', 'page')
    const [first, second] = await Promise.all([
      edgesOf(links.getByRole('link', { name: '予約', exact: true })),
      edgesOf(links.getByRole('link', { name: '売上', exact: true })),
    ])
    expect(second.top).toBe(first.top)
    await expect(menu(page).getByText(OWNER)).toBeVisible()
    const [link, signOut] = await Promise.all([
      edgesOf(links.getByRole('link', { name: '顧客', exact: true })),
      edgesOf(menu(page).getByRole('button', { name: 'サインアウト' })),
    ])
    expect(signOut.bottom - signOut.top).toBe(link.bottom - link.top)
    await expectSoundPage(page)

    // Act
    await links.getByRole('link', { name: '顧客', exact: true }).click()

    // Assert
    await expect(menu(page)).toBeHidden()
    await expect(heading(page, '顧客台帳')).toBeFocused()
    await expect(page).toHaveTitle(`顧客台帳 | ${ADMIN.title}`)
  })

  test('should give the focus back to its button when it is closed by its button, the Escape key or the overlay', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/bookings`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, ADMIN_START)).toBeFocused()

    for (const close of [
      () => menu(page).getByRole('button', { name: '閉じる' }).click(),
      () => page.keyboard.press('Escape'),
      () => page.mouse.click(195, 100),
    ]) {
      // Arrange
      await menuButton(page).click()
      await expect(menu(page)).toBeVisible()

      // Act
      await close()

      // Assert
      await expect(menu(page)).toBeHidden()
      await expect(menuButton(page)).toBeFocused()
      await expect(heading(page, ADMIN_START)).toBeVisible()
    }
  })

  test('should sign a customer out from the menu, and leave the way in beside the name', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${PORTAL.origin}/sign-in`)
    await enterCredentials(page, CUSTOMER, api.seedPassword)
    await expect(heading(page, PORTAL_START)).toBeFocused()
    const signedIn = await heightOfTheHeader(page)
    await menuButton(page).click()

    // Act
    await menu(page).getByRole('button', { name: 'サインアウト' }).click()

    // Assert
    await expect(page.getByText('サインアウトしました。')).toBeVisible()
    await expect(menu(page)).toHaveCount(0)
    await expect(menuButton(page)).toHaveCount(0)
    await expect(
      page.getByRole('banner').getByRole('link', { name: 'サインイン' }),
    ).toBeVisible()
    expect(await heightOfTheHeader(page)).toBe(signedIn)
    await expectSoundPage(page)
  })
})
