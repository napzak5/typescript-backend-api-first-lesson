import { MANAGER } from '@beauty-salon-frontend/testing/seed'
import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { salonId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { mainMenuLink } from './main-menu'
import { ADMIN_START, enterCredentials, heading } from './sign-in'

/*
 * The menu of a salon as its manager keeps it, with the keyboard alone: a
 * category is added below Hair Cut from the navigation, found at the end of
 * the menu, and removed again. The seed data has eight categories of the
 * top at the salon, the first four with its ten services. The menu, a
 * service and the form of a category are shown on a screen as narrow as a
 * phone as well.
 */

const BOB = 'Bob Cut'

const storedSchema = z.array(
  z.object({ parent: z.string().nullable(), displayOrder: z.number() }),
)

/** The parent and the place of a category of the salon in Tokyo, as the database of the API has them. */
const storedOf = async (api: TestApi, name: string) =>
  storedSchema.parse(
    await api.query(
      `select p.name as parent, c."displayOrder"
       from service_categories c
       join salons s on s.id = c."salonId"
       left join service_categories p on p.id = c."parentId"
       where s.name = 'Beauty Studio Tokyo' and c.name = $1`,
      [name],
    ),
  )

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

/** Types into a control after moving the focus to it. */
const typeInto = async (control: Locator, value: string): Promise<void> => {
  await control.focus()
  await control.pressSequentially(value)
}

const categories = (page: Page): Locator =>
  page.getByRole('table', { name: 'カテゴリー', exact: true })

test.describe('the menu, in a browser', () => {
  test('should let the manager add a category below another and remove it, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(ADMIN.origin)
    await enterCredentials(page, MANAGER, api.seedPassword)
    await expect(heading(page, ADMIN_START)).toBeFocused()

    // Act: from the navigation to the menu
    await pressWithTheKeyboard(mainMenuLink(page, 'メニュー'))

    // Assert
    await expect(heading(page, 'メニュー')).toBeFocused()
    await expect(
      page.getByRole('table', { name: 'Hair Cut', exact: true }),
    ).toContainText('Ladies Cut')

    // Act: a category below Hair Cut
    await pressWithTheKeyboard(
      page.getByRole('link', { name: 'カテゴリーを足す' }),
    )
    await expect(heading(page, 'カテゴリーを足す')).toBeFocused()
    await typeInto(page.getByRole('textbox', { name: /名前/ }), BOB)
    await page.getByRole('combobox', { name: /種類/ }).focus()
    await page.getByRole('combobox', { name: /種類/ }).selectOption('cut')
    await page.getByRole('combobox', { name: '親カテゴリー' }).focus()
    await page
      .getByRole('combobox', { name: '親カテゴリー' })
      .selectOption({ label: 'Hair Cut' })
    await pressWithTheKeyboard(page.getByRole('button', { name: '足す' }))

    // Assert
    await expect(
      page.getByText(`カテゴリー「${BOB}」を、メニューに足しました。`),
    ).toBeVisible()
    await expect(heading(page, 'メニュー')).toBeFocused()
    await expect(
      page.getByRole('table', { name: `Hair Cut › ${BOB}`, exact: true }),
    ).toContainText('このカテゴリーのサービスはありません')
    expect(await storedOf(api, BOB)).toEqual([
      { parent: 'Hair Cut', displayOrder: 9 },
    ])

    // Act: removed again
    await pressWithTheKeyboard(
      categories(page).getByRole('link', { name: BOB }),
    )
    await expect(heading(page, 'カテゴリーを直す')).toBeFocused()
    await expect(page.getByRole('textbox', { name: /名前/ })).toHaveValue(BOB)
    await pressWithTheKeyboard(page.getByRole('button', { name: '削除' }))
    const dialog = page.getByRole('dialog', {
      name: `カテゴリー「${BOB}」を削除しますか？`,
    })
    await expect(dialog).toBeVisible()
    await pressWithTheKeyboard(dialog.getByRole('button', { name: '削除する' }))

    // Assert
    await expect(
      page.getByText(`カテゴリー「${BOB}」を、メニューから削除しました。`),
    ).toBeVisible()
    await expect(heading(page, 'メニュー')).toBeFocused()
    await expect(categories(page).getByRole('link', { name: BOB })).toHaveCount(
      0,
    )
    expect(await storedOf(api, BOB)).toEqual([])
  })
})

test.describe('the menu, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the menu, a service and the form of a category into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    await page.goto(`${ADMIN.origin}/salons/${salon}/menu`)
    await enterCredentials(page, MANAGER, api.seedPassword)

    // Act
    await expect(categories(page)).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await page
      .getByRole('table', { name: 'Hair Cut', exact: true })
      .getByRole('link', { name: 'Ladies Cut' })
      .click()
    await expect(page.getByRole('table', { name: 'オプション' })).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await page.goto(`${ADMIN.origin}/salons/${salon}/menu/categories/new`)
    await expect(page.getByRole('textbox', { name: /名前/ })).toBeVisible()
    await page.getByRole('textbox', { name: '色' }).fill('red')
    await page.getByRole('button', { name: '足す' }).click()

    // Assert
    await expect(
      page.getByRole('textbox', { name: '色' }),
    ).toHaveAccessibleDescription(/# と 16 進数 6 桁で入力してください。/)
    await expectSoundPage(page)
  })
})
