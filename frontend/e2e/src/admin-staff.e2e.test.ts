import { OWNER } from '@beauty-salon-frontend/testing/seed'
import type { Locator } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { salonId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { enterCredentials, heading } from './sign-in'

/*
 * The staff ledger as the owner of a salon keeps it, with the keyboard
 * alone: a member who joins is registered, made inactive while they are on
 * leave, and removed when they leave for good. The seed data has five
 * members at the salon, the owner among them; Hiroshi Tanaka has bookings
 * that are not finished, and is shown on a screen as narrow as a phone.
 */

const RINA = 'rina.kato@beautysalon.jp'

const storedSchema = z.array(
  z.object({ isActive: z.boolean(), removed: z.boolean() }),
)

/** Whether a member is active, and whether they were removed, as the database of the API has it. */
const storedOf = async (api: TestApi, email: string) =>
  storedSchema.parse(
    await api.query(
      `select "isActive", "deletedAt" is not null as removed from staff where email = $1`,
      [email],
    ),
  )

/** A member of the seed data, by their staff code. */
const staffIdOf = (api: TestApi, staffCode: string): Promise<string> =>
  api.idOf('select id::text from staff where "staffCode" = $1', [staffCode])

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

test.describe('the staff ledger, in a browser', () => {
  test('should register a member, make them inactive and remove them, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    await page.goto(`${ADMIN.origin}/salons/${salon}/staff`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(
      page.getByRole('table', { name: 'スタッフ', exact: true }),
    ).toBeVisible()

    // Act: the registration, from the ledger
    await pressWithTheKeyboard(
      page.getByRole('link', { name: 'スタッフを登録する' }),
    )
    await expect(heading(page, 'スタッフを登録する')).toBeFocused()
    await typeInto(
      page.getByRole('textbox', { name: '姓', exact: true }),
      'Kato',
    )
    await typeInto(
      page.getByRole('textbox', { name: '名', exact: true }),
      'Rina',
    )
    await typeInto(page.getByRole('textbox', { name: '表示名' }), 'Rina Kato')
    await typeInto(page.getByRole('textbox', { name: 'メールアドレス' }), RINA)
    await typeInto(
      page.getByRole('textbox', { name: '電話番号', exact: true }),
      '090-7777-8888',
    )
    await page.getByRole('combobox', { name: 'レベル' }).focus()
    await page.getByRole('combobox', { name: 'レベル' }).selectOption('junior')
    await pressWithTheKeyboard(page.getByRole('button', { name: '登録する' }))

    // Assert
    await expect(
      page.getByText('Rina Kato さんを、スタッフ台帳に登録しました。'),
    ).toBeVisible()
    await expect(heading(page, 'スタッフの内容')).toBeFocused()
    await expect(
      page.getByRole('region', { name: 'スタッフ', exact: true }),
    ).toContainText('レベルジュニア')
    expect(await storedOf(api, RINA)).toEqual([
      { isActive: true, removed: false },
    ])

    // Act: on leave
    await pressWithTheKeyboard(
      page.getByRole('link', { name: 'スタッフ情報を直す' }),
    )
    await expect(heading(page, 'スタッフ情報を直す')).toBeFocused()
    await page.getByRole('checkbox', { name: '有効なスタッフ' }).focus()
    await page.keyboard.press('Space')
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '変更を保存する' }),
    )

    // Assert
    await expect(page.getByText('スタッフ情報を直しました。')).toBeVisible()
    await expect(heading(page, 'スタッフの内容')).toBeFocused()
    await expect(
      page.getByRole('region', { name: 'スタッフ', exact: true }),
    ).toContainText('状態無効')
    expect(await storedOf(api, RINA)).toEqual([
      { isActive: false, removed: false },
    ])

    // Act: gone for good
    await pressWithTheKeyboard(page.getByRole('button', { name: '削除' }))
    const dialog = page.getByRole('dialog', {
      name: 'Rina Kato さんを、スタッフ台帳から削除しますか？',
    })
    await expect(dialog).toBeVisible()
    await pressWithTheKeyboard(dialog.getByRole('button', { name: '削除する' }))

    // Assert
    await expect(
      page.getByText('Rina Kato さんを、スタッフ台帳から削除しました。'),
    ).toBeVisible()
    await expect(heading(page, 'スタッフ')).toBeFocused()
    await expect(page.getByText('5 人', { exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Rina Kato' })).toHaveCount(0)
    expect(await storedOf(api, RINA)).toEqual([
      { isActive: false, removed: true },
    ])
  })
})

test.describe('the staff ledger, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the ledger, a member, the dialog of a removal and the form into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    await page.goto(`${ADMIN.origin}/salons/${salon}/staff`)
    await enterCredentials(page, OWNER, api.seedPassword)

    // Act
    await expect(
      page.getByRole('table', { name: 'スタッフ', exact: true }),
    ).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await page.goto(
      `${ADMIN.origin}/salons/${salon}/staff/${await staffIdOf(api, 'STF001')}`,
    )
    await expect(
      page.getByRole('region', { name: '予約の受け方' }),
    ).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await page.getByRole('button', { name: '削除' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await page.keyboard.press('Escape')
    await page.getByRole('link', { name: 'スタッフ情報を直す' }).click()
    await expect(page.getByRole('group', { name: '在籍' })).toBeVisible()

    // Assert
    await expectSoundPage(page)
  })
})
