import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { salonId, TOKYO } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { enterCredentials, heading, OWNER } from './sign-in'

/*
 * What the salon in Tokyo orders and receives: its owner, with the
 * keyboard alone, makes an order of what the suggestions say of ColorTech
 * Japan, moves it on to the supplier and records the goods that came, and
 * the stock of the colour grows by them. The receipt with what is wrong
 * with it, and the suggestions, are shown on a screen as narrow as a phone
 * as well. Of the products of the seed data, only the colour comes to its
 * reorder point: 20 tubes, ordered up to 100. The seed data has the order
 * PO-SEED-0002, placed with the supplier, of 12 jars of its mask.
 */

const COLOUR = 'Hair Color - Natural Brown'

const stockSchema = z.tuple([z.object({ currentStock: z.string() })])

/** The stock of the colour of the salon in Tokyo, as the database of the API has it */
const colourStockOf = async (api: TestApi): Promise<string> =>
  stockSchema.parse(
    await api.query(
      `select i."currentStock"::text as "currentStock"
       from inventory i
         join products p on p.id = i."productId"
         join salons s on s.id = i."salonId"
       where s.name = $1 and p."productCode" = 'COLOR001'`,
      [TOKYO],
    ),
  )[0].currentStock

const ordersSchema = z.array(z.object({ status: z.string() }))

/** The orders of the salon in Tokyo to ColorTech Japan, as the database of the API has them */
const colourOrdersOf = async (api: TestApi) =>
  ordersSchema.parse(
    await api.query(
      `select po.status::text from purchase_orders po
         join salons s on s.id = po."salonId"
       where s.name = $1 and po.supplier = 'ColorTech Japan'`,
      [TOKYO],
    ),
  )

/** The heading of an order, whose number the API gave it */
const orderHeading = (page: Page): Locator =>
  page.getByRole('heading', { level: 1, name: /^発注 PO-/ })

const status = (page: Page): Locator =>
  page.getByRole('region', { name: '状態' })

const statusHeading = (page: Page): Locator =>
  page.getByRole('heading', { name: '状態' })

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

/** Moves an order on by a button of its status, and waits for the status it moves to. */
const moveOn = async (
  page: Page,
  button: string,
  reached: string,
): Promise<void> => {
  await pressWithTheKeyboard(status(page).getByRole('button', { name: button }))
  await expect(statusHeading(page)).toBeFocused()
  await expect(status(page)).toContainText(reached)
}

test.describe('the goods that come for a purchase order, in a browser', () => {
  test('should let the owner order what is suggested, move the order on and record the goods that came, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(
      `${ADMIN.origin}/salons/${await salonId(api)}/purchase-orders`,
    )
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, '発注')).toBeVisible()

    // Act
    await pressWithTheKeyboard(page.getByRole('link', { name: '発注の提案' }))
    await pressWithTheKeyboard(
      page.getByRole('link', { name: 'ColorTech Japan への発注を作る' }),
    )

    // Assert
    await expect(heading(page, '発注を作る')).toBeVisible()
    await expect(page.getByRole('textbox', { name: '仕入先' })).toHaveValue(
      'ColorTech Japan',
    )
    await expect(
      page
        .getByRole('group', { name: new RegExp(`^${COLOUR}`) })
        .getByRole('textbox', { name: '数量' }),
    ).toHaveValue('80')
    await expect(page.getByText('小計 ￥64,000')).toBeVisible()

    // Act
    await page.getByRole('textbox', { name: '税額（円）' }).focus()
    await page.keyboard.type('6400')
    await pressWithTheKeyboard(page.getByRole('button', { name: '発注を作る' }))
    await expect(orderHeading(page)).toBeFocused()
    await moveOn(page, '承認を依頼する', '承認待ち')
    await moveOn(page, '承認する', '承認済み')
    await moveOn(page, '発注済みにする', '発注済み')
    await pressWithTheKeyboard(
      status(page).getByRole('link', { name: '入荷を記録する' }),
    )

    // Assert
    await expect(heading(page, '入荷を記録する')).toBeFocused()
    await expect(
      page.getByRole('textbox', { name: `COLOR001 ${COLOUR}` }),
    ).toHaveValue('80')

    // Act
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '入荷を記録する' }),
    )

    // Assert
    await expect(orderHeading(page)).toBeFocused()
    await expect(page.getByText(/の入荷を記録しました。/)).toBeVisible()
    await expect(status(page)).toContainText('納品済み')
    expect(await colourStockOf(api)).toBe('100.00')
    expect(await colourOrdersOf(api)).toEqual([{ status: 'delivered' }])
  })
})

test.describe('the goods that come for a purchase order, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the receipt with what is wrong with it, and the suggestions, into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    const [order] = z
      .array(z.object({ id: z.string() }))
      .parse(
        await api.query(
          `select id::text from purchase_orders where "orderNumber" = 'PO-SEED-0002'`,
        ),
      )
    await page.goto(
      `${ADMIN.origin}/salons/${salon}/purchase-orders/${order?.id ?? ''}/receive`,
    )
    await enterCredentials(page, OWNER, api.seedPassword)
    const mask = page.getByRole('textbox', {
      name: 'TREAT001 Intensive Hair Mask 250ml',
    })
    await expect(mask).toHaveValue('12')

    // Act
    await mask.fill('13')
    await page.getByRole('button', { name: '入荷を記録する' }).click()

    // Assert
    await expect(mask).toHaveAccessibleDescription(/発注した 12 jar までの数/)
    await expectSoundPage(page)

    // Act
    await page.goto(
      `${ADMIN.origin}/salons/${salon}/purchase-orders/suggestions`,
    )

    // Assert
    await expect(
      page.getByRole('region', { name: 'ColorTech Japan', exact: true }),
    ).toBeVisible()
    await expectSoundPage(page)
  })
})
