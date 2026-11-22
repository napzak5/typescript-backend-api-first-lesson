import { OWNER } from '@beauty-salon-frontend/testing/seed'
import type { Locator } from '@playwright/test'
import * as z from 'zod'
import { ADMIN } from '../support/applications'
import { salonId } from '../support/bookings'
import { expectSoundPage } from '../support/checks'
import { expect, type TestApi, test } from '../support/fixtures'
import { part, pressWithTheKeyboard } from '../support/screen'
import { enterCredentials, heading } from '../support/sign-in'

/*
 * The settings of the salon in Tokyo changed by its owner with the
 * keyboard alone: the description and the rate of tax, from the settings
 * and back to them. The settings, and the form with what is wrong with
 * it, are shown on a screen as narrow as a phone as well.
 */

const storedSchema = z.tuple([
  z.object({ description: z.string().nullable(), taxRate: z.string() }),
])

/** The description and the rate of tax of the salon in Tokyo, as the database of the API has them. */
const storedOf = async (api: TestApi) =>
  storedSchema.parse(
    await api.query(
      `select description, "taxRate"::text as "taxRate"
       from salons where name = 'Beauty Studio Tokyo'`,
    ),
  )[0]

/** Writes a value in place of what a control holds, as somebody does who works with the keyboard alone. */
const rewrite = async (control: Locator, value: string): Promise<void> => {
  await control.focus()
  await control.press('ControlOrMeta+a')
  await control.press('Delete')
  await control.pressSequentially(value)
}

test.describe('the settings of a salon, in a browser', () => {
  test('should let the owner change the description and the rate of tax, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/settings`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, 'サロンの設定')).toBeVisible()

    // Act
    await pressWithTheKeyboard(
      page.getByRole('link', { name: 'サロンの情報を直す' }),
    )
    await expect(heading(page, 'サロンの情報を直す')).toBeFocused()
    await rewrite(
      page.getByRole('textbox', { name: '紹介' }),
      '渋谷の駅から歩いて 5 分です。',
    )
    await rewrite(page.getByRole('textbox', { name: '税率（%）' }), '8')
    await pressWithTheKeyboard(
      page.getByRole('button', { name: '変更を保存する' }),
    )

    // Assert
    await expect(page.getByText('サロンの情報を直しました。')).toBeVisible()
    await expect(heading(page, 'サロンの設定')).toBeFocused()
    await expect(part(page, '会計')).toContainText('8%')
    expect(await storedOf(api)).toEqual({
      description: '渋谷の駅から歩いて 5 分です。',
      taxRate: '8.00',
    })
  })
})

test.describe('the settings of a salon, opened again', () => {
  test('should show what somebody else changed since they were last opened', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/settings`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(part(page, '会計')).toContainText('10%')
    await page.getByRole('link', { name: '予約', exact: true }).click()
    await expect(heading(page, '予約台帳')).toBeVisible()
    await api.query(
      `update salons set "taxRate" = 8,
         "updatedAt" = greatest(now(), "updatedAt" + interval '1 millisecond')
       where name = 'Beauty Studio Tokyo'`,
    )

    // Act
    await page.getByRole('link', { name: '設定', exact: true }).click()

    // Assert
    await expect(part(page, '会計')).toContainText('8%')
  })
})

test.describe('the settings of a salon, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the settings into the width', async ({ page, api }) => {
    // Act
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/settings`)
    await enterCredentials(page, OWNER, api.seedPassword)

    // Assert
    await expect(
      page.getByRole('table', { name: '営業日カレンダー' }),
    ).toBeVisible()
    await expectSoundPage(page)
  })

  test('should fit the form and what is wrong with it into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(
      `${ADMIN.origin}/salons/${await salonId(api)}/settings/edit`,
    )
    await enterCredentials(page, OWNER, api.seedPassword)
    const rate = page.getByRole('textbox', { name: '税率（%）' })
    await rate.fill('101')

    // Act
    await page.getByRole('button', { name: '変更を保存する' }).click()

    // Assert
    await expect(rate).toHaveAccessibleDescription(
      /税率は、0 から 100 までの数/,
    )
    await expectSoundPage(page)
  })
})
