import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { salonId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { enterCredentials, heading, OWNER } from './sign-in'

/*
 * Yamamoto Kenji of the seed data has no allergy: an owner records one on
 * his chart, makes it heavier, and removes it after the dialog asks, with
 * the keyboard alone. Tanaka Yuki has two allergies in the seed data,
 * which are shown on a screen as narrow as a phone.
 */

const KENJI = { email: 'customer2@example.com', name: 'Yamamoto Kenji' }

const YUKI = { email: 'customer1@example.com' }

const idSchema = z.tuple([z.object({ id: z.uuid() })])

const customerId = async (api: TestApi, email: string): Promise<string> => {
  const [{ id }] = idSchema.parse(
    await api.query(
      'select id::text from customers where email = $1 and "deletedAt" is null',
      [email],
    ),
  )

  return id
}

const allergiesSchema = z.array(
  z.object({ allergenName: z.string(), severityType: z.string() }),
)

/** The allergies of a customer as the database holds them. */
const storedAllergies = async (api: TestApi, customer: string) =>
  allergiesSchema.parse(
    await api.query(
      `select "allergenName", "severityType" from customer_allergies
       where "customerId" = $1 order by "createdAt", id`,
      [customer],
    ),
  )

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

const allergies = (page: Page): Locator =>
  page.getByRole('region', { name: 'アレルギー', exact: true })

test.describe('the allergies of the customers, in a browser', () => {
  test('should record an allergy, make it heavier and remove it, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    const kenji = await customerId(api, KENJI.email)
    await page.goto(`${ADMIN.origin}/salons/${salon}/customers/${kenji}/chart`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, 'カルテ')).toBeFocused()
    await expect(allergies(page)).toContainText('アレルギーの記録はありません')

    // Act: the form, filled in from the top
    await pressWithTheKeyboard(
      allergies(page).getByRole('link', { name: 'アレルギーを記録する' }),
    )
    await expect(heading(page, 'アレルギーを記録する')).toBeFocused()
    await page.getByRole('textbox', { name: 'アレルゲン' }).focus()
    await page.keyboard.type('ニッケル')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('combobox', { name: '種類' })).toBeFocused()
    await page.getByRole('combobox', { name: '種類' }).selectOption({
      label: '金属',
    })
    await page.getByRole('radio', { name: '中程度' }).focus()
    await page.keyboard.press('Space')
    await page.getByLabel('確かめた日').fill('2026-04-01')
    await pressWithTheKeyboard(page.getByRole('button', { name: '記録する' }))

    // Assert
    await expect(heading(page, 'カルテ')).toBeVisible()
    await expect(
      page.getByText(
        `${KENJI.name} 様のアレルギー（ニッケル）を記録しました。`,
      ),
    ).toBeVisible()
    await expect(allergies(page).getByRole('rowheader')).toHaveText([
      'ニッケル',
    ])
    expect(await storedAllergies(api, kenji)).toEqual([
      { allergenName: 'ニッケル', severityType: 'moderate' },
    ])

    // Act: heavier, the arrow keys moving the choice
    await pressWithTheKeyboard(
      allergies(page).getByRole('link', { name: 'ニッケルの記録を直す' }),
    )
    await expect(heading(page, 'アレルギーの記録を直す')).toBeFocused()
    await page.getByRole('radio', { name: '中程度' }).focus()
    await page.keyboard.press('ArrowUp')
    await expect(page.getByRole('radio', { name: '重い' })).toBeChecked()
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '変更を保存する' }),
    )

    // Assert
    await expect(
      page.getByText(
        `${KENJI.name} 様のアレルギー（ニッケル）の記録を直しました。`,
      ),
    ).toBeVisible()
    await expect(allergies(page).getByRole('cell').first()).toHaveText('重い')
    expect(await storedAllergies(api, kenji)).toEqual([
      { allergenName: 'ニッケル', severityType: 'severe' },
    ])

    // Act: the dialog closed with the button that changes nothing, and opened again
    const remove = allergies(page).getByRole('button', {
      name: 'ニッケルの記録を削除する',
    })
    await pressWithTheKeyboard(remove)
    const asking = page.getByRole('dialog', {
      name: 'ニッケルの記録を削除しますか？',
    })
    await expect(asking.getByRole('button', { name: '戻る' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(asking).toBeHidden()
    await expect(remove).toBeFocused()
    await pressWithTheKeyboard(remove)
    await pressWithTheKeyboard(asking.getByRole('button', { name: '削除する' }))

    // Assert
    await expect(asking).toBeHidden()
    await expect(
      page.getByText(
        `${KENJI.name} 様のアレルギー（ニッケル）の記録を削除しました。`,
      ),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { level: 2, name: 'アレルギー' }),
    ).toBeFocused()
    await expect(allergies(page)).toContainText('アレルギーの記録はありません')
    expect(await storedAllergies(api, kenji)).toEqual([])
  })
})

test.describe('the allergies of the customers, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the allergies, the dialog of a removal and the form into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    const yuki = await customerId(api, YUKI.email)
    await page.goto(`${ADMIN.origin}/salons/${salon}/customers/${yuki}/chart`)
    await enterCredentials(page, OWNER, api.seedPassword)

    // Act
    await expect(allergies(page).getByRole('rowheader')).toHaveCount(2)

    // Assert
    await expectSoundPage(page)

    // Act
    await allergies(page)
      .getByRole('button', { name: '強い香料の記録を削除する' })
      .click()

    // Assert
    await expect(
      page.getByRole('dialog', { name: '強い香料の記録を削除しますか？' }),
    ).toBeVisible()
    await expectSoundPage(page)

    // Act
    await page.keyboard.press('Escape')
    await allergies(page)
      .getByRole('link', { name: '強い香料の記録を直す' })
      .click()
    await expect(page.getByRole('radiogroup', { name: '重篤度' })).toBeVisible()

    // Assert
    await expectSoundPage(page)
  })
})
