import type { Page } from '@playwright/test'
import { ADMIN } from './applications'
import { salonId } from './bookings'
import { cornersUnderTheDialog, edgesOf, expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { enterCredentials, heading, OWNER } from './sign-in'

/*
 * The actions of a screen, at the top of it (`PageHeader` of ui). On a
 * screen as narrow as a phone they are side by side, two in a row, and a
 * screen with more than two keeps its main action in sight and the others
 * in a sheet: the content starts on the first screen.
 */

const LEDGER = '顧客台帳'
const OTHER_ACTIONS = 'ほかの操作'

const openTheLedger = async (page: Page, api: TestApi): Promise<void> => {
  await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/customers`)
  await enterCredentials(page, OWNER, api.seedPassword)
  await expect(heading(page, LEDGER)).toBeFocused()
}

const otherActions = (page: Page) =>
  page.getByRole('button', { name: OTHER_ACTIONS })

const sheetOf = (page: Page) =>
  page.getByRole('dialog', { name: OTHER_ACTIONS })

test.describe('the actions of a screen, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should keep the main action and the button of the others in one row, and open the others from a sheet', async ({
    page,
    api,
  }) => {
    // Arrange
    await openTheLedger(page, api)
    const entry = await edgesOf(
      page.getByRole('link', { name: 'お客様を登録する' }),
    )
    const others = await edgesOf(otherActions(page))
    await expect(page.getByRole('link', { name: 'カルテを探す' })).toBeHidden()

    // Act
    await otherActions(page).click()

    // Assert: one row of two columns, each button as wide as its column, below which the conditions of the ledger start
    expect(others.top).toBe(entry.top)
    expect(others.left).toBeGreaterThan(entry.right)
    expect(others.right - others.left).toBe(entry.right - entry.left)
    const search = await edgesOf(
      page.getByRole('search', { name: 'お客様を探す' }),
    )
    expect(search.top - others.bottom).toBeLessThan(40)
    const sheet = sheetOf(page)
    await expect
      .poll(() => edgesOf(sheet))
      .toMatchObject({ left: 0, right: 390, bottom: 844 })
    expect(await cornersUnderTheDialog(page)).toEqual([true, true, true, true])
    await expectSoundPage(page)

    // Act
    await sheet.getByRole('link', { name: 'カルテを探す' }).click()

    // Assert
    await expect(heading(page, 'カルテを探す')).toBeFocused()
    await expect(sheet).toBeHidden()
  })

  test('should export from the sheet, close it and give the focus back to its button', async ({
    page,
    api,
  }) => {
    // Arrange
    await openTheLedger(page, api)
    await otherActions(page).click()
    const saving = page.waitForEvent('download')

    // Act
    await sheetOf(page).getByRole('button', { name: 'CSV に出力する' }).click()

    // Assert
    const download = await saving
    expect(download.suggestedFilename()).toMatch(
      /^customers-\d{4}-\d{2}-\d{2}\.csv$/,
    )
    await expect(sheetOf(page)).toBeHidden()
    await expect(
      page.getByText(
        `4 人のお客様を、${download.suggestedFilename()} に出力しました。`,
      ),
    ).toBeVisible()
    await expect(otherActions(page)).toBeFocused()
  })

  test('should keep two actions in sight, side by side', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/settings`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, 'サロンの設定')).toBeFocused()

    // Act
    const salon = await edgesOf(
      page.getByRole('link', { name: 'サロンの情報を直す' }),
    )
    const hours = await edgesOf(
      page.getByRole('link', { name: '営業時間を直す' }),
    )

    // Assert
    expect(hours.top).toBe(salon.top)
    expect(hours.right - hours.left).toBe(salon.right - salon.left)
    await expect(otherActions(page)).toHaveCount(0)
    await expectSoundPage(page)
  })
})

test.describe('the actions of a screen, on a wide screen', () => {
  test.use({ viewport: { width: 1280, height: 800 } })

  test('should put every action in the row of the heading', async ({
    page,
    api,
  }) => {
    // Act
    await openTheLedger(page, api)

    // Assert
    const entry = await edgesOf(
      page.getByRole('link', { name: 'お客様を登録する' }),
    )
    const exporting = await edgesOf(
      page.getByRole('button', { name: 'CSV に出力する' }),
    )
    expect(exporting.top).toBe(entry.top)
    await expect(otherActions(page)).toHaveCount(0)
    await expectSoundPage(page)
  })
})
