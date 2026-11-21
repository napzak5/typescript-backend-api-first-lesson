import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN, PORTAL } from './applications'
import { salonId } from './bookings'
import { edgesOf } from './checks'
import { expect, test } from './fixtures'
import {
  CUSTOMER,
  enterCredentials,
  heading,
  OWNER,
  PORTAL_START,
} from './sign-in'

/*
 * What the theme decides for every screen, as the browser draws it: the
 * typefaces, how high a control is under a finger and under a fine
 * pointer, and where the shared parts put the names of the values of a
 * record and the parts of a form.
 */

/** How high the browser drew an element */
const heightOf = async (element: Locator): Promise<number> => {
  const { top, bottom } = await edgesOf(element)

  return bottom - top
}

/** The sign-in of the portal: a control that is typed into, and a button. */
const controlsOfTheSignIn = async (
  page: Page,
): Promise<{ field: number; button: number }> => {
  await page.goto(`${PORTAL.origin}/sign-in`)
  await expect(heading(page, 'サインイン')).toBeVisible()

  return {
    field: await heightOf(
      page.getByRole('textbox', { name: 'メールアドレス' }),
    ),
    button: await heightOf(page.getByRole('button', { name: 'サインイン' })),
  }
}

const idSchema = z.tuple([z.object({ id: z.uuid() })])

test.describe('the type and the density of the screens', () => {
  test('should draw a page in its own typefaces, fetched from the application and nowhere else', async ({
    page,
  }) => {
    // Act
    await page.goto(PORTAL.origin)
    await expect(heading(page, PORTAL_START)).toBeVisible()
    const drawn = await page.evaluate(async () => {
      await document.fonts.ready

      return {
        first: getComputedStyle(document.body)
          .fontFamily.split(',')
          .slice(0, 2)
          .map((family) => family.trim()),
        loaded: [
          ...new Set(
            [...document.fonts]
              .filter(({ status }) => status === 'loaded')
              .map(({ family }) => family.replaceAll('"', '')),
          ),
        ].sort(),
        from: [
          ...new Set(
            performance
              .getEntriesByType('resource')
              .filter(({ name }) => name.endsWith('.woff2'))
              .map(({ name }) => new URL(name).origin),
          ),
        ],
      }
    })

    // Assert: Latin letters in the one, Japanese in the other
    expect(drawn).toEqual({
      first: ['"Inter Variable"', '"Noto Sans JP Variable"'],
      loaded: ['Inter Variable', 'Noto Sans JP Variable'],
      from: [PORTAL.origin],
    })
  })

  test('should make a control 36 pixels high where the pointer is a fine one', async ({
    page,
  }) => {
    // Act and assert
    expect(await controlsOfTheSignIn(page)).toEqual({ field: 36, button: 36 })
  })

  test.describe('on a phone', () => {
    test.use({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    })

    test('should make a control 40 pixels high, for a finger', async ({
      page,
    }) => {
      // Act and assert
      expect(await controlsOfTheSignIn(page)).toEqual({ field: 40, button: 40 })
    })
  })

  test('should set the name of a part of a form further from the fields before it than from its own', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(
      `${ADMIN.origin}/salons/${await salonId(api)}/customers/new`,
    )
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, 'お客様を登録する')).toBeVisible()

    // Act: the last field of the name, the name of the part after it, and
    // the label of its first field
    const [before, name, own] = await Promise.all([
      edgesOf(page.getByRole('textbox', { name: '名（フリガナ）' })),
      edgesOf(page.getByText('連絡先', { exact: true })),
      edgesOf(page.getByText('メールアドレス', { exact: true })),
    ])

    // Assert
    expect(name.top - before.bottom).toBeGreaterThan(own.top - name.bottom)
    expect(own.top - name.bottom).toBeGreaterThan(0)
  })

  test.describe('on a screen 320 pixels wide', () => {
    test.use({ viewport: { width: 320, height: 568 } })

    test('should stand the name of a value and the value side by side, the names in one column and the values in the other', async ({
      page,
      api,
    }) => {
      // Arrange
      const [customer] = idSchema.parse(
        await api.query('select id::text from customers where email = $1', [
          CUSTOMER,
        ]),
      )
      await page.goto(
        `${ADMIN.origin}/salons/${await salonId(api)}/customers/${customer.id}`,
      )
      await enterCredentials(page, OWNER, api.seedPassword)
      await expect(heading(page, 'お客様の台帳')).toBeVisible()
      const ledger = page.getByRole('region', { name: '台帳', exact: true })
      const nameOf = (term: string): Locator =>
        ledger.getByRole('term').filter({ hasText: new RegExp(`^${term}$`) })
      const recordedFor = (term: string): Locator =>
        nameOf(term).locator('xpath=following-sibling::dd[1]')

      // Act: a short name, the longest of the ledger, and the list they are in
      const [name, value, longName, itsValue, list] = await Promise.all([
        edgesOf(nameOf('お名前')),
        edgesOf(recordedFor('お名前')),
        edgesOf(nameOf('好みについてのメモ')),
        edgesOf(recordedFor('好みについてのメモ')),
        edgesOf(nameOf('お名前').locator('xpath=ancestor::dl[1]')),
      ])

      // Assert
      expect(name.right).toBeLessThanOrEqual(value.left)
      expect(value.top).toBeLessThan(name.bottom)
      expect(longName.left).toBe(name.left)
      expect(itsValue.left).toBe(value.left)
      expect(longName.right).toBeLessThanOrEqual(itsValue.left)
      // The names leave the values three fifths of the list (and a pixel
      // of rounding): the longest goes on in a second line
      expect(longName.right - longName.left).toBeLessThanOrEqual(
        (list.right - list.left) * 0.4 + 1,
      )
      expect(longName.bottom - longName.top).toBeGreaterThan(
        name.bottom - name.top,
      )
    })
  })
})
