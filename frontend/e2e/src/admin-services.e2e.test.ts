import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { salonId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { enterCredentials, heading, MANAGER } from './sign-in'

/*
 * The services of the menu as the manager of the salon in Tokyo keeps them,
 * with the keyboard alone: a package of two services of the seed data is
 * added from the menu, changed from its page, and removed again. The form
 * of a service, with its rows and what is wrong with them, is shown on a
 * screen as narrow as a phone as well.
 */

const DUO = 'Cut & Color Duo'

const storedSchema = z.array(
  z.object({
    price: z.number(),
    packaged: z.array(z.string()),
    removed: z.boolean(),
  }),
)

/** A service of the salon in Tokyo as the database of the API has it: its price, the services of the package, and whether it was removed. */
const storedOf = async (api: TestApi, name: string) =>
  storedSchema.parse(
    await api.query(
      `select v.price,
         coalesce((select array_agg(p.name order by array_position(v."packageServiceIds", p.id))
           from services p where p.id = any(v."packageServiceIds")), '{}') as packaged,
         v."deletedAt" is not null as removed
       from services v
       join salons s on s.id = v."salonId"
       where s.name = 'Beauty Studio Tokyo' and v.name = $1`,
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

/** Chooses an option of a select after moving the focus to it. */
const chooseIn = async (control: Locator, label: string): Promise<void> => {
  await control.focus()
  await control.selectOption({ label })
}

const part = (page: Page, name: string): Locator =>
  page.getByRole('group', { name, exact: true })

test.describe('the services of the menu, in a browser', () => {
  test('should let the manager add a package, change it and remove it, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/menu`)
    await enterCredentials(page, MANAGER, api.seedPassword)
    await expect(heading(page, 'メニュー')).toBeVisible()

    // Act: a package of two services
    await pressWithTheKeyboard(
      page.getByRole('link', { name: 'サービスを足す' }),
    )
    await expect(heading(page, 'サービスを足す')).toBeFocused()
    await typeInto(
      part(page, 'サービス').getByRole('textbox', { name: '名前' }),
      DUO,
    )
    await typeInto(
      part(page, '時間と料金').getByRole('textbox', { name: '所要時間（分）' }),
      '150',
    )
    await typeInto(
      part(page, '時間と料金').getByRole('textbox', {
        name: '料金',
        exact: true,
      }),
      '15000',
    )
    const box = page.getByRole('checkbox', { name: 'パッケージにする' })
    await box.focus()
    await box.press('Space')
    await chooseIn(
      part(page, '構成サービス 1').getByRole('combobox', { name: 'サービス' }),
      'Ladies Cut',
    )
    await chooseIn(
      part(page, '構成サービス 2').getByRole('combobox', { name: 'サービス' }),
      'Full Color',
    )
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '足す', exact: true }),
    )

    // Assert
    await expect(
      page.getByText(`サービス「${DUO}」を、メニューに足しました。`),
    ).toBeVisible()
    await expect(heading(page, 'サービスの内容')).toBeFocused()
    await expect(
      page.getByRole('region', { name: 'パッケージのサービス' }),
    ).toContainText('Ladies Cut')
    expect(await storedOf(api, DUO)).toEqual([
      { price: 15000, packaged: ['Ladies Cut', 'Full Color'], removed: false },
    ])

    // Act: changed from its page
    await pressWithTheKeyboard(
      page.getByRole('link', { name: 'サービスを直す' }),
    )
    await expect(heading(page, 'サービスを直す')).toBeFocused()
    const price = part(page, '時間と料金').getByRole('textbox', {
      name: '料金',
      exact: true,
    })
    await price.focus()
    await price.press('ControlOrMeta+a')
    await price.pressSequentially('14000')
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '変更を保存する' }),
    )

    // Assert
    await expect(
      page.getByText(`サービス「${DUO}」を直しました。`),
    ).toBeVisible()
    await expect(heading(page, 'サービスの内容')).toBeFocused()
    expect(await storedOf(api, DUO)).toEqual([
      { price: 14000, packaged: ['Ladies Cut', 'Full Color'], removed: false },
    ])

    // Act: removed again
    await pressWithTheKeyboard(
      page.getByRole('link', { name: 'サービスを直す' }),
    )
    await expect(heading(page, 'サービスを直す')).toBeFocused()
    await pressWithTheKeyboard(page.getByRole('button', { name: '削除' }))
    const dialog = page.getByRole('dialog', {
      name: `サービス「${DUO}」を削除しますか？`,
    })
    await expect(dialog).toBeVisible()
    await pressWithTheKeyboard(dialog.getByRole('button', { name: '削除する' }))

    // Assert
    await expect(
      page.getByText(`サービス「${DUO}」を、メニューから削除しました。`),
    ).toBeVisible()
    await expect(heading(page, 'メニュー')).toBeFocused()
    await expect(page.getByRole('link', { name: DUO })).toHaveCount(0)
    expect(await storedOf(api, DUO)).toEqual([
      { price: 14000, packaged: ['Ladies Cut', 'Full Color'], removed: true },
    ])
  })
})

test.describe('the services of the menu, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the form of a service, its rows and what is wrong with them, into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    await page.goto(`${ADMIN.origin}/salons/${salon}/menu/services/new`)
    await enterCredentials(page, MANAGER, api.seedPassword)
    await expect(part(page, 'サービス')).toBeVisible()

    // Act
    await page.getByRole('checkbox', { name: 'パッケージにする' }).check()
    await page.getByRole('button', { name: 'オプションを足す' }).click()
    await page.getByRole('button', { name: '足す', exact: true }).click()

    // Assert
    await expect(
      part(page, 'サービス').getByRole('textbox', { name: '名前' }),
    ).toHaveAccessibleDescription(
      /サービスの名前を、255 文字以内で入力してください。/,
    )
    await expect(
      part(page, '構成サービス 1').getByRole('combobox', { name: 'サービス' }),
    ).toHaveAccessibleDescription(/サービスを選んでください。/)
    await expectSoundPage(page)
  })
})
