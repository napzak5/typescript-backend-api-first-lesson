import { KENJI, OWNER, YUKI } from '@beauty-salon-frontend/testing/seed'
import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { salonId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { enterCredentials, heading } from './sign-in'

/*
 * Yamamoto Kenji of the seed data has no chart: an owner makes it, with a
 * treatment Kenji had at another salon, changes it, and finds it again in
 * the search of the charts, with the keyboard alone. Tanaka Yuki has a
 * chart in the seed data, which is shown on a screen as narrow as a phone.
 */

const customerId = (api: TestApi, email: string): Promise<string> =>
  api.idOf(
    'select id::text from customers where email = $1 and "deletedAt" is null',
    [email],
  )

const chartSchema = z.array(
  z.object({
    previousTreatments: z.array(
      z.object({ treatment: z.string(), date: z.string() }).loose(),
    ),
    medicalConditions: z.string().nullable(),
  }),
)

/** The chart of a customer as the database holds it; none when there is none. */
const storedChart = async (api: TestApi, customer: string) =>
  chartSchema.parse(
    await api.query(
      `select "previousTreatments", "medicalConditions" from medical_charts
       where "customerId" = $1`,
      [customer],
    ),
  )[0]

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

const treatment = (page: Page, place: number): Locator =>
  page.getByRole('group', { name: `${place} 件目の施術` })

test.describe('the charts of the customers, in a browser', () => {
  test('should make a chart with a treatment had before, change it, and find it, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    const kenji = await customerId(api, KENJI.email)
    await page.goto(`${ADMIN.origin}/salons/${salon}/customers/${kenji}`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, 'お客様の台帳')).toBeFocused()

    // Act: from the customer to the chart they do not have yet, and its form
    await pressWithTheKeyboard(page.getByRole('link', { name: 'カルテを見る' }))
    await expect(heading(page, 'カルテ')).toBeFocused()
    await pressWithTheKeyboard(page.getByRole('link', { name: 'カルテを作る' }))
    await expect(heading(page, 'カルテを作る')).toBeFocused()
    await page.getByRole('textbox', { name: '持病や体調' }).focus()
    await page.keyboard.type('肩こりがひどい')
    await pressWithTheKeyboard(page.getByRole('button', { name: '施術を足す' }))
    const first = treatment(page, 1).getByRole('combobox', { name: '施術' })
    await expect(first).toBeFocused()
    await first.selectOption({ label: 'ヘッドスパ' })
    await treatment(page, 1).getByLabel('施術日').fill('2026-10-01')
    await pressWithTheKeyboard(
      page.getByRole('button', { name: 'カルテを作る' }),
    )

    // Assert
    await expect(heading(page, 'カルテ')).toBeVisible()
    await expect(
      page.getByText(`${KENJI.name} 様のカルテを作りました。`),
    ).toBeVisible()
    await expect(
      page
        .getByRole('region', { name: '過去の施術', exact: true })
        .getByRole('rowheader', { name: '2026年10月1日（木）' }),
    ).toBeVisible()
    expect(await storedChart(api, kenji)).toEqual({
      previousTreatments: [
        expect.objectContaining({ treatment: 'head_spa', date: '2026-10-01' }),
      ],
      medicalConditions: '肩こりがひどい',
    })

    // Act: the treatment taken away again, the focus on the button that adds one
    await pressWithTheKeyboard(page.getByRole('link', { name: 'カルテを直す' }))
    await expect(heading(page, 'カルテを直す')).toBeFocused()
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '1 件目の施術を外す' }),
    )
    await expect(page.getByRole('button', { name: '施術を足す' })).toBeFocused()
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '変更を保存する' }),
    )

    // Assert
    await expect(
      page.getByText(`${KENJI.name} 様のカルテを直しました。`),
    ).toBeVisible()
    await expect(
      page.getByRole('region', { name: '過去の施術', exact: true }),
    ).toContainText('記録はありません')
    expect(await storedChart(api, kenji)).toEqual({
      previousTreatments: [],
      medicalConditions: '肩こりがひどい',
    })

    // Act: the search of the charts, from the ledger
    await pressWithTheKeyboard(page.getByRole('link', { name: '顧客' }))
    await expect(heading(page, '顧客台帳')).toBeFocused()
    await pressWithTheKeyboard(page.getByRole('link', { name: 'カルテを探す' }))
    await expect(heading(page, 'カルテを探す')).toBeFocused()
    await page.getByRole('searchbox', { name: 'キーワード' }).focus()
    await page.keyboard.type('肩こり')
    await page.keyboard.press('Enter')

    // Assert
    const found = page.getByRole('table', { name: '条件に合うカルテ' })
    await expect(found.getByRole('rowheader')).toHaveText([`${KENJI.name} 様`])
    await expect(
      found.getByRole('link', { name: `${KENJI.name} 様` }),
    ).toHaveAttribute('href', `/salons/${salon}/customers/${kenji}/chart`)
  })
})

test.describe('the charts of the customers, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the chart, its form and the search into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    const yuki = await customerId(api, YUKI.email)
    const chart = `${ADMIN.origin}/salons/${salon}/customers/${yuki}/chart`
    await page.goto(chart)
    await enterCredentials(page, OWNER, api.seedPassword)

    // Act
    await expect(
      page
        .getByRole('region', { name: '過去の施術', exact: true })
        .getByRole('table'),
    ).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await page.getByRole('link', { name: 'カルテを直す' }).click()
    await expect(treatment(page, 2)).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await page.goto(`${ADMIN.origin}/salons/${salon}/customers/charts`)
    await expect(page.getByRole('table', { name: 'カルテ' })).toBeVisible()

    // Assert
    await expectSoundPage(page)
  })
})
