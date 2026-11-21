import type { Locator, Page } from '@playwright/test'
import { DASHBOARD } from './applications'
import { expectSoundPage } from './checks'
import { expect, test } from './fixtures'
import { mainMenuLink, pressInTheMenu } from './main-menu'
import { pressWithTheKeyboard, sellACutToday } from './sales'
import {
  DASHBOARD_START,
  enterCredentials,
  heading,
  MANAGER,
  OWNER,
} from './sign-in'

/*
 * The sales of the staff and of the kinds of service, read from the API at
 * another origin, with the cut of today that a test enters (`sales.ts`).
 */

const STAFF = 'スタッフ別の売上'
const KINDS = '区分別の売上'

/** The cells of the rows of a table, row by row */
const rowsOf = (page: Page, table: string): Locator =>
  page.getByRole('table', { name: table }).getByRole('row')

test.describe('the sales of the staff and of the kinds of service, in a browser', () => {
  test('should let a manager go from the report to every member of the staff, count other days and go on to the kinds of service, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    await sellACutToday(api)
    await page.goto(DASHBOARD.origin)
    await enterCredentials(page, MANAGER, api.seedPassword)
    await expect(heading(page, DASHBOARD_START)).toBeFocused()
    const from = await page.getByLabel('集計する期間（から）').inputValue()
    const to = await page.getByLabel('集計する期間（まで）').inputValue()

    // Act
    await pressWithTheKeyboard(
      page.getByRole('link', { name: 'すべてのスタッフの売上へ' }),
    )

    // Assert
    await expect(heading(page, STAFF)).toBeFocused()
    await expect(page).toHaveURL(
      new RegExp(`/reports/staff\\?from=${from}&to=${to}$`),
    )
    await expect(page.getByLabel('集計する期間（から）')).toHaveValue(from)
    await expect(page.getByLabel('集計する期間（まで）')).toHaveValue(to)
    await expect(rowsOf(page, STAFF).nth(1)).toContainText(
      /1 位Hiroshi Tanaka￥5,5001 件￥5,500/,
    )

    // Act
    await page.getByLabel('集計する期間（から）').fill('2020-01-01')
    await page.getByLabel('集計する期間（まで）').fill('2020-01-31')
    await pressWithTheKeyboard(page.getByRole('button', { name: '集計する' }))

    // Assert
    await expect(page).toHaveURL(
      /\/reports\/staff\?from=2020-01-01&to=2020-01-31$/,
    )
    await expect(
      page.getByText('この期間に、スタッフが担当した売上はありません'),
    ).toBeVisible()

    // Act
    await pressWithTheKeyboard(mainMenuLink(page, KINDS))

    // Assert
    await expect(heading(page, KINDS)).toBeFocused()
    await expect(rowsOf(page, KINDS).nth(1)).toContainText(
      /カット￥5,5001 件￥5,500100.0%/,
    )
  })
})

test.describe('the sales of the staff and of the kinds of service, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  for (const { screen, row } of [
    { screen: STAFF, row: 'Hiroshi Tanaka' },
    { screen: KINDS, row: 'カット' },
  ]) {
    test(`should fit ${screen} and its bars into the width`, async ({
      page,
      api,
    }) => {
      // Arrange
      await sellACutToday(api)
      await page.goto(DASHBOARD.origin)
      await enterCredentials(page, OWNER, api.seedPassword)
      await expect(heading(page, DASHBOARD_START)).toBeFocused()

      // Act
      await pressInTheMenu(page, screen)

      // Assert
      await expect(
        page.getByRole('rowheader', { name: row, exact: true }),
      ).toBeVisible()
      await expectSoundPage(page)
    })
  }
})
