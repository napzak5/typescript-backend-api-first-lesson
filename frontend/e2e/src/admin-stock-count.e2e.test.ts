import { MANAGER, OWNER, TOKYO } from '@beauty-salon-frontend/testing/seed'
import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { salonId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { pressWithTheKeyboard, writeInto } from './screen'
import { enterCredentials, heading } from './sign-in'

/*
 * The count of the stock of the salon in Tokyo and its value: a count
 * recorded by its manager with the keyboard alone from the stock, the row
 * that differed said and set to what was counted, and the value read anew
 * with it. The form, what is wrong with it, and the value are shown on a
 * screen as narrow as a phone as well, the value read anew with a use
 * another account recorded meanwhile. The seed data keeps 20 of each of
 * six products there: those of its colours, at ￥800, ￥1,200 and ￥500,
 * are worth ￥50,000.
 */

const COLOUR = 'Hair Color - Natural Brown'

const storedSchema = z.array(
  z.object({
    currentStock: z.string(),
    counted: z.boolean(),
  }),
)

/** The row of the colour of the salon in Tokyo, as the database of the API has it. */
const storedColour = async (api: TestApi) =>
  storedSchema.parse(
    await api.query(
      `select i."currentStock"::text, i."lastCountedAt" is not null as counted
       from inventory i
         join products p on p.id = i."productId"
         join salons s on s.id = i."salonId"
       where s.name = $1 and p."productCode" = 'COLOR001'`,
      [TOKYO],
    ),
  )

/** Lets another account have used 10 tubes of the colour of the salon in Tokyo meanwhile, as the API records it. */
const usedMeanwhile = (api: TestApi): Promise<unknown> =>
  api.query(
    `with used as (
       update inventory i
       set "currentStock" = i."currentStock" - 10,
           "availableStock" = i."availableStock" - 10,
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
     select "salonId", "productId", id, 'use', -10,
            "currentStock" + 10, "currentStock", "lotNumber", "expiryDate"
     from used`,
    [TOKYO],
  )

/** What was counted of the row of a product, named by the product and the lot the seed drew */
const counted = (page: Page, product: string): Locator =>
  page.getByRole('textbox', { name: new RegExp(`^${product}`) })

/** The rows of a table, below its header */
const rowsOf = (page: Page, caption: string): Locator =>
  page
    .getByRole('table', { name: caption, exact: true })
    .getByRole('row')
    .filter({ has: page.getByRole('rowheader') })

test.describe('the count and the value of the stock, in a browser', () => {
  test('should let the manager count the colour from the stock, with the keyboard, and show the value read anew', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/inventory`)
    await enterCredentials(page, MANAGER, api.seedPassword)
    await expect(heading(page, '在庫')).toBeVisible()
    await pressWithTheKeyboard(page.getByRole('link', { name: '棚卸しする' }))
    await expect(heading(page, '棚卸し')).toBeFocused()

    // Act
    const colour = counted(page, COLOUR)
    await writeInto(colour, '17.5')
    await expectSoundPage(page)
    await pressWithTheKeyboard(page.getByRole('button', { name: '記録する' }))

    // Assert
    await expect(
      page.getByText(
        '1 行の棚卸しを記録しました。帳簿の在庫数と差のあった行は 1 行です。',
      ),
    ).toBeVisible()
    await expect(heading(page, '棚卸し')).toBeFocused()
    await expect(rowsOf(page, '帳簿の在庫数と差のあった行')).toHaveCount(1)
    await expect(rowsOf(page, '帳簿の在庫数と差のあった行')).toContainText(
      '−2.5 tube',
    )
    expect(await storedColour(api)).toEqual([
      { currentStock: '17.50', counted: true },
    ])

    // Act
    await pressWithTheKeyboard(page.getByRole('link', { name: '在庫へ' }))
    await expect(heading(page, '在庫')).toBeFocused()
    await pressWithTheKeyboard(page.getByRole('link', { name: '在庫評価額' }))

    // Assert: 2.5 tubes of the colour less, ￥2,000
    await expect(heading(page, '在庫評価額')).toBeFocused()
    await expect(
      rowsOf(page, 'カテゴリーごとの在庫評価額').filter({
        hasText: 'Hair Color',
      }),
    ).toContainText('￥48,000')
  })
})

/** The value of the stock, from the sheet of the other actions of the stock */
const openTheValue = async (page: Page): Promise<void> => {
  await page.getByRole('button', { name: 'ほかの操作' }).click()
  await page
    .getByRole('dialog', { name: 'ほかの操作' })
    .getByRole('link', { name: '在庫評価額' })
    .click()
}

test.describe('the count and the value of the stock, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the form, what is wrong with it, and the value into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    await page.goto(`${ADMIN.origin}/salons/${salon}/inventory/count`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, '棚卸し')).toBeFocused()

    // Act
    await counted(page, COLOUR).fill('-1')
    await page.getByRole('button', { name: '記録する' }).click()

    // Assert
    await expect(counted(page, COLOUR)).toHaveAccessibleDescription(
      /数えた数は、0 から 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。/,
    )
    await expectSoundPage(page)

    // Act: the value is one of the other actions of the stock, in their sheet
    await page.getByRole('link', { name: 'やめる' }).click()
    await openTheValue(page)

    // Assert
    await expect(rowsOf(page, 'カテゴリーごとの在庫評価額')).toHaveCount(3)
    await expectSoundPage(page)

    // Act
    await usedMeanwhile(api)
    await page.getByRole('link', { name: '在庫へ' }).click()
    await openTheValue(page)

    // Assert: read anew, 10 tubes of the colour less, ￥8,000
    await expect(
      rowsOf(page, 'カテゴリーごとの在庫評価額').filter({
        hasText: 'Hair Color',
      }),
    ).toContainText('￥42,000')
  })
})
