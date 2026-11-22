import { OPERATOR, OSAKA } from '@beauty-salon-frontend/testing/seed'
import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN, PORTAL } from './applications'
import { part } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { pressWithTheKeyboard } from './sales'
import { enterCredentials, heading } from './sign-in'

/*
 * The reports of reviews, from the side of the platform: its operator,
 * with the keyboard alone, goes from the reviews of the salon in Osaka to
 * the reports that wait, dismisses the report of «Great experience» that
 * finds nothing wrong, and removes a review that breaks the rules, which
 * the customers then no longer read in the portal. The reports and their
 * dialogs are shown on a screen as narrow as a phone as well.
 */

const GREAT = 'Great experience'

/** The ID of the salon in Osaka */
const osakaId = async (api: TestApi): Promise<string> =>
  api.idOf('select id::text from salons where name = $1', [OSAKA])

/** The address of «Great experience» on the screens of the salon */
const reviewPathOf = async (api: TestApi): Promise<string> =>
  `/salons/${await osakaId(api)}/reviews/${await api.idOf(
    'select id::text from reviews where title = $1',
    [GREAT],
  )}`

const storedSchema = z.array(
  z.object({
    status: z.string(),
    resolvedBy: z.string().nullable(),
    reportCount: z.number(),
  }),
)

/** The reports of «Great experience» as the database of the API has them, with the reports of the review that wait */
const stored = async (api: TestApi) =>
  storedSchema.parse(
    await api.query(
      `select rr.status::text, u.email as "resolvedBy", r."reportCount"
       from reviews r
         join review_reports rr on rr."reviewId" = r.id
         left join users u on u.id = rr."resolvedBy"
       where r.title = $1`,
      [GREAT],
    ),
  )

const keptSchema = z.tuple([z.object({ kept: z.number() })])

/** How many reviews «Great experience» the database of the API keeps */
const kept = async (api: TestApi): Promise<number> =>
  keptSchema.parse(
    await api.query(
      'select count(*)::integer as kept from reviews where title = $1',
      [GREAT],
    ),
  )[0].kept

/** The part of the reports, not the table in it, whose name holds the same word */
const reportsPart = (page: Page): Locator =>
  page.getByRole('region', { name: '通報', exact: true })

/** The button of the row of the report that waits */
const dismissButton = (page: Page): Locator =>
  reportsPart(page).getByRole('button', { name: /に受け付けた通報を却下する$/ })

test.describe('the reports of reviews, in a browser', () => {
  test('should let the operator go to the reports that wait and dismiss one with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/${await osakaId(api)}/reviews`)
    await enterCredentials(page, OPERATOR, api.seedPassword)
    await expect(heading(page, 'レビュー')).toBeVisible()

    // Act
    await pressWithTheKeyboard(page.getByRole('link', { name: '通報を見る' }))

    // Assert
    await expect(heading(page, 'レビューへの通報')).toBeFocused()
    const waiting = page.getByRole('table', { name: '未処理の通報' })
    await expect(waiting.getByRole('row')).toHaveCount(2)
    await expect(waiting.getByText('事実と違う内容')).toBeVisible()

    // Act
    await pressWithTheKeyboard(waiting.getByRole('link', { name: GREAT }))
    await expect(heading(page, GREAT)).toBeFocused()
    await pressWithTheKeyboard(dismissButton(page))
    const dialog = page.getByRole('dialog', { name: '通報を却下しますか？' })
    await pressWithTheKeyboard(dialog.getByRole('button', { name: '却下する' }))

    // Assert
    await expect(page.getByText('通報を却下しました。')).toBeVisible()
    await expect(dialog).toBeHidden()
    await expect(
      reportsPart(page).getByRole('heading', { name: '通報' }),
    ).toBeFocused()
    await expect(reportsPart(page).getByText('済み')).toBeVisible()
    await expect(dismissButton(page)).toHaveCount(0)
    expect(await stored(api)).toEqual([
      { status: 'dismissed', resolvedBy: OPERATOR, reportCount: 0 },
    ])
  })

  test('should let the operator remove a review with the keyboard, which the portal then no longer shows', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await osakaId(api)
    await page.goto(`${ADMIN.origin}${await reviewPathOf(api)}`)
    await enterCredentials(page, OPERATOR, api.seedPassword)
    await expect(heading(page, GREAT)).toBeVisible()

    // Act
    await pressWithTheKeyboard(
      part(page, 'レビューの削除').getByRole('button', {
        name: 'レビューを削除する',
      }),
    )
    const dialog = page.getByRole('dialog', {
      name: `「${GREAT}」を削除しますか？`,
    })
    await pressWithTheKeyboard(dialog.getByRole('button', { name: '削除する' }))

    // Assert
    await expect(heading(page, 'レビュー')).toBeVisible()
    await expect(
      page.getByText('レビューを削除しました。通報も、一緒に削除しました。'),
    ).toBeVisible()
    await expect(page.getByRole('table', { name: 'レビュー' })).toBeVisible()
    await expect(page.getByRole('link', { name: GREAT })).toHaveCount(0)
    expect(await kept(api)).toBe(0)
    expect(await stored(api)).toEqual([])

    // Act
    await page.goto(`${PORTAL.origin}/salons/${salon}`)

    // Assert
    const reviews = part(page, 'レビュー').getByRole('list', {
      name: 'レビュー',
    })
    await expect(reviews.getByRole('listitem').first()).toBeVisible()
    await expect(reviews.getByText(GREAT)).toHaveCount(0)
  })
})

test.describe('the reports of reviews, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the reports, a review with its reports and the dialogs into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(
      `${ADMIN.origin}/salons/${await osakaId(api)}/reviews/reports`,
    )
    await enterCredentials(page, OPERATOR, api.seedPassword)
    await expect(page.getByRole('link', { name: GREAT })).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await page.getByRole('link', { name: GREAT }).click()
    await expect(dismissButton(page)).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await dismissButton(page).click()
    await expect(
      page.getByRole('dialog', { name: '通報を却下しますか？' }),
    ).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await page.getByRole('button', { name: '戻る' }).click()
    await part(page, 'レビューの削除')
      .getByRole('button', { name: 'レビューを削除する' })
      .click()
    await expect(
      page.getByRole('dialog', { name: `「${GREAT}」を削除しますか？` }),
    ).toBeVisible()

    // Assert
    await expectSoundPage(page)
  })
})
