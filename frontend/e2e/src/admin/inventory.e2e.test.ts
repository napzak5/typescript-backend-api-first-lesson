import { OWNER, TOKYO } from '@beauty-salon-frontend/testing/seed'
import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from '../support/applications'
import { salonId } from '../support/bookings'
import { expectSoundPage } from '../support/checks'
import { expect, type TestApi, test } from '../support/fixtures'
import { mainMenuLink } from '../support/main-menu'
import { part, pressWithTheKeyboard, writeInto } from '../support/screen'
import { enterCredentials, heading } from '../support/sign-in'

/*
 * The stock of the salon in Tokyo kept by its owner: a row of a new lot
 * added with the keyboard alone from the header; the rows that expire
 * soon read anew with what another account moved meanwhile, the view kept
 * in the address over a reload; and a row emptied meanwhile, removed. The
 * form, with what is wrong with it, is shown on a screen as narrow as a
 * phone as well. The seed data keeps a row of each of six products of the
 * salon in Tokyo, all but the wax: 20 of each, of a lot that expired on 31
 * December 2025.
 */

const SHAMPOO = 'Professional Shampoo 500ml'

const storedSchema = z.array(
  z.object({
    productCode: z.string(),
    currentStock: z.string(),
    lotNumber: z.string().nullable(),
    expiryDate: z.string().nullable(),
    location: z.string().nullable(),
  }),
)

/** The stock rows of a product of the salon in Tokyo, as the database of the API has them. */
const storedRowsOf = async (api: TestApi, productCode: string) =>
  storedSchema.parse(
    await api.query(
      `select p."productCode", i."currentStock"::text, i."lotNumber",
              i."expiryDate"::text, i.location
       from inventory i
         join products p on p.id = i."productId"
         join salons s on s.id = i."salonId"
       where s.name = $1 and p."productCode" = $2
       order by i."lotNumber" nulls first, i.id`,
      [TOKYO, productCode],
    ),
  )

/** Lets another account have used up the stock of a product of the salon in Tokyo meanwhile. */
const usedUpMeanwhile = (api: TestApi, productCode: string): Promise<unknown> =>
  api.query(
    `update inventory i set "currentStock" = 0, "availableStock" = 0, "updatedAt" = now()
     from products p, salons s
     where p.id = i."productId" and s.id = i."salonId"
       and s.name = $1 and p."productCode" = $2`,
    [TOKYO, productCode],
  )

/** The rows of a table of the stock */
const stockRows = (page: Page, caption: string): Locator =>
  page
    .getByRole('table', { name: caption, exact: true })
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader') })

/** A link of the views of the stock */
const viewLink = (page: Page, name: string): Locator =>
  page
    .getByRole('navigation', { name: '在庫の見かた' })
    .getByRole('link', { name, exact: true })

test.describe('the stock of a salon, in a browser', () => {
  test('should let the owner add a row of a lot from the header, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/bookings`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, '予約台帳')).toBeVisible()

    // Act
    await pressWithTheKeyboard(mainMenuLink(page, '在庫'))
    await expect(heading(page, '在庫')).toBeFocused()
    await pressWithTheKeyboard(
      page.getByRole('link', { name: '在庫の行を足す' }),
    )
    await expect(heading(page, '在庫の行を足す')).toBeFocused()
    const product = page.getByRole('combobox', { name: /^商品/ })
    await product.focus()
    await product.selectOption({
      label: 'Hair Color - Natural Brown（COLOR001）',
    })
    await writeInto(
      page.getByRole('textbox', { name: /^ロット番号/ }),
      'LOT-2026-050',
    )
    await writeInto(page.getByLabel('使用期限'), '2027-06-30')
    await writeInto(
      page.getByRole('textbox', { name: '保管場所' }),
      'Back Room',
    )
    await expectSoundPage(page)
    await pressWithTheKeyboard(page.getByRole('button', { name: '足す' }))

    // Assert
    await expect(
      page.getByText(
        '在庫の行「Hair Color - Natural Brown（ロット LOT-2026-050）」を足しました。',
      ),
    ).toBeVisible()
    await expect(heading(page, '在庫の行')).toBeFocused()
    await expect(part(page, '在庫の行')).toContainText('2027年6月30日')
    expect(
      (await storedRowsOf(api, 'COLOR001')).filter(
        ({ lotNumber }) => lotNumber === 'LOT-2026-050',
      ),
    ).toEqual([
      {
        productCode: 'COLOR001',
        currentStock: '0.00',
        lotNumber: 'LOT-2026-050',
        expiryDate: '2027-06-30',
        location: 'Back Room',
      },
    ])
  })

  test('should read the rows that expire soon anew, keep the view over a reload, and remove a row used up meanwhile', async ({
    page,
    api,
  }) => {
    // Arrange: the rows that expire soon once, as the screen reads them
    const salon = await salonId(api)
    await page.goto(`${ADMIN.origin}/salons/${salon}/inventory`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await viewLink(page, '期限切れ間近').click()
    await expect(stockRows(page, '期限切れ間近')).toHaveCount(6)

    // Act
    await usedUpMeanwhile(api, 'SHMP001')
    await viewLink(page, 'すべて').click()
    await expect(stockRows(page, '在庫')).toHaveCount(6)
    await viewLink(page, '期限切れ間近').click()

    // Assert: read anew, the row with no stock left is no longer among them
    await expect(stockRows(page, '期限切れ間近')).toHaveCount(5)
    await expect(
      stockRows(page, '期限切れ間近').filter({ hasText: SHAMPOO }),
    ).toHaveCount(0)

    // Act
    await page.reload()

    // Assert
    await expect(page).toHaveURL(
      `${ADMIN.origin}/salons/${salon}/inventory?view=expiring`,
    )
    await expect(viewLink(page, '期限切れ間近')).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(stockRows(page, '期限切れ間近')).toHaveCount(5)

    // Act
    await viewLink(page, 'すべて').click()
    await page.getByRole('link', { name: SHAMPOO }).click()
    await page.getByRole('link', { name: '在庫の行を直す' }).click()
    await page.getByRole('button', { name: '削除' }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: '削除する' })
      .click()

    // Assert
    await expect(
      page.getByText(
        /^在庫の行「Professional Shampoo 500ml（ロット LOT-2024-\d{3}）」を削除しました。$/,
      ),
    ).toBeVisible()
    await expect(heading(page, '在庫')).toBeFocused()
    await expect(stockRows(page, '在庫')).toHaveCount(5)
    expect(await storedRowsOf(api, 'SHMP001')).toEqual([])
  })
})

test.describe('the stock of a salon, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the rows, the form and what is wrong with it into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/inventory`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(stockRows(page, '在庫')).toHaveCount(6)

    // Assert
    await expectSoundPage(page)

    // Act
    await page.getByRole('link', { name: '在庫の行を足す' }).click()
    // The stock has a choice of a product as well: the form is waited for
    await expect(heading(page, '在庫の行を足す')).toBeFocused()
    await page
      .getByRole('combobox', { name: /^商品/ })
      .selectOption({ label: 'Hair Color - Natural Brown（COLOR001）' })
    await page.getByRole('button', { name: '足す' }).click()

    // Assert
    await expect(
      page.getByRole('textbox', { name: /^ロット番号/ }),
    ).toHaveAccessibleDescription(
      /ロット番号を、100 文字以内で入力してください。この商品は、在庫をロット番号で分けます。/,
    )
    await expectSoundPage(page)
  })
})
