import { KENJI, OWNER } from '@beauty-salon-frontend/testing/seed'
import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { salonId } from './bookings'
import { expectSoundPage, sidewaysScrollOf } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { enterCredentials, heading } from './sign-in'

/*
 * The second customer of the seed data, Yamamoto Kenji, was registered
 * again by phone, with another address of mail and no kana: an owner
 * merges the second record into the first from the page of the first.
 */

const AGAIN = { email: 'kenji.yamamoto@example.com' }

const idsSchema = z.tuple([z.object({ kenji: z.uuid(), again: z.uuid() })])

/** What the staff noted of the second record when it was registered: a long note */
const NOTES =
  'お電話でご予約。前回のカラーで頭皮がしみたとのことで、薬剤を変えてほしいとのご要望あり。次回はカットとトリートメントのみを希望。駐車場の有無を気にされていたので、近くのコインパーキングをご案内した。'

/** Puts the second record into the database, and returns the IDs of both. */
const arrangeAgain = async (
  api: TestApi,
): Promise<{ kenji: string; again: string }> => {
  const [ids] = idsSchema.parse(
    await api.query(
      `with again as (
         insert into customers ("lastName", "firstName", email, "phoneNumber", tags, notes)
         values ('Yamamoto', 'Kenji', $2, '+81-90-1111-2222', '{}', $3)
         returning id
       )
       select customers.id::text as kenji, again.id::text as again
       from customers cross join again
       where customers.email = $1 and customers."deletedAt" is null`,
      [KENJI.email, AGAIN.email, NOTES],
    ),
  )

  return ids
}

const storedSchema = z.array(
  z.object({
    email: z.string(),
    present: z.boolean(),
    bookings: z.coerce.number(),
  }),
)

/** Both records as the database of the API has them: whether they are in the ledger, and how many bookings each has. */
const storedRecords = async (api: TestApi) =>
  storedSchema.parse(
    await api.query(
      `select email, "deletedAt" is null as present,
              (select count(*) from bookings where "customerId" = customers.id) as bookings
       from customers where email in ($1, $2) order by email`,
      [KENJI.email, AGAIN.email],
    ),
  )

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

const part = (page: Page, name: string): Locator =>
  page.getByRole('region', { name })

const dialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: '2 人のお客様を 1 人にまとめますか？' })

test.describe('merging two records of one customer, in a browser', () => {
  test('should find the other record from the page of the customer, and merge it into the customer, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    const { kenji, again } = await arrangeAgain(api)
    const before = await storedRecords(api)
    const salon = await salonId(api)
    await page.goto(`${ADMIN.origin}/salons/${salon}/customers/${kenji}`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, 'お客様の台帳')).toBeFocused()

    // Act: the other record, searched for and chosen
    await pressWithTheKeyboard(
      part(page, '台帳の管理').getByRole('link', {
        name: 'ほかのお客様とまとめる',
      }),
    )
    await expect(heading(page, 'ほかのお客様とまとめる')).toBeFocused()
    await page.getByRole('searchbox', { name: 'キーワード' }).fill('Yamamoto')
    await pressWithTheKeyboard(page.getByRole('button', { name: '探す' }))
    await expect(page.getByText(`${KENJI.name}（このお客様）`)).toBeVisible()
    await pressWithTheKeyboard(page.getByRole('link', { name: KENJI.name }))

    // Assert
    await expect(
      page.getByRole('heading', { level: 2, name: 'まとめる相手' }),
    ).toBeFocused()
    await expect(
      page.getByRole('table', { name: '2 人で違う項目' }),
    ).toBeVisible()
    await expectSoundPage(page)

    // Act: the merge, asked first
    await pressWithTheKeyboard(
      part(page, 'まとめる相手').getByRole('button', { name: 'まとめる' }),
    )
    await expect(dialog(page)).toBeVisible()
    await expectSoundPage(page)
    await pressWithTheKeyboard(
      dialog(page).getByRole('button', { name: 'まとめる' }),
    )

    // Assert
    await expect(heading(page, 'お客様の台帳')).toBeFocused()
    await expect(
      page.getByText(`2 人のお客様を、${KENJI.name} 様にまとめました。`),
    ).toBeVisible()
    expect(page.url()).toBe(
      `${ADMIN.origin}/salons/${salon}/customers/${kenji}`,
    )
    expect(await storedRecords(api)).toEqual(
      before.map((record) =>
        record.email === AGAIN.email ? { ...record, present: false } : record,
      ),
    )

    // Act: the record merged, at its address
    await page.goto(`${ADMIN.origin}/salons/${salon}/customers/${again}`)

    // Assert
    await expect(
      page.getByRole('region', { name: '削除されたときの台帳' }),
    ).toBeVisible()
  })
})

test.describe('merging two records, on a screen as wide as a laptop', () => {
  test.use({ viewport: { width: 1024, height: 768 } })

  test('should show the items the two differ in, long ones too, without scrolling sideways', async ({
    page,
    api,
  }) => {
    // Arrange
    const { kenji, again } = await arrangeAgain(api)
    const salon = await salonId(api)

    // Act
    await page.goto(
      `${ADMIN.origin}/salons/${salon}/customers/${kenji}/merge?keyword=Yamamoto&with=${again}`,
    )
    await enterCredentials(page, OWNER, api.seedPassword)

    // Assert: a table that fits is no region, nor a stop of the Tab key
    const differences = page.getByRole('table', { name: '2 人で違う項目' })
    await expect(differences).toContainText(NOTES)
    expect(await sidewaysScrollOf(differences)).toBeLessThanOrEqual(0)
    await expect(
      page.getByRole('region', { name: '2 人で違う項目' }),
    ).toHaveCount(0)
    await expectSoundPage(page)
  })
})

test.describe('merging two records, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the items the two differ in and the dialog into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    const { kenji, again } = await arrangeAgain(api)
    const salon = await salonId(api)
    await page.goto(
      `${ADMIN.origin}/salons/${salon}/customers/${kenji}/merge?keyword=Yamamoto&with=${again}`,
    )
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, 'ほかのお客様とまとめる')).toBeFocused()

    // Act
    await expect(
      page.getByRole('table', { name: '2 人で違う項目' }),
    ).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await part(page, 'まとめる相手')
      .getByRole('button', { name: 'まとめる' })
      .click()

    // Assert
    await expect(dialog(page)).toBeVisible()
    await expectSoundPage(page)
  })
})
