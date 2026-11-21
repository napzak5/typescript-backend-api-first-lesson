import type { Page } from '@playwright/test'
import { ADMIN } from './applications'
import { salonId } from './bookings'
import { cornersUnderTheDialog, edgesOf, expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { enterCredentials, heading, OWNER } from './sign-in'

/*
 * The conditions of a list (`FilterForm` of ui), on the ledger of the
 * customers. On a screen as narrow as a phone the keyword is in sight and
 * the other conditions are in a sheet, so that the list starts on the
 * first screen. On a wide screen every condition is in sight, in one row of
 * columns that do not stretch a date along the row.
 */

const LEDGER = '顧客台帳'
const SEARCH = 'お客様を探す'

const openTheLedger = async (page: Page, api: TestApi): Promise<void> => {
  await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/customers`)
  await enterCredentials(page, OWNER, api.seedPassword)
  await expect(heading(page, LEDGER)).toBeFocused()
}

const sheetOf = (page: Page) => page.getByRole('dialog', { name: SEARCH })

test.describe('the conditions of a list, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should start the list on the first screen, and narrow it from the sheet of the other conditions', async ({
    page,
    api,
  }) => {
    // Arrange: the ledger began below the first screen, under its conditions
    await openTheLedger(page, api)
    const ledger = page.getByRole('table', { name: LEDGER, exact: true })
    expect((await edgesOf(ledger)).top).toBeLessThan(844)
    await expect(
      page.getByRole('searchbox', { name: 'キーワード' }),
    ).toBeVisible()
    await expect(
      page.getByRole('combobox', { name: '会員ランク' }),
    ).toBeHidden()

    // Act
    await page.getByRole('button', { name: '条件', exact: true }).click()
    const sheet = sheetOf(page)
    await expect
      .poll(() => edgesOf(sheet))
      .toMatchObject({ left: 0, right: 390, bottom: 844 })
    expect(await cornersUnderTheDialog(page)).toEqual([true, true, true, true])
    await sheet
      .getByRole('combobox', { name: '会員ランク' })
      .selectOption('プラチナ')
    await sheet.getByRole('button', { name: '探す' }).click()

    // Assert
    await expect(sheet).toBeHidden()
    const found = page.getByRole('table', { name: '条件に合うお客様' })
    await expect(found.getByRole('row')).toHaveCount(2)
    expect(new URL(page.url()).searchParams.get('membershipTier')).toBe(
      'platinum',
    )
    await expect(
      page.getByRole('button', { name: '条件（1）', exact: true }),
    ).toBeFocused()
    await expectSoundPage(page)
  })

  test('should open the sheet again on a period that ends before it starts, with the focus on its end', async ({
    page,
    api,
  }) => {
    // Arrange
    await openTheLedger(page, api)
    await page.getByRole('button', { name: '条件', exact: true }).click()
    const sheet = sheetOf(page)
    await sheet.getByLabel('登録日（から）').fill('2026-04-01')
    await sheet.getByLabel('登録日（まで）').fill('2026-03-01')

    // Act
    await sheet.getByRole('button', { name: '探す' }).click()

    // Assert
    await expect(sheet.getByLabel('登録日（まで）')).toBeFocused()
    await expect(
      sheet.getByLabel('登録日（まで）'),
    ).toHaveAccessibleDescription(
      '終わりの日は、始まりの日と同じか、その後にしてください。',
    )
    expect(new URL(page.url()).search).toBe('')
    await expectSoundPage(page)
  })
})

test.describe('the conditions of a list, on a wide screen', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('should put the other conditions in a row of columns that do not stretch a date', async ({
    page,
    api,
  }) => {
    // Act
    await openTheLedger(page, api)

    // Assert: a date is a column 12rem wide at least, the keyword takes two,
    // and the row holds as many as fit
    const keyword = await edgesOf(
      page.getByRole('searchbox', { name: 'キーワード' }),
    )
    const from = await edgesOf(page.getByLabel('登録日（から）'))
    const to = await edgesOf(page.getByLabel('登録日（まで）'))
    const column = from.right - from.left
    expect(column).toBeGreaterThanOrEqual(192)
    expect(column).toBeLessThan(240)
    expect(keyword.right - keyword.left).toBeGreaterThan(2 * column)
    expect(to.top).toBe(keyword.top)
    await expect(page.getByRole('button', { name: /^条件/ })).toHaveCount(0)
    await expectSoundPage(page)
  })
})
