import { readFile } from 'node:fs/promises'
import {
  MANAGER,
  OPERATOR,
  OWNER,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import type { Download, Locator, Page } from '@playwright/test'
import { DASHBOARD } from './applications'
import { expectSoundPage } from './checks'
import { expect, test } from './fixtures'
import { mainMenuLink } from './main-menu'
import { sellACutToday } from './sales'
import { part, pressWithTheKeyboard, writeInto } from './screen'
import { DASHBOARD_START, enterCredentials, heading } from './sign-in'

/*
 * The seed data has no sales: a test enters a cut of today in the salon in
 * Tokyo (`sales.ts`). The dashboard reads the report of the API at another
 * origin, and the name of its CSV file comes through CORS.
 */

/** Presses the control, and waits for the file the browser saves. */
const saveWith = async (page: Page, control: Locator): Promise<Download> => {
  const saving = page.waitForEvent('download')
  await pressWithTheKeyboard(control)

  return saving
}

/** The sums of the cut of today, term by term */
const SUMS_OF_THE_CUT = [
  '売上',
  '￥5,500',
  '返金',
  '￥0',
  '純売上',
  '￥5,500',
  '会計の件数',
  '1 件',
  '客単価',
  '￥5,500',
  '消費税',
  '￥500',
  '値引き',
  '￥0',
]

/** A day as the screen writes it in a period, without its weekday: 「2026年11月20日」 */
const dateNameOf = (day: string): string =>
  new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`))

/** What the sums of the period say, term by term, once they are shown */
const sumsOf = (page: Page): Locator =>
  part(page, '期間の合計').locator('dt, dd')

test.describe('the sales report, in a browser', () => {
  test('should let a manager count the sales of days they choose and save them as a CSV file, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    await sellACutToday(api)
    const today = await api.dayFromToday(0)
    const yesterday = await api.dayFromToday(-1)
    await page.goto(DASHBOARD.origin)
    await enterCredentials(page, MANAGER, api.seedPassword)
    await expect(heading(page, DASHBOARD_START)).toBeFocused()
    await expect(part(page, '期間の合計')).toBeVisible()

    // Act
    const from = page.getByLabel('集計する期間（から）')
    await writeInto(from, yesterday)
    await pressWithTheKeyboard(page.getByRole('button', { name: '集計する' }))
    await expect(page).toHaveURL(
      new RegExp(`/reports\\?from=${yesterday}&to=${today}$`),
    )
    // The address changes before the screen does: until it shows the days
    // chosen, its button exports the month
    await expect(page.getByText(/〜.+の売上$/)).toContainText(
      dateNameOf(yesterday),
    )
    const download = await saveWith(
      page,
      page.getByRole('button', { name: 'CSV に出力する' }),
    )

    // Assert
    await expect(sumsOf(page)).toHaveText(SUMS_OF_THE_CUT)
    await expect(
      page
        .getByRole('table', { name: '支払い方法別の入金' })
        .getByRole('row', { name: /現金/ }),
    ).toContainText('￥5,500')
    await expect(
      page
        .getByRole('table', { name: 'スタッフ別の売上の上位 5 人' })
        .getByRole('row', { name: /Hiroshi Tanaka/ }),
    ).toContainText('1 位')
    const name = download.suggestedFilename()
    expect(name).toBe(`sales-report-${yesterday}-${today}.csv`)
    expect(await readFile(await download.path(), 'utf8')).toBe(
      [
        'date,sales,tax,discounts,transactions,refunds,net',
        `${yesterday},0,0,0,0,0,0`,
        `${today},5500,500,0,1,0,5500`,
        '',
      ].join('\r\n'),
    )
    await expect(page.getByText(`に出力しました。`)).toContainText(name)
    await expect(
      page.getByRole('button', { name: 'CSV に出力する' }),
    ).toBeFocused()
  })

  test('should let the operator of the platform choose the salon whose report to open, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    await sellACutToday(api)
    await page.goto(DASHBOARD.origin)
    await enterCredentials(page, OPERATOR, api.seedPassword)
    await expect(heading(page, 'サロンを選ぶ')).toBeFocused()

    // Act
    await pressWithTheKeyboard(page.getByRole('link', { name: TOKYO }))

    // Assert
    await expect(heading(page, DASHBOARD_START)).toBeFocused()
    await expect(page.getByText(TOKYO)).toBeVisible()
    await expect(sumsOf(page)).toHaveText(SUMS_OF_THE_CUT)
    await expect(mainMenuLink(page, DASHBOARD_START)).toHaveAttribute(
      'aria-current',
      'page',
    )
  })
})

test.describe('the sales report, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the report and the period into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await sellACutToday(api)

    // Act
    await page.goto(DASHBOARD.origin)
    await enterCredentials(page, OWNER, api.seedPassword)

    // Assert
    await expect(
      page.getByRole('table', { name: 'スタッフ別の売上の上位 5 人' }),
    ).toBeVisible()
    await expectSoundPage(page)
  })

  test('should fit the choice of a salon, and a period without sales, into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(DASHBOARD.origin)
    await enterCredentials(page, OPERATOR, api.seedPassword)
    await expect(page.getByRole('link', { name: TOKYO })).toBeVisible()
    await expectSoundPage(page)
    await page.getByRole('link', { name: TOKYO }).click()
    await expect(heading(page, DASHBOARD_START)).toBeFocused()

    // Act
    await page.getByLabel('集計する期間（から）').fill('2020-01-01')
    await page.getByLabel('集計する期間（まで）').fill('2020-01-31')
    await page.getByRole('button', { name: '集計する' }).click()

    // Assert
    await expect(page.getByText('この期間の売上はありません')).toBeVisible()
    await expectSoundPage(page)
  })
})
