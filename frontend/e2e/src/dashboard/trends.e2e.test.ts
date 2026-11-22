import { MANAGER, OWNER } from '@beauty-salon-frontend/testing/seed'
import { DASHBOARD } from '../support/applications'
import { expectSoundPage } from '../support/checks'
import { expect, test } from '../support/fixtures'
import { mainMenuLink, pressInTheMenu } from '../support/main-menu'
import { sellACutToday } from '../support/sales'
import { part, pressWithTheKeyboard } from '../support/screen'
import { DASHBOARD_START, enterCredentials, heading } from '../support/sign-in'

/*
 * The trends and the sales of one day, read from the API at another
 * origin, with the cut of today that a test enters (`sales.ts`).
 */

const TABLE = '区切りごとの売上、会計の件数、客単価'

/** A month as the table names it: 「2026年11月」 */
const monthNameOf = (day: string): string =>
  `${Number(day.slice(0, 4))}年${Number(day.slice(5, 7))}月`

test.describe('the trends and the sales of a day, in a browser', () => {
  test('should let a manager cut the sales into weeks and go back a day, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    await sellACutToday(api)
    const yesterday = await api.dayFromToday(-1)
    await page.goto(DASHBOARD.origin)
    await enterCredentials(page, MANAGER, api.seedPassword)
    await expect(heading(page, DASHBOARD_START)).toBeFocused()

    // Act
    await pressWithTheKeyboard(mainMenuLink(page, '売上の推移'))
    await expect(heading(page, '売上の推移')).toBeFocused()
    await page.getByRole('radio', { name: '月', exact: true }).focus()
    await page.keyboard.press('ArrowLeft')
    await pressWithTheKeyboard(page.getByRole('button', { name: '集計する' }))

    // Assert
    await expect(page).toHaveURL(/[?&]period=weekly$/)
    await expect(
      page.getByRole('radio', { name: '週', exact: true }),
    ).toBeChecked()
    await expect(
      page.getByRole('table', { name: TABLE }).getByRole('row').last(),
    ).toContainText(/からの週￥5,5001 件￥5,500/)

    // Act
    await pressWithTheKeyboard(mainMenuLink(page, '1 日の売上'))
    await expect(heading(page, '1 日の売上')).toBeFocused()
    await expect(part(page, /の売上$/)).toContainText('￥5,500')
    await pressWithTheKeyboard(page.getByRole('link', { name: '前の日' }))

    // Assert
    await expect(page).toHaveURL(new RegExp(`[?&]date=${yesterday}$`))
    await expect(page.getByLabel('日付')).toHaveValue(yesterday)
    await expect(part(page, /の売上$/).getByRole('definition')).toHaveText([
      '￥0',
      '0 件',
      '￥0',
      '￥0',
    ])
    await expect(page.getByRole('link', { name: '次の日' })).toBeVisible()
  })

  test('should show the sales of a month on a pointer over its column', async ({
    page,
    api,
  }) => {
    // Arrange
    await sellACutToday(api)
    const today = await api.dayFromToday(0)
    await page.goto(DASHBOARD.origin)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, DASHBOARD_START)).toBeFocused()
    await mainMenuLink(page, '売上の推移').click()
    await expect(page.getByRole('table', { name: TABLE })).toBeVisible()
    const tip = page.getByText(`${monthNameOf(today)} ￥5,500`, {
      exact: true,
    })
    await expect(tip).toBeHidden()

    // Act
    await tip.locator('..').hover()

    // Assert
    await expect(tip).toBeVisible()
  })
})

test.describe('the trends and the sales of a day, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the trend, its chart and its table, into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await sellACutToday(api)
    await page.goto(DASHBOARD.origin)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, DASHBOARD_START)).toBeFocused()

    // Act
    await pressInTheMenu(page, '売上の推移')

    // Assert
    await expect(page.getByRole('table', { name: TABLE })).toBeVisible()
    await expectSoundPage(page)
  })

  test('should fit the sales of a day into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await sellACutToday(api)
    await page.goto(DASHBOARD.origin)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, DASHBOARD_START)).toBeFocused()

    // Act
    await pressInTheMenu(page, '1 日の売上')

    // Assert
    await expect(part(page, /の売上$/)).toContainText('￥5,500')
    await expectSoundPage(page)
  })
})
