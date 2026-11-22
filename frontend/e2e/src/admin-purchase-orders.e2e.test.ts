import { OWNER, STYLIST, TOKYO } from '@beauty-salon-frontend/testing/seed'
import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { salonId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { enterCredentials, heading } from './sign-in'

/*
 * The purchase orders of the salon in Tokyo: an order made by a member of
 * its staff with the keyboard alone from the stock, through the
 * navigation, its subtotal worked out as it is entered, and the order
 * shown once it is made. The orders, the form, what is wrong with it, and
 * an order are shown on a screen as narrow as a phone as well. The seed
 * data has two orders of the salon, PO-SEED-0001 and PO-SEED-0002, and
 * keeps a row of its shampoo, bought at ￥1,500.
 */

const SHAMPOO = 'Professional Shampoo 500ml'

const storedSchema = z.array(
  z.object({
    orderNumber: z.string(),
    status: z.string(),
    subtotal: z.number(),
    taxAmount: z.number(),
    totalAmount: z.number(),
    madeByStaff: z.boolean(),
  }),
)

/** The orders of the salon in Tokyo to a supplier, as the database of the API has them. */
const storedOrdersTo = async (api: TestApi, supplier: string) =>
  storedSchema.parse(
    await api.query(
      `select po."orderNumber", po.status::text, po.subtotal, po."taxAmount",
              po."totalAmount", po."createdBy" is not null as "madeByStaff"
       from purchase_orders po join salons s on s.id = po."salonId"
       where s.name = $1 and po.supplier = $2`,
      [TOKYO, supplier],
    ),
  )

/** A control of the row of a product, named by the product and the lot the seed drew */
const ofRow = (page: Page, product: string, label: string): Locator =>
  page
    .getByRole('group', { name: new RegExp(`^${product}（`) })
    .getByRole('textbox', { name: label })

/** The rows of a table, below its header */
const rowsOf = (page: Page, caption: string): Locator =>
  page
    .getByRole('table', { name: caption, exact: true })
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader') })

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

const ORDER_HEADING = /^発注 PO-/

test.describe('the purchase orders, in a browser', () => {
  test('should let a member of the staff make an order from the stock, with the keyboard, and show it', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/inventory`)
    await enterCredentials(page, STYLIST, api.seedPassword)
    await expect(heading(page, '在庫')).toBeVisible()
    await pressWithTheKeyboard(
      page.getByRole('link', { name: '発注', exact: true }),
    )
    await expect(heading(page, '発注')).toBeFocused()
    await expect(rowsOf(page, '発注')).toHaveCount(2)
    await pressWithTheKeyboard(page.getByRole('link', { name: '発注を作る' }))
    await expect(heading(page, '発注を作る')).toBeFocused()

    // Act
    await page
      .getByRole('textbox', { name: '仕入先' })
      .fill('Tokyo Beauty Supply')
    await expect(ofRow(page, SHAMPOO, '単価（円）')).toHaveValue('1500')
    const quantity = ofRow(page, SHAMPOO, '数量')
    await quantity.focus()
    await page.keyboard.type('6')
    await expect(page.getByText('小計 ￥9,000')).toBeVisible()
    await page.getByRole('textbox', { name: '税額（円）' }).fill('900')
    await expectSoundPage(page)
    await pressWithTheKeyboard(page.getByRole('button', { name: '発注を作る' }))

    // Assert
    await expect(
      page.getByText(/^発注 PO-\S+ を下書きとして作りました。$/),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 1, name: ORDER_HEADING }),
    ).toBeFocused()
    await expect(
      page.getByRole('table', { name: '明細', exact: true }),
    ).toContainText('￥9,000')
    expect(await storedOrdersTo(api, 'Tokyo Beauty Supply')).toEqual([
      {
        orderNumber: expect.stringMatching(/^PO-/),
        status: 'draft',
        subtotal: 9000,
        taxAmount: 900,
        totalAmount: 9900,
        madeByStaff: true,
      },
    ])

    // Act
    await pressWithTheKeyboard(page.getByRole('link', { name: '発注へ' }))

    // Assert: the list was read anew, with the order first
    await expect(heading(page, '発注')).toBeFocused()
    await expect(rowsOf(page, '発注')).toHaveCount(3)
    await expect(rowsOf(page, '発注').first()).toContainText('下書き')
  })
})

test.describe('the purchase orders, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the orders, the form, what is wrong with it, and an order into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(
      `${ADMIN.origin}/salons/${await salonId(api)}/purchase-orders`,
    )
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, '発注')).toBeFocused()
    await expect(rowsOf(page, '発注')).toHaveCount(2)
    await expectSoundPage(page)

    // Act
    await page.getByRole('link', { name: '発注を作る' }).click()
    await expect(ofRow(page, SHAMPOO, '数量')).toBeVisible()
    await page.getByRole('button', { name: '発注を作る' }).click()

    // Assert
    await expect(
      page.getByRole('textbox', { name: '仕入先' }),
    ).toHaveAccessibleDescription(/仕入先を入力してください。$/)
    await expectSoundPage(page)

    // Act
    await page.getByRole('link', { name: 'やめる' }).click()
    await page.getByRole('link', { name: 'PO-SEED-0002' }).click()

    // Assert
    await expect(heading(page, '発注 PO-SEED-0002')).toBeVisible()
    await expect(
      page.getByRole('table', { name: '明細', exact: true }),
    ).toContainText('Intensive Hair Mask 250ml')
    await expectSoundPage(page)
  })
})
