import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN, type Application, DASHBOARD, PORTAL } from './applications'
import { HIROSHI, salonId, serviceId, staffId } from './bookings'
import { edgesOf, expectSoundLayout } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { sellACutToday } from './sales'
import {
  CUSTOMER,
  enterCredentials,
  heading,
  OPERATOR,
  OWNER,
  PORTAL_START,
} from './sign-in'

/*
 * The screens on the narrowest screen they are made for, 320 CSS pixels
 * wide: no page is wider than the window, and nothing sticks out of what
 * it is in (WCAG 2.2, 1.4.10 Reflow). The browser of a phone shows a page
 * that is wider than its window shrunk, and what is fixed to the window,
 * the overlay of a dialog as well, then no longer covers what is seen.
 *
 * Every screen is opened at its address and measured as the browser laid
 * it out. A screen that fails is named in the report, and the ones after
 * it are measured all the same.
 *
 * A button gives way before it sticks out: its label goes on in a second
 * line. So a row of buttons that has no room does not make a page wider,
 * and what the shared parts do with their buttons on a narrow screen is
 * asserted by where the buttons stand. A word that somebody typed, longer
 * than the line, breaks where the line ends, wherever it is shown.
 */

/** A name of one word longer than any line of a phone, as somebody may type it or paste it */
const UNBROKEN = `Salon${'a'.repeat(90)}`

/** The address of a screen below where its application or its salon is, and its heading */
type Screen = [path: string, heading: string]

const idSchema = z.tuple([z.object({ id: z.uuid() })])

/** The ID of the one row of the seed data that a statement finds. */
const idOf = async (
  api: TestApi,
  statement: string,
  value: string,
): Promise<string> => idSchema.parse(await api.query(statement, [value]))[0].id

/**
 * Opens each screen and measures it once it has read what it shows. The
 * test knows the heading of a screen and nothing of its content, so it
 * waits until the page asks the API for nothing more.
 */
const measureScreens = async (
  page: Page,
  application: Application,
  base: string,
  screens: Screen[],
): Promise<void> => {
  for (const [path, name] of screens) {
    await page.goto(`${application.origin}${base}${path}`)
    await expect(heading(page, name)).toBeVisible()
    await page.waitForLoadState('networkidle')
    await expectSoundLayout(page, `${application.name} ${path}: ${name}`)
  }
}

/** In how many lines the browser drew the text of an element */
const linesOf = (element: Locator): Promise<number> =>
  element.evaluate((shown) => {
    const text = document.createRange()
    text.selectNodeContents(shown)

    return text.getClientRects().length
  })

/**
 * Signs the owner in to the admin application, at the bookings of their
 * salon, and answers where the screens of that salon are.
 */
const openTheSalon = async (page: Page, api: TestApi): Promise<string> => {
  const salon = `/salons/${await salonId(api)}`
  await page.goto(`${ADMIN.origin}${salon}/bookings`)
  await enterCredentials(page, OWNER, api.seedPassword)
  await expect(heading(page, '予約台帳')).toBeVisible()

  return salon
}

test.describe('the screens, on a screen 320 pixels wide', () => {
  test.use({ viewport: { width: 320, height: 568 } })

  test('should keep every screen of the portal as wide as the window', async ({
    page,
    api,
  }) => {
    // Arrange
    const [salon, service] = await Promise.all([salonId(api), serviceId(api)])
    const booking = await idOf(
      api,
      'select id::text from bookings where "bookingNumber" = $1',
      'BK-SEED-0001',
    )

    // Act and assert: what everybody sees
    await measureScreens(page, PORTAL, '', [
      ['/', PORTAL_START],
      [`/salons/${salon}`, 'Beauty Studio Tokyo'],
      ['/register', 'アカウントの登録'],
      ['/forgot-password', 'パスワードの再設定'],
      ['/sign-in', 'サインイン'],
    ])

    // Act and assert: what a customer sees
    await enterCredentials(page, CUSTOMER, api.seedPassword)
    await expect(heading(page, PORTAL_START)).toBeVisible()
    await measureScreens(page, PORTAL, '', [
      [`/salons/${salon}/services/${service}/booking`, '予約する'],
      ['/bookings', '予約の一覧'],
      [`/bookings/${booking}`, '予約の内容'],
      ['/mypage', 'マイページ'],
      ['/mypage/profile', 'お客様の情報'],
      ['/mypage/preferences', '好みの設定'],
      ['/mypage/reviews', '自分のレビュー'],
      ['/mypage/security', 'アカウントの安全'],
      ['/mypage/security/password', 'パスワードを変更する'],
    ])
  })

  test('should keep the screens of the bookings and the sales in the admin application as wide as the window', async ({
    page,
    api,
  }) => {
    // Arrange
    await sellACutToday(api)
    const [booking, sale] = await Promise.all([
      idOf(
        api,
        'select id::text from bookings where "bookingNumber" = $1',
        'BK-SEED-0001',
      ),
      idOf(
        api,
        'select id::text from sales where "saleNumber" = $1',
        'S-E2E-REPORT',
      ),
    ])

    // Act and assert
    await measureScreens(page, ADMIN, await openTheSalon(page, api), [
      ['/bookings', '予約台帳'],
      ['/bookings/new', '予約を入れる'],
      [`/bookings/${booking}`, '予約の内容'],
      [`/bookings/${booking}/edit`, '要望とメモを変える'],
      ['/sales', '売上台帳'],
      [`/sales/${sale}`, '売上の内容'],
      [`/sales/${sale}/receipt`, 'レシート'],
    ])
  })

  test('should keep the screens of the customers and their records in the admin application as wide as the window', async ({
    page,
    api,
  }) => {
    // Arrange
    const customer = await idOf(
      api,
      'select id::text from customers where email = $1',
      CUSTOMER,
    )

    // Act and assert
    await measureScreens(page, ADMIN, await openTheSalon(page, api), [
      ['/customers', '顧客台帳'],
      ['/customers/new', 'お客様を登録する'],
      ['/customers/import', 'CSV から登録する'],
      [`/customers/${customer}`, 'お客様の台帳'],
      [`/customers/${customer}/edit`, '台帳を直す'],
      [`/customers/${customer}/preferences`, '好み設定を直す'],
      [`/customers/${customer}/history`, '変更履歴'],
      [`/customers/${customer}/points`, 'ポイント'],
      [`/customers/${customer}/chart`, 'カルテ'],
      ['/customers/charts', 'カルテを探す'],
      ['/treatments', '施術記録'],
      ['/treatments/statistics', '施術の統計'],
      ['/reviews', 'レビュー'],
      ['/reviews/reports', 'レビューへの通報'],
      ['/files', 'ファイル'],
    ])
  })

  test('should keep the screens of the staff, the menu and the settings in the admin application as wide as the window', async ({
    page,
    api,
  }) => {
    // Arrange
    const staff = await staffId(api, HIROSHI)

    // Act and assert
    await measureScreens(page, ADMIN, await openTheSalon(page, api), [
      ['/staff', 'スタッフ'],
      ['/staff/new', 'スタッフを登録する'],
      [`/staff/${staff}`, 'スタッフの内容'],
      ['/shifts', 'シフト'],
      [`/shifts/${staff}`, '勤務スケジュール'],
      [`/shifts/${staff}/edit`, '勤務スケジュールを直す'],
      ['/menu', 'メニュー'],
      ['/menu/services/new', 'サービスを足す'],
      ['/menu/services/bulk', 'サービスをまとめて変える'],
      ['/menu/categories/new', 'カテゴリーを足す'],
      ['/settings', 'サロンの設定'],
      ['/settings/edit', 'サロンの情報を直す'],
      ['/settings/hours', '営業時間を直す'],
      ['/settings/payment-methods', '支払い方法'],
      ['/settings/payment-methods/new', '支払い方法を足す'],
    ])
    await measureScreens(page, ADMIN, '/account', [
      ['/profile', 'プロフィール'],
      ['/security', 'アカウントの安全'],
      ['/security/password', 'パスワードを変更する'],
    ])
  })

  test('should keep the screens of the products, the stock and the orders in the admin application as wide as the window', async ({
    page,
    api,
  }) => {
    // Arrange
    const [product, order] = await Promise.all([
      idOf(
        api,
        'select id::text from products where "productCode" = $1',
        'COLOR001',
      ),
      idOf(
        api,
        'select id::text from purchase_orders where "orderNumber" = $1',
        'PO-SEED-0001',
      ),
    ])

    // Act and assert
    await measureScreens(page, ADMIN, await openTheSalon(page, api), [
      ['/products', '商品台帳'],
      ['/products/new', '商品を足す'],
      [`/products/${product}`, '商品の内容'],
      ['/inventory', '在庫'],
      ['/inventory/new', '在庫の行を足す'],
      ['/inventory/count', '棚卸し'],
      ['/inventory/value', '在庫評価額'],
      ['/inventory/alerts', '在庫のアラート'],
      ['/purchase-orders', '発注'],
      ['/purchase-orders/new', '発注を作る'],
      ['/purchase-orders/suggestions', '発注の提案'],
      [`/purchase-orders/${order}`, '発注'],
    ])
  })

  test('should stand the buttons of a form one below the other, each as wide as the form', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${PORTAL.origin}/mypage/profile`)

    // Act
    await enterCredentials(page, CUSTOMER, api.seedPassword)
    await expect(heading(page, 'お客様の情報')).toBeVisible()

    // Assert
    const [save, back] = await Promise.all([
      edgesOf(page.getByRole('button', { name: '変更を保存する' })),
      edgesOf(page.getByRole('link', { name: 'マイページへ戻る' })),
    ])
    expect(back.top).toBeGreaterThan(save.bottom)
    expect({ left: back.left, right: back.right }).toEqual({
      left: save.left,
      right: save.right,
    })
  })

  test('should keep the buttons under the heading of a card inside the card, each label on one line', async ({
    page,
    api,
  }) => {
    // Arrange
    const customer = await idOf(
      api,
      'select id::text from customers where email = $1',
      CUSTOMER,
    )
    const salon = await openTheSalon(page, api)

    // Act
    await page.goto(`${ADMIN.origin}${salon}/customers/${customer}`)
    await expect(heading(page, 'お客様の台帳')).toBeVisible()

    // Assert
    const ledger = page.getByRole('region', { name: '台帳', exact: true })
    const card = await edgesOf(ledger)
    for (const name of ['予約を入れる', '台帳を直す']) {
      const button = ledger.getByRole('link', { name })
      const { left, right } = await edgesOf(button)
      expect(left, name).toBeGreaterThan(card.left)
      expect(right, name).toBeLessThan(card.right)
      expect(await linesOf(button), name).toBe(1)
    }
  })

  test('should break a word longer than the line where the line ends, in a heading, a list, a record and a dialog', async ({
    page,
    api,
  }) => {
    // Arrange: the owner signed in first, while the salon has the name of the seed it is found by
    const salon = await salonId(api)
    const salonPath = await openTheSalon(page, api)
    await api.query('update salons set name = $2 where id = $1', [
      salon,
      UNBROKEN,
    ])

    // Act and assert: the salon in the portal, found and opened
    await measureScreens(page, PORTAL, '', [
      ['/', PORTAL_START],
      [`/salons/${salon}`, UNBROKEN],
    ])
    expect(await linesOf(heading(page, UNBROKEN))).toBeGreaterThan(1)

    // Act and assert: its settings, and the question before it is deleted
    await measureScreens(page, ADMIN, salonPath, [
      ['/settings', 'サロンの設定'],
    ])
    await page.getByRole('button', { name: 'サロンを削除する' }).click()
    await expect(
      page.getByRole('dialog', {
        name: `サロン「${UNBROKEN}」を削除しますか？`,
      }),
    ).toBeVisible()
    await expectSoundLayout(page, 'the question before the salon is deleted')
  })

  test('should keep the screens of the operator in the admin application as wide as the window', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(ADMIN.origin)
    await enterCredentials(page, OPERATOR, api.seedPassword)
    await expect(heading(page, 'サロンを選ぶ')).toBeVisible()

    // Act and assert
    await measureScreens(page, ADMIN, '', [
      ['/', 'サロンを選ぶ'],
      ['/operations', '運用'],
    ])
  })

  test('should keep every screen of the dashboard as wide as the window', async ({
    page,
    api,
  }) => {
    // Arrange
    await sellACutToday(api)
    const reports = `/salons/${await salonId(api)}/reports`
    await page.goto(`${DASHBOARD.origin}${reports}`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, '売上レポート')).toBeVisible()

    // Act and assert
    await measureScreens(page, DASHBOARD, reports, [
      ['', '売上レポート'],
      ['/trends', '売上の推移'],
      ['/daily', '1 日の売上'],
      ['/staff', 'スタッフ別の売上'],
      ['/categories', '区分別の売上'],
    ])
  })
})
