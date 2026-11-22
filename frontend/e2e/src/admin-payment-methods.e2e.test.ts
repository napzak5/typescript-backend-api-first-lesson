import { OWNER, TOKYO } from '@beauty-salon-frontend/testing/seed'
import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { salonId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { mainMenuLink } from './main-menu'
import { enterCredentials, heading } from './sign-in'

/*
 * The payment methods of the salon in Tokyo kept by its owner: one added
 * with the keyboard alone from the settings, and one the salon stops
 * using, which the screen that records a payment then no longer offers.
 * The form, with what is wrong with it, is shown on a screen as narrow as
 * a phone as well. The seed data has seven methods for every salon and no
 * sales.
 */

const SALE = 'SL-E2E-0401'

/** Puts a sale of ￥5,000 to nobody of the ledger into the database, entered now and not paid. */
const arrangeUnpaidSale = (api: TestApi): Promise<string> =>
  api.idOf(
    `with sold as (
         insert into sales ("saleNumber", "salonId", "saleDate", "saleTime", subtotal,
                            "taxAmount", "totalAmount")
         select $2, id, (now() at time zone 'Asia/Tokyo')::date, now(), 5000, 0, 5000
         from salons where name = $1
         returning id
       ), lines as (
         insert into sales_details ("saleId", "itemType", "itemName", quantity, "unitPrice",
                                    "taxAmount", "totalAmount")
         select id, 'service', 'カット', 1, 5000, 0, 5000 from sold
       )
       select id::text from sold`,
    [TOKYO, SALE],
  )

const storedSchema = z.array(
  z.object({
    method: z.string(),
    displayName: z.string(),
    fee: z.string().nullable(),
    maximumAmount: z.number().nullable(),
    isOnlineEnabled: z.boolean(),
    isOfflineEnabled: z.boolean(),
    sortOrder: z.number(),
    isActive: z.boolean(),
  }),
)

/** The payment methods of the salon in Tokyo of a name, as the database of the API has them. */
const storedMethodsNamed = async (api: TestApi, displayName: string) =>
  storedSchema.parse(
    await api.query(
      `select p.method::text, p."displayName", p.fee::text, p."maximumAmount",
              p."isOnlineEnabled", p."isOfflineEnabled", p."sortOrder", p."isActive"
       from payment_methods p join salons s on s.id = p."salonId"
       where s.name = $1 and p."displayName" = $2`,
      [TOKYO, displayName],
    ),
  )

/** Lets another account have renamed a payment method of the salon in Tokyo meanwhile. */
const renamedMeanwhile = (
  api: TestApi,
  displayName: string,
  renamed: string,
): Promise<unknown> =>
  api.query(
    `update payment_methods p set "displayName" = $3, "updatedAt" = now()
     from salons s
     where s.id = p."salonId" and s.name = $1 and p."displayName" = $2`,
    [TOKYO, displayName, renamed],
  )

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

/** Writes into a control after moving the focus to it. */
const writeInto = async (control: Locator, value: string): Promise<void> => {
  await control.focus()
  await control.fill(value)
}

/** The methods the screen that records a payment offers */
const offered = (page: Page): Locator =>
  page.getByRole('radiogroup', { name: '支払い方法' }).getByRole('radio')

test.describe('the payment methods of a salon, in a browser', () => {
  test('should let the owner add a method from the settings, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/settings`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, 'サロンの設定')).toBeVisible()

    // Act
    await pressWithTheKeyboard(
      page.getByRole('link', { name: '支払い方法を見る' }),
    )
    await expect(heading(page, '支払い方法')).toBeFocused()
    await pressWithTheKeyboard(
      page.getByRole('link', { name: '支払い方法を足す' }),
    )
    await expect(heading(page, '支払い方法を足す')).toBeFocused()
    const kind = page.getByRole('combobox', { name: /種類/ })
    await kind.focus()
    await kind.selectOption({ label: 'QR コード決済' })
    await writeInto(
      page.getByRole('textbox', { name: /表示名/ }),
      'PayPay（店頭）',
    )
    await writeInto(
      page.getByRole('textbox', { name: '1 回の金額の上限（円）' }),
      '50,000',
    )
    await writeInto(
      page.getByRole('textbox', { name: '手数料率（%）' }),
      '1.98',
    )
    await expectSoundPage(page)
    await pressWithTheKeyboard(page.getByRole('button', { name: '足す' }))

    // Assert
    await expect(
      page.getByText('支払い方法「PayPay（店頭）」を足しました。'),
    ).toBeVisible()
    await expect(heading(page, '支払い方法の内容')).toBeFocused()
    await expect(
      page.getByRole('region', { name: '支払い方法' }),
    ).toContainText('￥50,000まで')
    expect(await storedMethodsNamed(api, 'PayPay（店頭）')).toEqual([
      {
        method: 'qr_payment',
        displayName: 'PayPay（店頭）',
        fee: '1.98',
        maximumAmount: 50000,
        isOnlineEnabled: false,
        isOfflineEnabled: true,
        sortOrder: 8,
        isActive: true,
      },
    ])
  })

  test('should no longer offer a method the owner stopped using on the screen that records a payment', async ({
    page,
    api,
  }) => {
    // Arrange: the methods offered once, as the counter read them
    const saleId = await arrangeUnpaidSale(api)
    await page.goto(
      `${ADMIN.origin}/salons/${await salonId(api)}/sales/${saleId}/payments/new`,
    )
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, '支払いを記録する')).toBeVisible()
    await expect(offered(page)).toHaveCount(7)
    await expect(
      page.getByRole('radio', { name: 'QR Code Payment' }),
    ).toBeVisible()

    // Act
    await renamedMeanwhile(api, 'Cash', '現金')
    await mainMenuLink(page, '設定').click()
    await page.getByRole('link', { name: '支払い方法を見る' }).click()
    // The list is read anew: it has what another account changed meanwhile
    await expect(
      page.getByRole('link', { name: '現金', exact: true }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'QR Code Payment' }).click()
    await page.getByRole('link', { name: '支払い方法を直す' }).click()
    await page.getByRole('checkbox', { name: 'この支払い方法を使う' }).uncheck()
    await page.getByRole('button', { name: '変更を保存する' }).click()
    await expect(heading(page, '支払い方法の内容')).toBeFocused()
    await mainMenuLink(page, '売上').click()
    await page.getByRole('link', { name: SALE, exact: true }).click()
    await page.getByRole('link', { name: '支払いを記録する' }).click()

    // Assert
    await expect(heading(page, '支払いを記録する')).toBeFocused()
    await expect(offered(page)).toHaveCount(6)
    await expect(
      page.getByRole('radio', { name: 'QR Code Payment' }),
    ).toHaveCount(0)
    expect(await storedMethodsNamed(api, 'QR Code Payment')).toMatchObject([
      { isActive: false },
    ])
  })
})

test.describe('the payment methods of a salon, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the form and what is wrong with it into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(
      `${ADMIN.origin}/salons/${await salonId(api)}/settings/payment-methods/new`,
    )
    await enterCredentials(page, OWNER, api.seedPassword)
    const most = page.getByRole('textbox', { name: '1 回の金額の上限（円）' })
    await page
      .getByRole('textbox', { name: '1 回の金額の下限（円）' })
      .fill('2000')
    await most.fill('1000')

    // Act
    await page.getByRole('button', { name: '足す' }).click()

    // Assert
    await expect(most).toHaveAccessibleDescription(
      /上限は、下限と同じか、下限より大きい金額にしてください。/,
    )
    await expectSoundPage(page)
  })
})
