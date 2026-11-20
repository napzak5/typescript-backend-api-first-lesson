import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { salonId, TOKYO } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { enterCredentials, heading, OWNER } from './sign-in'

/*
 * The product ledger of the salon in Tokyo kept by its owner: a product
 * added with the keyboard alone from the header; the ledger read anew
 * with what another account changed meanwhile; and a product the salon
 * stops carrying, which the form of a treatment record then no longer
 * offers among its materials. The form, with what is wrong with it, is
 * shown on a screen as narrow as a phone as well. The seed data has seven
 * products for the salon in Tokyo, all carried; the conditioner is a
 * material of no treatment record.
 */

const CONDITIONER = 'Professional Conditioner 500ml'

const storedSchema = z.array(
  z.object({
    productCode: z.string(),
    name: z.string(),
    unit: z.string(),
    salonPrice: z.number().nullable(),
    minimumStock: z.string(),
    reorderPoint: z.string().nullable(),
    isForSale: z.boolean(),
    isForTreatment: z.boolean(),
    isActive: z.boolean(),
  }),
)

/** The products of the salon in Tokyo of a code, as the database of the API has them. */
const storedProductsCoded = async (api: TestApi, productCode: string) =>
  storedSchema.parse(
    await api.query(
      `select p."productCode", p.name, p.unit, p."salonPrice", p."minimumStock"::text,
              p."reorderPoint"::text, p."isForSale", p."isForTreatment", p."isActive"
       from products p join salons s on s.id = p."salonId"
       where s.name = $1 and p."productCode" = $2 and p."deletedAt" is null`,
      [TOKYO, productCode],
    ),
  )

/** Lets another account have stopped carrying a product of the salon in Tokyo meanwhile. */
const droppedMeanwhile = (
  api: TestApi,
  productCode: string,
): Promise<unknown> =>
  api.query(
    `update products p set "isActive" = false, "updatedAt" = now()
     from salons s
     where s.id = p."salonId" and s.name = $1 and p."productCode" = $2`,
    [TOKYO, productCode],
  )

/** The row of the ledger of a product, by its code */
const ledgerRow = (page: Page, productCode: string): Locator =>
  page
    .getByRole('table', { name: '商品台帳', exact: true })
    .getByRole('row')
    .filter({ hasText: productCode })

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

/** A link of the navigation of the application */
const navigationLink = (page: Page, name: string): Locator =>
  page
    .getByRole('navigation', { name: 'メインメニュー' })
    .getByRole('link', { name, exact: true })

/** The products the form of a treatment record offers for its material of a number */
const offeredMaterials = (page: Page, number: number): Locator =>
  page
    .getByRole('group', { name: `${number} 件目の商材` })
    .getByRole('combobox', { name: /商品/ })
    .getByRole('option')

/** Opens the form of the first treatment record of the salon, the colour, and adds a third material to it. */
const openTheColourAndAddAMaterial = async (page: Page): Promise<void> => {
  await navigationLink(page, '施術記録').click()
  await page
    .getByRole('table', { name: '施術記録', exact: true })
    .getByRole('rowheader')
    .first()
    .getByRole('link')
    .click()
  await page.getByRole('link', { name: '施術記録を直す' }).click()
  await page.getByRole('button', { name: '商材を足す' }).click()
}

test.describe('the product ledger of a salon, in a browser', () => {
  test('should let the owner add a product from the header, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/bookings`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, '予約台帳')).toBeVisible()

    // Act
    await pressWithTheKeyboard(navigationLink(page, '商品'))
    await expect(heading(page, '商品台帳')).toBeFocused()
    await pressWithTheKeyboard(page.getByRole('link', { name: '商品を足す' }))
    await expect(heading(page, '商品を足す')).toBeFocused()
    await writeInto(
      page.getByRole('textbox', { name: /^商品コード/ }),
      'OIL001',
    )
    await writeInto(page.getByRole('textbox', { name: /^単位/ }), 'bottle')
    await writeInto(
      page.getByRole('textbox', { name: /^商品名/ }),
      'Hair Oil 100ml',
    )
    await writeInto(page.getByRole('textbox', { name: /^販売価格/ }), '2,800')
    await writeInto(page.getByRole('textbox', { name: /^発注点/ }), '3')
    const sold = page.getByRole('checkbox', { name: '店頭で販売する' })
    await sold.focus()
    await sold.press('Space')
    await expectSoundPage(page)
    await pressWithTheKeyboard(page.getByRole('button', { name: '足す' }))

    // Assert
    await expect(
      page.getByText('商品「Hair Oil 100ml」を足しました。'),
    ).toBeVisible()
    await expect(heading(page, '商品の内容')).toBeFocused()
    await expect(page.getByRole('region', { name: '価格' })).toContainText(
      '￥2,800',
    )
    expect(await storedProductsCoded(api, 'OIL001')).toEqual([
      {
        productCode: 'OIL001',
        name: 'Hair Oil 100ml',
        unit: 'bottle',
        salonPrice: 2800,
        minimumStock: '0.00',
        reorderPoint: '3.00',
        isForSale: true,
        isForTreatment: true,
        isActive: true,
      },
    ])
  })

  test('should read the ledger anew, and no longer offer a product the owner stopped carrying among the materials of a treatment record', async ({
    page,
    api,
  }) => {
    // Arrange: the ledger and the products offered once, as the screens read them
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/products`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(ledgerRow(page, 'WAX001')).toContainText('取り扱い中')
    await openTheColourAndAddAMaterial(page)
    await expect(
      offeredMaterials(page, 3).filter({ hasText: CONDITIONER }),
    ).toHaveCount(1)

    // Act
    await droppedMeanwhile(api, 'WAX001')
    await navigationLink(page, '商品').click()
    // The ledger is read anew: it has what another account changed meanwhile
    await expect(ledgerRow(page, 'WAX001')).toContainText('取り扱いをやめた')
    await page.getByRole('link', { name: CONDITIONER }).click()
    await page.getByRole('link', { name: '商品を直す' }).click()
    await page.getByRole('checkbox', { name: '取り扱い中' }).uncheck()
    await page.getByRole('button', { name: '変更を保存する' }).click()
    await expect(heading(page, '商品の内容')).toBeFocused()
    await openTheColourAndAddAMaterial(page)

    // Assert
    await expect(offeredMaterials(page, 3)).not.toHaveCount(0)
    await expect(
      offeredMaterials(page, 3).filter({ hasText: CONDITIONER }),
    ).toHaveCount(0)
    expect(await storedProductsCoded(api, 'COND001')).toMatchObject([
      { isActive: false },
    ])
  })
})

test.describe('the product ledger of a salon, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the ledger, the form and what is wrong with it into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    await page.goto(`${ADMIN.origin}/salons/${salon}/products`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(
      page.getByRole('table', { name: '商品台帳', exact: true }),
    ).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await page.getByRole('link', { name: '商品を足す' }).click()
    const reorder = page.getByRole('textbox', { name: /^発注点/ })
    await page.getByRole('textbox', { name: /^最低在庫数/ }).fill('10')
    await reorder.fill('5')
    await page.getByRole('button', { name: '足す' }).click()

    // Assert
    await expect(reorder).toHaveAccessibleDescription(
      /発注点は、最低在庫数と同じか、それより大きい数にしてください。/,
    )
    await expectSoundPage(page)
  })
})
