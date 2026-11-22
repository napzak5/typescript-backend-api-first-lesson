import { MANAGER, OWNER } from '@beauty-salon-frontend/testing/seed'
import type { Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { ADMIN, PORTAL } from './applications'
import { part, salonId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { enterCredentials, heading } from './sign-in'

/*
 * The reviews of the salon in Tokyo, from the side of the salon: its
 * owner, with the keyboard alone, answers a review that nobody answered,
 * and the customers read the answer on the page of the salon in the
 * portal; its manager reports a review to the platform. The review and its
 * dialog of the report are shown on a screen as narrow as a phone as well.
 * Of the three reviews of the seed data, «Good but could be better» has
 * no answer and no report.
 */

const GOOD = 'Good but could be better'

const ANSWER =
  'お待たせして申し訳ありませんでした。次回は時間どおりにご案内します。'

const storedSchema = z.tuple([
  z.object({
    ownerResponse: z.string().nullable(),
    reports: z.array(z.object({ reason: z.string(), details: z.string() })),
  }),
])

/** The answer to the review and its reports, as the database of the API has them */
const stored = async (api: TestApi) =>
  storedSchema.parse(
    await api.query(
      `select r."ownerResponse",
              coalesce(
                (select json_agg(json_build_object('reason', rr.reason, 'details', rr.details))
                 from review_reports rr where rr."reviewId" = r.id),
                '[]'::json
              ) as reports
       from reviews r where r.title = $1`,
      [GOOD],
    ),
  )[0]

/** The address of the review on the screens of the salon */
const reviewPathOf = async (api: TestApi): Promise<string> =>
  `/salons/${await salonId(api)}/reviews/${await api.idOf(
    'select id::text from reviews where title = $1',
    [GOOD],
  )}`

/** Presses a link or a button as somebody does who works with the keyboard alone. */
const pressWithTheKeyboard = async (control: Locator): Promise<void> => {
  await control.focus()
  await control.press('Enter')
}

const answerPart = (page: Page): Locator => part(page, 'サロンからの返信')

const reportPart = (page: Page): Locator => part(page, '運営への通報')

test.describe('the reviews of a salon, in a browser', () => {
  test('should let the owner answer a review with the keyboard, and show the answer on the page of the salon in the portal', async ({
    page,
    api,
  }) => {
    // Arrange
    const salon = await salonId(api)
    await page.goto(`${ADMIN.origin}/salons/${salon}/reviews`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(heading(page, 'レビュー')).toBeVisible()
    await expect(
      part(page, '評価のまとめ').getByRole('img', {
        name: '5 段階中 4.0（3 件）',
      }),
    ).toBeVisible()

    // Act
    await pressWithTheKeyboard(page.getByRole('link', { name: GOOD }))
    await pressWithTheKeyboard(
      answerPart(page).getByRole('link', { name: '返信を書く' }),
    )

    // Assert
    await expect(heading(page, 'レビューに返信する')).toBeFocused()

    // Act
    await page.getByRole('textbox', { name: '返信' }).focus()
    await page.keyboard.type(ANSWER)
    await pressWithTheKeyboard(page.getByRole('button', { name: '返信する' }))

    // Assert
    await expect(heading(page, GOOD)).toBeFocused()
    await expect(page.getByText('レビューに返信しました。')).toBeVisible()
    await expect(answerPart(page).getByText(ANSWER)).toBeVisible()
    expect((await stored(api)).ownerResponse).toBe(ANSWER)

    // Act
    await page.goto(`${PORTAL.origin}/salons/${salon}`)

    // Assert
    const review = part(page, 'レビュー')
      .getByRole('list', { name: 'レビュー' })
      .getByRole('listitem')
      .filter({ hasText: GOOD })
    await expect(review.getByText('サロンからの返信')).toBeVisible()
    await expect(review.getByText(ANSWER)).toBeVisible()
  })

  test('should let a manager report a review with the keyboard', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}${await reviewPathOf(api)}`)
    await enterCredentials(page, MANAGER, api.seedPassword)
    await expect(heading(page, GOOD)).toBeVisible()

    // Act
    await pressWithTheKeyboard(
      reportPart(page).getByRole('button', { name: '通報する' }),
    )
    const dialog = page.getByRole('dialog', { name: 'レビューを通報する' })
    await dialog.getByRole('radio', { name: '事実と違う内容' }).focus()
    await page.keyboard.press('Space')
    await dialog.getByRole('textbox', { name: '詳しい内容' }).focus()
    await page.keyboard.type('予約の時間どおりにご案内しています。')
    await pressWithTheKeyboard(dialog.getByRole('button', { name: '通報する' }))

    // Assert
    await expect(
      page.getByText('通報しました。運営が内容を確かめます。'),
    ).toBeVisible()
    await expect(dialog).toBeHidden()
    await expect(
      part(page, 'レビュー').getByText('1 件', { exact: true }),
    ).toBeVisible()
    expect((await stored(api)).reports).toEqual([
      {
        reason: 'false_information',
        details: '予約の時間どおりにご案内しています。',
      },
    ])
  })
})

test.describe('the reviews of a salon, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the reviews, a review and its report with what is wrong with it into the width', async ({
    page,
    api,
  }) => {
    // Arrange
    await page.goto(`${ADMIN.origin}/salons/${await salonId(api)}/reviews`)
    await enterCredentials(page, OWNER, api.seedPassword)
    await expect(page.getByRole('link', { name: GOOD })).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await page.getByRole('link', { name: GOOD }).click()
    await expect(heading(page, GOOD)).toBeVisible()

    // Assert
    await expectSoundPage(page)

    // Act
    await reportPart(page).getByRole('button', { name: '通報する' }).click()
    const dialog = page.getByRole('dialog', { name: 'レビューを通報する' })
    await dialog.getByRole('radio', { name: 'その他' }).check()
    await dialog.getByRole('button', { name: '通報する' }).click()

    // Assert
    await expect(
      dialog.getByRole('textbox', { name: '詳しい内容' }),
    ).toHaveAccessibleDescription(/「その他」を選んだときは/)
    await expectSoundPage(page)
  })
})
