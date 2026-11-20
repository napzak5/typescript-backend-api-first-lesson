import type { Locator } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from './applications'
import { salonId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { enterCredentials, heading, MANAGER } from './sign-in'

/*
 * Several services of the menu changed at once by the manager of the salon
 * in Tokyo, with the keyboard alone: two services of the seed data are
 * given a state from the menu, and the menu shows it. The form, with what
 * is wrong with it, is shown on a screen as narrow as a phone as well.
 */

const storedSchema = z.array(
  z.object({ name: z.string(), serviceStatus: z.string() }),
)

/** The services of the salon in Tokyo that are not given now, as the database of the API has them. */
const notGivenOf = async (api: TestApi) =>
  storedSchema.parse(
    await api.query(
      `select v.name, v."serviceStatus"::text as "serviceStatus"
       from services v
       join salons s on s.id = v."salonId"
       where s.name = 'Beauty Studio Tokyo' and v."serviceStatus" <> 'active'
       order by v.name`,
    ),
  )

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

/** Checks a box as somebody does who works with the keyboard alone. */
const checkWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Space')
}

test.describe('several services of the menu, in a browser', () => {
  test('should let the manager give two services a state at once, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/menu`)
    await enterCredentials(page, MANAGER, api.seedPassword)
    await expect(heading(page, 'メニュー')).toBeVisible()

    // Act
    await pressWithTheKeyboard(
      page.getByRole('link', { name: 'まとめて変える' }),
    )
    await expect(heading(page, 'サービスをまとめて変える')).toBeFocused()
    await checkWithTheKeyboard(
      page.getByRole('checkbox', { name: 'Straight Perm（Perm）' }),
    )
    await checkWithTheKeyboard(
      page.getByRole('checkbox', { name: 'Digital Perm（Perm）' }),
    )
    const state = page.getByRole('combobox', { name: '提供の状態' })
    await state.focus()
    await state.selectOption({ label: '近日公開' })
    await pressWithTheKeyboard(page.getByRole('button', { name: '変える' }))

    // Assert
    await expect(page.getByText('2 件のサービスを変えました。')).toBeVisible()
    await expect(heading(page, 'メニュー')).toBeFocused()
    await expect(
      page.getByRole('table', { name: 'Perm', exact: true }),
    ).toContainText('近日公開')
    expect(await notGivenOf(api)).toEqual([
      { name: 'Digital Perm', serviceStatus: 'coming_soon' },
      { name: 'Straight Perm', serviceStatus: 'coming_soon' },
    ])
  })
})

test.describe('several services of the menu, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the form and what is wrong with it into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(
      `${ADMIN.origin}/salons/${await salonId(api)}/menu/services/bulk`,
    )
    await enterCredentials(page, MANAGER, api.seedPassword)
    await expect(
      page.getByRole('group', { name: '変えるサービス' }),
    ).toBeVisible()

    // Act
    await page.getByRole('button', { name: '変える' }).click()

    // Assert
    await expect(
      page.getByRole('group', { name: '変えるサービス' }),
    ).toHaveAccessibleDescription(/変えるサービスを、1 件以上選んでください。/)
    await expectSoundPage(page)
  })
})
