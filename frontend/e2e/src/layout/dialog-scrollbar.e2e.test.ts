import { OPERATOR } from '@beauty-salon-frontend/testing/seed'
import type { Page } from '@playwright/test'
import { ADMIN } from '../support/applications'
import { cornersUnderTheDialog, edgesOf } from '../support/checks'
import { expect, test } from '../support/fixtures'
import { enterCredentials, heading } from '../support/sign-in'

/*
 * A dialog over a page whose scrollbar takes room of the window, as on a
 * desktop with a mouse. The page loses its scrollbar while the dialog is
 * open: the overlay covers the window to its edges, and the page stays
 * where it is.
 *
 * The browser of the other tests draws no scrollbars; the one of this file
 * draws them, so the file is a worker of its own.
 */
test.use({
  viewport: { width: 1280, height: 800 },
  launchOptions: { ignoreDefaultArgs: ['--hide-scrollbars'] },
})

/** How much of the width of the window the scrollbar of the page takes */
const roomOfTheScrollbar = (page: Page): Promise<number> =>
  page.evaluate(() => window.innerWidth - document.documentElement.clientWidth)

test.describe('a dialog over a page whose scrollbar takes room of the window', () => {
  test('should cover the window to its edges, and leave the page where it is while its scrollbar is gone', async ({
    page,
    api,
  }) => {
    // Arrange: the operations of the platform, longer than the window, with
    // a scrollbar 15 pixels wide whatever the system draws
    await page.goto(`${ADMIN.origin}/operations`)
    await enterCredentials(page, OPERATOR, api.seedPassword)
    await expect(heading(page, '運用')).toBeFocused()
    await page.addStyleTag({
      content: 'html::-webkit-scrollbar { inline-size: 15px; }',
    })
    const content = page.getByRole('main')
    await expect.poll(() => roomOfTheScrollbar(page)).toBe(15)
    const { left, right } = await edgesOf(content)

    // Act
    await page.getByRole('button', { name: '消去の依頼を実行する' }).click()
    const dialog = page.getByRole('dialog', {
      name: '予定日時を過ぎた消去の依頼を、すべて実行しますか？',
    })
    await expect(dialog).toBeVisible()

    // Assert: the scrollbar is gone, the overlay has its room, the dialog is
    // in the middle of the window, and the content stands where it stood
    expect(await roomOfTheScrollbar(page)).toBe(0)
    expect(await cornersUnderTheDialog(page)).toEqual([true, true, true, true])
    const box = await edgesOf(dialog)
    expect(Math.abs(box.left - (1280 - box.right))).toBeLessThanOrEqual(1)
    expect(await edgesOf(content)).toMatchObject({ left, right })

    // Act
    await dialog.getByRole('button', { name: '戻る' }).click()
    await expect(dialog).toBeHidden()

    // Assert: the scrollbar is back, and the content has not moved
    expect(await roomOfTheScrollbar(page)).toBe(15)
    expect(await edgesOf(content)).toMatchObject({ left, right })
  })
})
