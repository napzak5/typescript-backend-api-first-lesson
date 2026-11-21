import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { salonId, TOKYO } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { mainMenuLink } from './main-menu'
import { enterCredentials, heading, STAFF } from './sign-in'

/*
 * The movements of the row of the colour of the salon in Tokyo: a purchase
 * recorded by its stylist with the keyboard alone from the row, shown first
 * in the history and in the stock that is read anew; the history read anew
 * with a sale another account recorded meanwhile, narrowed, and kept in the
 * address over a reload. The form, with what is wrong with it,
 * and the history are shown on a screen as narrow as a phone as well. The
 * seed data keeps 20 tubes of the colour, of a lot that expired on 31
 * December 2025, and began the history of the row with them.
 */

const COLOUR = 'Hair Color - Natural Brown'

const storedSchema = z.array(
  z.object({
    transactionType: z.string(),
    quantity: z.string(),
    balanceAfter: z.string(),
    unitCost: z.number().nullable(),
    totalCost: z.number().nullable(),
  }),
)

/** The movements of the row of the colour of the salon in Tokyo, as the database of the API has them, the latest first. */
const storedMovements = async (api: TestApi) =>
  storedSchema.parse(
    await api.query(
      `select t."transactionType"::text, t.quantity::text, t."balanceAfter"::text,
              t."unitCost", t."totalCost"
       from inventory_transactions t
         join products p on p.id = t."productId"
         join salons s on s.id = t."salonId"
       where s.name = $1 and p."productCode" = 'COLOR001'
       order by t."createdAt" desc, t.id desc`,
      [TOKYO],
    ),
  )

/** Lets another account have sold a tube of the colour of the salon in Tokyo meanwhile, as the API records it. */
const soldMeanwhile = (api: TestApi): Promise<unknown> =>
  api.query(
    `with sold as (
       update inventory i
       set "currentStock" = i."currentStock" - 1,
           "availableStock" = i."availableStock" - 1,
           "updatedAt" = now()
       from products p, salons s
       where p.id = i."productId" and s.id = i."salonId"
         and s.name = $1 and p."productCode" = 'COLOR001'
       returning i.id, i."salonId", i."productId", i."currentStock",
                 i."lotNumber", i."expiryDate"
     )
     insert into inventory_transactions
       ("salonId", "productId", "inventoryId", "transactionType", quantity,
        "balanceBefore", "balanceAfter", "lotNumber", "expiryDate")
     select "salonId", "productId", id, 'sale', -1,
            "currentStock" + 1, "currentStock", "lotNumber", "expiryDate"
     from sold`,
    [TOKYO],
  )

/** The rows of the table of the movements */
const movementRows = (page: Page, caption = '在庫の移動'): Locator =>
  page
    .getByRole('table', { name: caption, exact: true })
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader') })

/** Presses a link, a button or a choice as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

/** Writes into a control after moving the focus to it. */
const writeInto = async (control: Locator, value: string): Promise<void> => {
  await control.focus()
  await control.fill(value)
}

test.describe('the movements of the stock, in a browser', () => {
  test('should let the stylist record a purchase from the row, with the keyboard, and show it in the history and the stock', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/inventory`)
    await enterCredentials(page, STAFF, api.seedPassword)
    await expect(heading(page, '在庫')).toBeVisible()
    await pressWithTheKeyboard(page.getByRole('link', { name: COLOUR }))
    await expect(heading(page, '在庫の行')).toBeFocused()

    // Act
    await pressWithTheKeyboard(
      page.getByRole('link', { name: '在庫の移動を記録する' }),
    )
    await expect(heading(page, '在庫の移動を記録する')).toBeFocused()
    const purchase = page.getByRole('radio', { name: '仕入れ' })
    await purchase.focus()
    await purchase.press('Space')
    await writeInto(page.getByRole('textbox', { name: /^数量/ }), '12')
    await writeInto(page.getByRole('textbox', { name: '単価（円）' }), '1,250')
    await expectSoundPage(page)
    await pressWithTheKeyboard(page.getByRole('button', { name: '記録する' }))

    // Assert
    await expect(
      page.getByText('仕入れを記録しました。在庫数は 32 tube になりました。'),
    ).toBeVisible()
    await expect(heading(page, '在庫の移動')).toBeFocused()
    await expect(movementRows(page)).toHaveCount(2)
    await expect(movementRows(page).first()).toContainText('+12 tube')
    await expect(movementRows(page).first()).toContainText('￥15,000')
    expect((await storedMovements(api))[0]).toEqual({
      transactionType: 'purchase',
      quantity: '12.00',
      balanceAfter: '32.00',
      unitCost: 1250,
      totalCost: 15000,
    })

    // Act
    await pressWithTheKeyboard(mainMenuLink(page, '在庫'))

    // Assert: read anew, the row has the stock the purchase left
    await expect(heading(page, '在庫')).toBeFocused()
    await expect(
      page
        .getByRole('table', { name: '在庫', exact: true })
        .getByRole('row')
        .filter({ hasText: 'COLOR001' }),
    ).toContainText('32 tube')
  })

  test('should read the history anew, narrow it to a kind, and keep it over a reload', async ({
    page,
    api,
  }) => {
    // Arrange: the history once, as the screen reads it
    const salon = await salonId(api)
    await page.goto(`${ADMIN.origin}/salons/${salon}/inventory`)
    await enterCredentials(page, STAFF, api.seedPassword)
    await page.getByRole('link', { name: COLOUR }).click()
    await page.getByRole('link', { name: '在庫の移動の履歴' }).click()
    await expect(movementRows(page)).toHaveCount(1)

    // Act
    await soldMeanwhile(api)
    await page.getByRole('link', { name: '在庫の行へ' }).click()
    await expect(heading(page, '在庫の行')).toBeFocused()
    await page.getByRole('link', { name: '在庫の移動の履歴' }).click()

    // Assert: read anew, the sale is the first of the movements
    await expect(movementRows(page)).toHaveCount(2)
    await expect(movementRows(page).first()).toContainText('店頭販売')

    // Act
    await page
      .getByRole('combobox', { name: '区分' })
      .selectOption({ label: '在庫の調整' })
    await page.getByRole('button', { name: '表示する' }).click()
    await expect(movementRows(page, '条件に合う在庫の移動')).toHaveCount(1)
    await page.reload()

    // Assert
    await expect(page).toHaveURL(/\/movements\?type=adjustment$/)
    await expect(page.getByRole('combobox', { name: '区分' })).toHaveValue(
      'adjustment',
    )
    await expect(movementRows(page, '条件に合う在庫の移動')).toContainText(
      '在庫移動の記録を始めた時点の在庫数',
    )
  })
})

test.describe('the movements of the stock, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the form, what is wrong with it, and the history into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/inventory`)
    await enterCredentials(page, STAFF, api.seedPassword)
    await page.getByRole('link', { name: COLOUR }).click()
    await page.getByRole('link', { name: '在庫の移動を記録する' }).click()
    await expect(heading(page, '在庫の移動を記録する')).toBeFocused()

    // Act
    await page.getByRole('radio', { name: '返品' }).check()
    await page.getByRole('button', { name: '記録する' }).click()

    // Assert
    await expect(
      page.getByRole('radiogroup', { name: /^向き/ }),
    ).toHaveAccessibleDescription(/在庫が増えるか、減るかを選んでください。/)
    await expectSoundPage(page)

    // Act
    await page.getByRole('link', { name: 'やめる' }).click()
    await page.getByRole('link', { name: '在庫の移動の履歴' }).click()

    // Assert
    await expect(movementRows(page)).toHaveCount(1)
    await expectSoundPage(page)
  })
})
