import { OPERATOR, OWNER } from '@beauty-salon-frontend/testing/seed'
import type { Locator, Page } from '@playwright/test'
import { ADMIN } from './applications'
import { salonId } from './bookings'
import { cornersUnderTheDialog, edgesOf, expectSoundPage } from './checks'
import { expect, test } from './fixtures'
import { enterCredentials, heading } from './sign-in'

/*
 * A dialog over its page, as the browser lays it out: its overlay covers
 * the window to its corners, and the page behind it does not scroll while
 * it is open. On a screen as narrow as a phone it is a sheet on the bottom
 * edge, on a wide one a box in the middle. It is never higher than the
 * window: what is longer scrolls inside it, with its actions in sight.
 *
 * The browser of these tests draws no scrollbars. What a dialog does over
 * a page whose scrollbar takes room is in `dialog-scrollbar.e2e.test.ts`.
 */

/** How far the page is scrolled down */
const scrolledDown = (page: Page): Promise<number> =>
  page.evaluate(() => Math.round(window.scrollY))

/** Whether the page lets itself be scrolled: what its root says of what overflows it */
const overflowOfThePage = (page: Page): Promise<string> =>
  page.evaluate(() => getComputedStyle(document.documentElement).overflowY)

/** Turns the wheel over the top of the window, and lets the browser draw twice */
const turnTheWheel = async (page: Page, by: number): Promise<void> => {
  await page.mouse.move(100, 10)
  await page.mouse.wheel(0, by)
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  )
}

/** Opens the operations of the platform and asks to carry out the requests that are due. */
const openTheQuestion = async (
  page: Page,
  seedPassword: string,
): Promise<Locator> => {
  await page.goto(`${ADMIN.origin}/operations`)
  await enterCredentials(page, OPERATOR, seedPassword)
  await expect(heading(page, '運用')).toBeFocused()
  await page.getByRole('button', { name: '消去の依頼を実行する' }).click()
  const dialog = page.getByRole('dialog', {
    name: '予定日時を過ぎた消去の依頼を、すべて実行しますか？',
  })
  await expect(dialog).toBeVisible()

  return dialog
}

test.describe('a dialog over its page', () => {
  test.describe('on a screen as narrow as a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('should be a sheet on the bottom edge whose overlay covers the window, over a page that does not scroll until it is closed', async ({
      page,
      api,
    }) => {
      // Arrange: the button is far down the page, which scrolled to it
      const dialog = await openTheQuestion(page, api.seedPassword)
      const scrolled = await scrolledDown(page)
      expect(scrolled).toBeGreaterThan(0)

      // Assert: on the bottom edge, as wide as the window, once it has come up
      await expect
        .poll(() => edgesOf(dialog))
        .toMatchObject({ left: 0, right: 390, bottom: 844 })
      expect(await cornersUnderTheDialog(page)).toEqual([
        true,
        true,
        true,
        true,
      ])
      const [back, carryOut] = await Promise.all([
        edgesOf(dialog.getByRole('button', { name: '戻る' })),
        edgesOf(dialog.getByRole('button', { name: '実行する' })),
      ])
      expect(back.bottom).toBeLessThan(carryOut.top)
      expect(back.right - back.left).toBe(carryOut.right - carryOut.left)
      await expectSoundPage(page)

      // Act: the wheel turned over the overlay
      await turnTheWheel(page, -300)

      // Assert: the page stays where it is
      expect(await overflowOfThePage(page)).toBe('hidden')
      expect(await scrolledDown(page)).toBe(scrolled)

      // Act: closed, and the wheel turned again
      await dialog.getByRole('button', { name: '戻る' }).click()
      await expect(dialog).toBeHidden()
      await turnTheWheel(page, -300)

      // Assert: the page scrolls again
      expect(await overflowOfThePage(page)).not.toBe('hidden')
      await expect.poll(() => scrolledDown(page)).toBeLessThan(scrolled)
    })

    test('should be no higher than the window and keep its actions in sight when what it holds is longer', async ({
      page,
      api,
    }) => {
      // Arrange: the window of a small phone, and the choice of who
      // referred a customer with everybody the ledger found
      await page.setViewportSize({ width: 390, height: 568 })
      await page.goto(
        `${ADMIN.origin}/salons/${await salonId(api)}/customers/new`,
      )
      await enterCredentials(page, OWNER, api.seedPassword)
      await expect(heading(page, 'お客様を登録する')).toBeFocused()
      await page.getByRole('button', { name: '紹介元を選ぶ' }).click()
      const dialog = page.getByRole('dialog', { name: '紹介元を選ぶ' })

      // Act
      await dialog.getByRole('searchbox', { name: 'キーワード' }).fill('a')
      await dialog.getByRole('button', { name: '探す' }).click()
      await expect(dialog.getByRole('table')).toBeVisible()

      // Assert: it fills the window but for a strip above it, and scrolls inside
      await expect
        .poll(() => edgesOf(dialog))
        .toEqual({ left: 0, top: 40, right: 390, bottom: 568 })
      expect(
        await dialog.evaluate(
          (sheet) => sheet.scrollHeight > sheet.clientHeight,
        ),
      ).toBe(true)
      const giveUp = dialog.getByRole('button', { name: 'やめる' })
      await expect(giveUp).toBeInViewport({ ratio: 1 })

      // Act: scrolled to its end
      await dialog.evaluate((sheet) => sheet.scrollTo(0, sheet.scrollHeight))

      // Assert: the action stays where it was
      await expect(giveUp).toBeInViewport({ ratio: 1 })
      expect(await cornersUnderTheDialog(page)).toEqual([
        true,
        true,
        true,
        true,
      ])
      await expectSoundPage(page)
    })
  })

  test('should be a box in the middle of a wide screen whose overlay covers the window, over a page that does not scroll', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.setViewportSize({ width: 1280, height: 800 })
    const dialog = await openTheQuestion(page, api.seedPassword)
    const scrolled = await scrolledDown(page)
    expect(scrolled).toBeGreaterThan(0)

    // Assert: as far from the left as from the right, and from the top as from the bottom
    const { left, top, right, bottom } = await edgesOf(dialog)
    expect(left).toBeGreaterThan(0)
    expect(Math.abs(left - (1280 - right))).toBeLessThanOrEqual(1)
    expect(top).toBeGreaterThan(0)
    expect(Math.abs(top - (800 - bottom))).toBeLessThanOrEqual(1)
    expect(await cornersUnderTheDialog(page)).toEqual([true, true, true, true])
    const [back, carryOut] = await Promise.all([
      edgesOf(dialog.getByRole('button', { name: '戻る' })),
      edgesOf(dialog.getByRole('button', { name: '実行する' })),
    ])
    expect(back.right).toBeLessThan(carryOut.left)
    expect(back.top).toBe(carryOut.top)

    // Act
    await turnTheWheel(page, -300)

    // Assert
    expect(await overflowOfThePage(page)).toBe('hidden')
    expect(await scrolledDown(page)).toBe(scrolled)
  })
})
