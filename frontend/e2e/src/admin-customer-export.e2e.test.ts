import { readFile } from 'node:fs/promises'
import { OWNER, VIP, YUKI } from '@beauty-salon-frontend/testing/seed'
import type { Download, Locator, Page } from '@playwright/test'
import { ADMIN } from './applications'
import { salonId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { part, pressWithTheKeyboard } from './screen'
import { enterCredentials, heading } from './sign-in'

/*
 * The customers of the seed data tagged vip are Tanaka Yuki and Nakamura
 * Hiroshi: an owner saves them from the ledger as a CSV file, and the
 * data of Tanaka Yuki as a JSON file. The page is of another origin than
 * the API, so the name of a file comes through CORS.
 */

const yukiId = (api: TestApi): Promise<string> =>
  api.idOf(
    'select id::text from customers where email = $1 and "deletedAt" is null',
    [YUKI.email],
  )

/** Presses the control, and waits for the file the browser saves. */
const saveWith = async (page: Page, control: Locator): Promise<Download> => {
  const saving = page.waitForEvent('download')
  await pressWithTheKeyboard(control)

  return saving
}

test.describe('exporting customers, in a browser', () => {
  test('should save the customers who meet the conditions of the ledger as a CSV file, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    await page.goto(`${ADMIN.origin}/salons/${salon}/customers?tags=vip`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, '顧客台帳')).toBeFocused()
    await expect(
      page.getByRole('table', { name: '条件に合うお客様' }),
    ).toBeVisible()

    // Act
    const download = await saveWith(
      page,
      page.getByRole('button', { name: 'CSV に出力する' }),
    )

    // Assert
    const name = download.suggestedFilename()
    expect(name).toMatch(/^customers-\d{4}-\d{2}-\d{2}\.csv$/)
    const bytes = await readFile(await download.path())
    // The mark of the byte order, by which a spreadsheet reads UTF-8
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const lines = bytes.subarray(3).toString('utf8').split('\r\n')
    expect(lines).toHaveLength(4)
    expect(lines[0]).toMatch(/^id,/)
    expect(lines.slice(1, 3).join('\n')).toContain(YUKI.email)
    expect(lines.slice(1, 3).join('\n')).toContain(VIP.email)
    expect(lines[3]).toBe('')
    await expect(
      page.getByText(`2 人のお客様を、${name} に出力しました。`),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'CSV に出力する' }),
    ).toBeFocused()
  })

  test('should save the data of a customer as a JSON file, with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    const yuki = await yukiId(api)
    await page.goto(`${ADMIN.origin}/salons/${salon}/customers/${yuki}`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, 'お客様の台帳')).toBeFocused()

    // Act
    const download = await saveWith(
      page,
      part(page, 'ご本人からの請求').getByRole('button', {
        name: 'データを出力する',
      }),
    )

    // Assert
    expect(download.suggestedFilename()).toBe(`customer-${yuki}.json`)
    const text = await readFile(await download.path(), 'utf8')
    expect(JSON.parse(text)).toMatchObject({
      customer: { id: yuki, email: YUKI.email },
    })
    await expect(
      page.getByText(
        `${YUKI.name} 様のデータを、customer-${yuki}.json に出力しました。`,
      ),
    ).toBeVisible()
  })
})

test.describe('exporting customers, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the export of the ledger, and why it saved no file, into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    await page.goto(`${ADMIN.origin}/salons/${salon}/customers?search=nobody`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(page.getByText('条件に合うお客様はいません')).toBeVisible()

    // Act: the export is one of the other actions, in their sheet
    await page.getByRole('button', { name: 'ほかの操作' }).click()
    const sheet = page.getByRole('dialog', { name: 'ほかの操作' })
    await sheet.getByRole('button', { name: 'CSV に出力する' }).click()

    // Assert
    await expect(sheet).toBeHidden()
    await expect(
      page.getByText('条件に合うお客様がいないため、出力しませんでした。'),
    ).toBeVisible()
    await expectSoundPage(page)
  })

  test('should fit the requests of the customer into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    const yuki = await yukiId(api)

    // Act
    await page.goto(`${ADMIN.origin}/salons/${salon}/customers/${yuki}`)
    await enterCredentials(page, OWNER, api.seedPassword)

    // Assert
    await expect(
      part(page, 'ご本人からの請求').getByRole('button', {
        name: 'データを出力する',
      }),
    ).toBeVisible()
    await expectSoundPage(page)
  })
})
