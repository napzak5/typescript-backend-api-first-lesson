import { OPERATOR, OWNER, TOKYO } from '@beauty-salon-frontend/testing/seed'
import type { Locator } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { salonId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { pressWithTheKeyboard } from './sales'
import { enterCredentials, heading } from './sign-in'

/*
 * A salon added by an administrator from the choice of a salon, and the
 * salon in Tokyo removed by its owner, with the keyboard alone. The salon
 * in Tokyo has bookings that are not finished; a test that removes it
 * finishes them first, in the database. The form, and the removal with its
 * refusal, are shown on a screen as narrow as a phone as well.
 */

const NEW_NAME = 'Salon Hikari 新宿店'

/** Writes a value in an empty control, as somebody does who works with the keyboard alone. */
const write = async (control: Locator, value: string): Promise<void> => {
  await control.focus()
  await control.pressSequentially(value)
}

const addedSchema = z.array(
  z.object({
    timezone: z.string(),
    currency: z.string(),
    isActive: z.boolean(),
  }),
)

/** The salons of a name, as the database of the API has them */
const storedOf = async (api: TestApi, name: string) =>
  addedSchema.parse(
    await api.query(
      'select timezone, currency, "isActive" from salons where name = $1',
      [name],
    ),
  )

const removedSchema = z.tuple([z.object({ removed: z.boolean() })])

/** Whether the salon in Tokyo is removed */
const tokyoRemoved = async (api: TestApi): Promise<boolean> =>
  removedSchema.parse(
    await api.query(
      'select "deletedAt" is not null as removed from salons where name = $1',
      [TOKYO],
    ),
  )[0].removed

/** Lets every booking of the salon in Tokyo that is not finished be finished: marked as a no-show. */
const bookingsFinished = (api: TestApi): Promise<unknown> =>
  api.query(
    `update bookings b set status = 'no_show'
     from salons s
     where s.id = b."salonId" and s.name = $1
       and b.status in ('draft', 'pending', 'confirmed', 'in_progress')`,
    [TOKYO],
  )

test.describe('adding and removing a salon, in a browser', () => {
  test('should let an administrator add a salon from the choice of a salon and go on to its hours, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(ADMIN.origin)
    await enterCredentials(page, OPERATOR, api.seedPassword)
    await expect(heading(page, 'サロンを選ぶ')).toBeFocused()

    // Act
    await pressWithTheKeyboard(
      page.getByRole('link', { name: 'サロンを登録する' }),
    )
    await expect(heading(page, 'サロンを登録する')).toBeFocused()
    await write(page.getByRole('textbox', { name: '名前' }), NEW_NAME)
    await write(page.getByRole('textbox', { name: '都道府県' }), '東京都')
    await write(page.getByRole('textbox', { name: '市区町村' }), '新宿区')
    await write(
      page.getByRole('textbox', { name: '町名・番地' }),
      '西新宿 1-1-1',
    )
    await write(
      page.getByRole('textbox', { name: '電話番号', exact: true }),
      '03-1111-2222',
    )
    await write(
      page.getByRole('textbox', { name: 'メールアドレス' }),
      'shinjuku@example.com',
    )
    await pressWithTheKeyboard(
      page.getByRole('button', { name: 'サロンを登録する' }),
    )

    // Assert
    await expect(
      page.getByText(`サロン「${NEW_NAME}」を登録しました。`),
    ).toBeVisible()
    await expect(heading(page, 'サロンの設定')).toBeFocused()
    await expect(page.getByRole('region', { name: '会計' })).toContainText(
      'Asia/Tokyo',
    )
    expect(await storedOf(api, NEW_NAME)).toEqual([
      { timezone: 'Asia/Tokyo', currency: 'JPY', isActive: false },
    ])

    // Act
    await pressWithTheKeyboard(
      page.getByRole('link', { name: '営業時間を直す' }),
    )

    // Assert
    await expect(heading(page, '営業時間を直す')).toBeFocused()
  })

  test('should let the owner remove the salon once its bookings are finished, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    await bookingsFinished(api)
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/settings`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, 'サロンの設定')).toBeVisible()

    // Act
    await pressWithTheKeyboard(
      page.getByRole('button', { name: 'サロンを削除する' }),
    )
    const dialog = page.getByRole('dialog', {
      name: `サロン「${TOKYO}」を削除しますか？`,
    })
    await expect(dialog.getByRole('button', { name: '戻る' })).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(dialog.getByRole('button', { name: '削除する' })).toBeFocused()
    await page.keyboard.press('Enter')

    // Assert
    await expect(
      page.getByText(`サロン「${TOKYO}」を削除しました。`),
    ).toBeVisible()
    await expect(page.getByText('どのサロンにも属していません')).toBeVisible()
    expect(await tokyoRemoved(api)).toBe(true)
  })
})

test.describe('adding and removing a salon, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the form of a salon to be added and what is wrong with it into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/new`)
    await enterCredentials(page, OPERATOR, api.seedPassword)
    await expect(heading(page, 'サロンを登録する')).toBeVisible()

    // Act
    await page.getByRole('button', { name: 'サロンを登録する' }).click()

    // Assert
    await expect(page.getByRole('textbox', { name: '名前' })).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    await expectSoundPage(page)
  })

  test('should fit the removal and its refusal into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/settings`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await page.getByRole('button', { name: 'サロンを削除する' }).click()

    // Act
    await page
      .getByRole('dialog', { name: `サロン「${TOKYO}」を削除しますか？` })
      .getByRole('button', { name: '削除する' })
      .click()

    // Assert
    await expect(
      page.getByRole('region', { name: 'サロンの削除' }).getByRole('alert'),
    ).toContainText('終わっていない予約')
    await expectSoundPage(page)
    expect(await tokyoRemoved(api)).toBe(false)
  })
})
