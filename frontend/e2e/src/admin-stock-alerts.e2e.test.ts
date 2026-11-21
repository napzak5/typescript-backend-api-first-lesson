import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { salonId, TOKYO } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { enterCredentials, heading, MANAGER, STAFF } from './sign-in'

/*
 * The alerts of the stock of the salon in Tokyo: the expiry of the colour
 * seen to by its stylist with the keyboard alone from the stock, with
 * notes, and the alerts read anew. The filter, the table and the dialog are
 * shown on a screen as narrow as a phone as well. The seed data keeps a row
 * of each of six products there, of lots that expired on 31 December 2025:
 * each has a critical alert.
 */

const storedSchema = z.array(
  z.object({
    productCode: z.string(),
    notes: z.string().nullable(),
    member: z.string().nullable(),
  }),
)

/** The acknowledgements of the alerts of the salon in Tokyo, with the email of the account that wrote each. */
const storedAcknowledgements = async (api: TestApi) =>
  storedSchema.parse(
    await api.query(
      `select p."productCode", a.notes, u.email as member
       from inventory_alert_acknowledgements a
         join products p on p.id = a."productId"
         join salons s on s.id = a."salonId"
         left join users u on u."staffId" = a."acknowledgedBy"
       where s.name = $1`,
      [TOKYO],
    ),
  )

/** The button that sees to the expiry of the row of a product, named by the product and the lot the seed drew */
const seeTo = (page: Page, product: string): Locator =>
  page.getByRole('button', {
    name: new RegExp(`^${product}（ロット .+）の期限切れを確認済みにする$`),
  })

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

test.describe('the alerts of the stock, in a browser', () => {
  test('should let the stylist see to the expiry of the colour from the stock, with the keyboard, and read the alerts anew', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/inventory`)
    await enterCredentials(page, STAFF, api.seedPassword)
    await expect(heading(page, '在庫')).toBeVisible()
    await pressWithTheKeyboard(
      page.getByRole('link', { name: '在庫のアラート' }),
    )
    await expect(heading(page, '在庫のアラート')).toBeFocused()
    await expect(
      page.getByText(
        '今出ているアラートは 6 件で、そのうち 6 件が未確認です。',
      ),
    ).toBeVisible()

    // Act
    await pressWithTheKeyboard(seeTo(page, 'Hair Color - Natural Brown'))
    const notes = page
      .getByRole('dialog')
      .getByRole('textbox', { name: 'メモ' })
    // The dialog takes the focus to its notes
    await expect(notes).toBeFocused()
    await page.keyboard.type('廃棄する。メーカーには連絡済み。')
    await expectSoundPage(page)
    await pressWithTheKeyboard(
      page.getByRole('dialog').getByRole('button', { name: '確認済みにする' }),
    )

    // Assert
    await expect(
      page.getByText(
        /^Hair Color - Natural Brown（ロット .+）の期限切れを確認済みにしました。$/,
      ),
    ).toBeVisible()
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(heading(page, '在庫のアラート')).toBeFocused()
    await expect(
      page.getByText(
        '今出ているアラートは 6 件で、そのうち 5 件が未確認です。',
      ),
    ).toBeVisible()
    await expect(seeTo(page, 'Hair Color - Natural Brown')).toHaveCount(0)
    expect(await storedAcknowledgements(api)).toEqual([
      {
        productCode: 'COLOR001',
        notes: '廃棄する。メーカーには連絡済み。',
        member: STAFF,
      },
    ])
  })
})

test.describe('the alerts of the stock, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the filter, the alerts and the dialog into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(
      `${ADMIN.origin}/salons/${await salonId(api)}/inventory/alerts`,
    )
    await enterCredentials(page, MANAGER, api.seedPassword)
    await expect(heading(page, '在庫のアラート')).toBeFocused()

    // Act: the conditions are in the sheet that the button 「条件」 opens
    await page.getByRole('button', { name: '条件', exact: true }).click()
    const sheet = page.getByRole('dialog', { name: '在庫のアラートを絞り込む' })
    await sheet.getByRole('combobox', { name: '確認' }).selectOption('未確認')
    await sheet.getByRole('button', { name: '表示する' }).click()

    // Assert
    const table = page.getByRole('table', {
      name: '条件に合う在庫のアラート',
      exact: true,
    })
    await expect(
      table.getByRole('row').filter({ has: page.getByRole('rowheader') }),
    ).toHaveCount(6)
    expect(new URL(page.url()).search).toBe('?acknowledged=false')
    await expect(sheet).toBeHidden()
    await expect(
      page.getByRole('button', { name: '条件（1）', exact: true }),
    ).toBeVisible()
    await expectSoundPage(page)

    // Act
    await seeTo(page, 'Lightening Powder 500g').click()

    // Assert
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectSoundPage(page)

    // Act
    await page.getByRole('dialog').getByRole('button', { name: '戻る' }).click()

    // Assert: nothing was recorded
    await expect(page.getByRole('dialog')).toBeHidden()
    expect(await storedAcknowledgements(api)).toEqual([])
  })
})
