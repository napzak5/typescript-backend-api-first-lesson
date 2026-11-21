import { readFile } from 'node:fs/promises'
import type { Download, Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { DASHBOARD } from './applications'
import { TOKYO } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import {
  DASHBOARD_START,
  enterCredentials,
  heading,
  MANAGER,
  OPERATOR,
  OWNER,
} from './sign-in'

/*
 * The seed data has no sales: a test enters a cut of today in the salon in
 * Tokyo, paid in cash, as the checkout of the admin application would
 * have. The dashboard reads the report of the API at another origin, and
 * the name of its CSV file comes through CORS.
 */

const daySchema = z.tuple([z.object({ day: z.iso.date() })])

/** The day so many days from today in Tokyo (`2026-11-21`). */
const dayFromToday = async (api: TestApi, days: number): Promise<string> =>
  daySchema.parse(
    await api.query(
      `select to_char((now() at time zone 'Asia/Tokyo')::date + $1::int, 'YYYY-MM-DD') as day`,
      [days],
    ),
  )[0].day

/** Enters a ladies' cut of today by Hiroshi Tanaka, ￥5,500 with its tax, paid in cash. */
const sellACutToday = (api: TestApi): Promise<unknown> =>
  api.query(
    `with made as (
       insert into sales ("saleNumber", "salonId", "staffId", "saleDate", "saleTime",
                          subtotal, "taxAmount", "totalAmount", "paymentStatus")
       select 'S-E2E-REPORT', salons.id, staff.id,
              (now() at time zone 'Asia/Tokyo')::date, now(), 5000, 500, 5500, 'completed'
       from salons
       join staff on staff."salonId" = salons.id and staff."staffCode" = 'STF001'
       where salons.name = $1
       returning id, "salonId", "staffId"
     ), line as (
       insert into sales_details ("saleId", "itemType", "itemId", "itemName", quantity,
                                  "unitPrice", "taxAmount", "totalAmount", "staffId")
       select made.id, 'service', services.id, services.name, 1, 5000, 500, 5500, made."staffId"
       from made
       join services on services."salonId" = made."salonId" and services.name = 'Ladies Cut'
     )
     insert into payment_transactions ("saleId", "paymentMethodId", "transactionNumber",
                                       amount, status, "processedAt")
     select made.id, payment_methods.id, 'PT-E2E-REPORT', 5500, 'completed', now()
     from made
     join payment_methods on payment_methods."salonId" = made."salonId"
                         and payment_methods.method = 'cash'`,
    [TOKYO],
  )

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

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
  page.getByRole('region', { name: '期間の合計' }).locator('dt, dd')

test.describe('the sales report, in a browser', () => {
  test('should let a manager count the sales of days they choose and save them as a CSV file, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    await sellACutToday(api)
    const today = await dayFromToday(api, 0)
    const yesterday = await dayFromToday(api, -1)
    await page.goto(DASHBOARD.origin)
    await enterCredentials(page, MANAGER, api.seedPassword)
    await expect(heading(page, DASHBOARD_START)).toBeFocused()
    await expect(page.getByRole('region', { name: '期間の合計' })).toBeVisible()

    // Act
    const from = page.getByLabel('集計する期間（から）')
    await from.focus()
    await from.fill(yesterday)
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
    await expect(
      page
        .getByRole('navigation', { name: 'メインメニュー' })
        .getByRole('link', { name: DASHBOARD_START }),
    ).toHaveAttribute('aria-current', 'page')
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
