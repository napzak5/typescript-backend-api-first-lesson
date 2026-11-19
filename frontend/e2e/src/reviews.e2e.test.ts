import type { APIRequestContext, Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { PORTAL } from './applications'
import { HIROSHI, MIKA, part, staffId } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { saveButton, text } from './mypage'
import { accessTokenOf, enterCredentials, heading, OWNER } from './sign-in'

/*
 * The customers are the second and the fourth of the seed data. Kenji
 * Yamamoto went to Hair & Spa Osaka twice, both times to Takeshi Ito, and
 * has written about the first visit alone. Hiroshi Nakamura wrote about a
 * visit to Beauty Studio Tokyo that two members of the staff took, and the
 * owner of the seed data is the owner of that salon.
 */

const KENJI = 'customer2@example.com'
const VIP = 'vip.customer@example.com'

const OSAKA = 'Hair & Spa Osaka'
const TAKESHI = 'Takeshi Ito'

const PICTURE = 'https://images.example.com/reviews/after.jpg'

/*
 * What somebody writes who has a lot to say, in words that no line can be
 * broken in (a browser breaks a line at a space and after a hyphen, and not
 * at an underscore).
 */
const LONG_TITLE =
  'A_colour_that_is_exactly_what_I_asked_for_and_a_cut_that_keeps_its_shape_for_weeks'
const LONG_COMMENT =
  '仕上がりに満足しています。\n\n参考にした写真: https://images.example.com/styles/long_layered_cut_with_soft_curls_and_a_side_parted_fringe_for_autumn_2026'
const LONG_PICTURE =
  'https://images.example.com/reviews/after_the_colour_and_the_treatment_seen_from_the_side_in_daylight_2026.jpg'
const LONG_RESPONSE =
  'またのご来店をお待ちしています。\n\nご予約はこちらから: https://booking.example.com/beauty_studio_tokyo/autumn_campaign_2026_for_returning_customers'

const visitSchema = z.tuple([
  z.object({ id: z.uuid(), reviewId: z.uuid().nullable() }),
])

/**
 * A visit of a customer that took place: one that has its review, or one
 * that nobody has written about.
 */
const visitOf = async (
  api: TestApi,
  email: string,
  reviewed: boolean,
): Promise<{ id: string; reviewId: string | null }> => {
  const [visit] = visitSchema.parse(
    await api.query(
      `select bookings.id::text, reviews.id::text as "reviewId"
       from bookings
       join customers on customers.id = bookings."customerId"
       left join reviews on reviews."bookingId" = bookings.id
       where customers.email = $1 and bookings.status = 'completed' and (reviews.id is not null) = $2`,
      [email, reviewed],
    ),
  )

  return visit
}

/** The review of a visit as the database has it. */
const stored = (api: TestApi, bookingId: string) =>
  api.query(
    `select reviews.id::text,
            (select staff."displayName" from staff where staff.id = reviews."staffId") as staff,
            reviews."overallRating", reviews."serviceRating", reviews."staffRating",
            reviews.title, reviews.comment, reviews."imageUrls"
     from reviews
     where reviews."bookingId" = $1`,
    [bookingId],
  )

/**
 * The customer removes what they wrote a while ago: asked of the API as a
 * client that is no screen does it.
 */
const remove = async (
  request: APIRequestContext,
  api: TestApi,
  reviewId: string | null,
  email: string,
): Promise<void> => {
  const answer = await request.delete(
    `${api.origin}/api/v1/reviews/${reviewId}`,
    {
      headers: {
        Authorization: `Bearer ${await accessTokenOf(request, api, email)}`,
      },
    },
  )
  expect(answer.status()).toBe(204)
}

/** The salon answers a review: no screen of the portal does that. */
const respond = async (
  request: APIRequestContext,
  api: TestApi,
  reviewId: unknown,
  ownerResponse: string,
): Promise<void> => {
  const answer = await request.post(
    `${api.origin}/api/v1/reviews/${reviewId}/respond`,
    {
      headers: {
        Authorization: `Bearer ${await accessTokenOf(request, api, OWNER)}`,
      },
      data: { ownerResponse },
    },
  )
  expect(answer.status()).toBe(200)
}

const rating = (page: Page, name: string): Locator =>
  page.getByRole('radio', { name, exact: true })

const choice = (page: Page, name: string): Locator =>
  page.getByRole('combobox', { name, exact: true })

const sendButton = (page: Page): Locator =>
  page.getByRole('button', { name: 'レビューを投稿する' })

/**
 * The reviews of the list of the customer. A review may hold a list of its
 * own, its pictures: a review is the item that has a heading.
 */
const ownReviews = (page: Page): Locator =>
  page
    .getByRole('list', { name: '自分のレビュー' })
    .getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 2 }) })

const changeLink = (review: Locator): Locator =>
  review.getByRole('link', { name: /のレビューを変更する$/ })

const removeButton = (review: Locator): Locator =>
  review.getByRole('button', { name: /のレビューを削除する$/ })

const dialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'レビューを削除しますか？' })

const pictures = (review: Locator): Locator =>
  review.getByRole('list', { name: '写真' }).getByRole('link')

test.describe('the reviews of a customer, in a browser', () => {
  test('should lead from a visit to the form, take a review with the keyboard, show it among what the customer wrote and on the page of the salon, change it, and remove it', async ({
    page,
    api,
  }) => {
    // Arrange
    const visit = await visitOf(api, KENJI, false)
    await page.goto(`${PORTAL.origin}/bookings/${visit.id}`)
    await enterCredentials(page, KENJI, api.seedPassword)

    // Assert
    await expect(
      part(page, 'レビュー').getByText(
        'この来店のレビューは、まだ書かれていません。',
      ),
    ).toBeVisible()
    await expectSoundPage(page)

    // Act: to the form, by its link and the Enter key
    await page.getByRole('link', { name: 'レビューを書く' }).focus()
    await page.keyboard.press('Enter')

    // Assert: the member of the staff the booking was with is chosen
    await expect(heading(page, 'レビューを書く')).toBeFocused()
    await expect(page).toHaveURL(`${PORTAL.origin}/bookings/${visit.id}/review`)
    await expect(choice(page, '評価するスタッフ')).toHaveValue(
      await staffId(api, TAKESHI),
    )
    await expectSoundPage(page)

    // Act: the controls follow each other as they are read. The ratings
    // are one stop of the Tab key: Space takes the first, an arrow the next
    await page.keyboard.press('Tab')
    await expect(
      part(page, 'レビューする来店').getByRole('link', { name: OSAKA }),
    ).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(rating(page, '5（とても満足）')).toBeFocused()
    await page.keyboard.press('Space')
    await expect(rating(page, '5（とても満足）')).toBeChecked()
    await page.keyboard.press('ArrowDown')
    await expect(rating(page, '4（満足）')).toBeChecked()
    await page.keyboard.press('Tab')
    await expect(choice(page, '評価するスタッフ')).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(choice(page, 'サービス')).toBeFocused()
    await choice(page, 'サービス').selectOption('5')

    // Act: the Enter key begins a line where a text is written, and sends
    // the form in a control of one line
    await text(page, '本文').focus()
    await page.keyboard.type('丁寧でした。')
    await page.keyboard.press('Enter')
    await page.keyboard.type('待ち時間もありませんでした。')
    await expect(text(page, '本文')).toHaveValue(
      '丁寧でした。\n待ち時間もありませんでした。',
    )
    await text(page, '写真の URL').fill(PICTURE)
    await text(page, 'タイトル').focus()
    await page.keyboard.type('また行きます')
    await page.keyboard.press('Enter')

    // Assert: the review is the first of what the customer wrote
    await expect(page.getByText('レビューを投稿しました。')).toBeVisible()
    await expect(heading(page, '自分のレビュー')).toBeFocused()
    await expect(page).toHaveURL(`${PORTAL.origin}/mypage/reviews`)
    await expect(ownReviews(page)).toHaveCount(2)
    const written = ownReviews(page).first()
    await expect(written.getByText('また行きます')).toBeVisible()
    await expect(
      written.getByText(`評価したスタッフ: ${TAKESHI}`),
    ).toBeVisible()
    await expect(written.getByText(/^丁寧でした。/)).toHaveCSS(
      'white-space',
      'pre-line',
    )
    await expect(pictures(written)).toHaveText([PICTURE])
    await expect(pictures(written)).toHaveAttribute('href', PICTURE)
    await expectSoundPage(page)
    const [review] = await stored(api, visit.id)
    expect(review).toMatchObject({
      staff: TAKESHI,
      overallRating: 4,
      serviceRating: 5,
      staffRating: null,
      title: 'また行きます',
      comment: '丁寧でした。\n待ち時間もありませんでした。',
      imageUrls: [PICTURE],
    })

    // Act: to the salon the review is of
    await written.getByRole('link', { name: OSAKA, exact: true }).click()

    // Assert: its page shows the review to everybody
    await expect(heading(page, OSAKA)).toBeFocused()
    await expect(
      part(page, 'レビュー')
        .getByRole('list', { name: 'レビュー' })
        .getByText('また行きます'),
    ).toBeVisible()
    await expectSoundPage(page)

    // Act: back, and to the form that changes the review, by its link and
    // the Enter key
    await page.goBack()
    await changeLink(ownReviews(page).first()).focus()
    await page.keyboard.press('Enter')

    // Assert: it opens with what the review holds
    await expect(heading(page, 'レビューを変更する')).toBeFocused()
    await expect(page).toHaveURL(
      `${PORTAL.origin}/mypage/reviews/${review?.['id']}`,
    )
    await expect(rating(page, '4（満足）')).toBeChecked()
    await expect(text(page, 'タイトル')).toHaveValue('また行きます')
    await expect(
      page.getByText(
        `評価するスタッフ: ${TAKESHI}。評価するスタッフは、変更できません。`,
      ),
    ).toBeVisible()
    await expectSoundPage(page)

    // Act: an arrow takes the rating before, and the Enter key sends
    await rating(page, '4（満足）').focus()
    await page.keyboard.press('ArrowUp')
    await text(page, 'タイトル').fill('必ずまた行きます')
    await text(page, 'タイトル').press('Enter')

    // Assert
    await expect(page.getByText('レビューを変更しました。')).toBeVisible()
    await expect(heading(page, '自分のレビュー')).toBeFocused()
    await expect(
      ownReviews(page).first().getByText('必ずまた行きます'),
    ).toBeVisible()
    expect(await stored(api, visit.id)).toMatchObject([
      {
        overallRating: 5,
        serviceRating: 5,
        title: '必ずまた行きます',
        comment: '丁寧でした。\n待ち時間もありませんでした。',
      },
    ])

    // Act
    await page.reload()

    // Assert: what the list shows is what the API has
    await expect(
      ownReviews(page).first().getByText('必ずまた行きます'),
    ).toBeVisible()

    // Act: the dialog is opened with the keyboard
    await removeButton(ownReviews(page).first()).focus()
    await page.keyboard.press('Enter')

    // Assert: it takes the focus, at its first button
    await expect(dialog(page)).toBeVisible()
    await expect(
      dialog(page).getByRole('button', { name: '戻る' }),
    ).toBeFocused()
    await expectSoundPage(page)

    // Act
    await page.keyboard.press('Escape')

    // Assert: nothing is removed, and the focus is back on the button
    await expect(dialog(page)).toBeHidden()
    await expect(removeButton(ownReviews(page).first())).toBeFocused()
    await expect(ownReviews(page)).toHaveCount(2)

    // Act: once more, through the buttons in their order
    await page.keyboard.press('Enter')
    await expect(
      dialog(page).getByRole('button', { name: '戻る' }),
    ).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(
      dialog(page).getByRole('button', { name: '削除する' }),
    ).toBeFocused()
    await page.keyboard.press('Enter')

    // Assert: the button went with the list that was read anew, so the
    // heading has the focus
    await expect(page.getByText('レビューを削除しました。')).toBeVisible()
    await expect(heading(page, '自分のレビュー')).toBeFocused()
    await expect(ownReviews(page)).toHaveCount(1)
    await expect(page.getByText('必ずまた行きます')).toBeHidden()
    await expectSoundPage(page)
    expect(await stored(api, visit.id)).toEqual([])

    // Act: the page of the visit, by its address
    await page.goto(`${PORTAL.origin}/bookings/${visit.id}`)

    // Assert: the visit can be written about again
    await expect(
      part(page, 'レビュー').getByRole('link', { name: 'レビューを書く' }),
    ).toBeVisible()
  })
})

test.describe('the reviews of a customer, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the form with a choice of staff and with what is wrong, the list with long values and an answer of the salon, the dialog and the form that changes into the width', async ({
    page,
    api,
    request,
  }) => {
    // Arrange: a visit that two members of the staff took, written about
    // once more
    const visit = await visitOf(api, VIP, true)
    await remove(request, api, visit.reviewId, VIP)
    await page.goto(`${PORTAL.origin}/bookings/${visit.id}/review`)
    await enterCredentials(page, VIP, api.seedPassword)

    // Assert: everybody who took the booking is offered, the member it
    // was with first
    await expect(heading(page, 'レビューを書く')).toBeFocused()
    await expect(
      choice(page, '評価するスタッフ').getByRole('option'),
    ).toHaveText(['スタッフを評価しない', MIKA, HIROSHI])
    await expectSoundPage(page)

    // Act: what cannot be right. No rating, and a line that is no address
    await text(page, 'タイトル').fill(LONG_TITLE)
    await text(page, '本文').fill(LONG_COMMENT)
    await text(page, '写真の URL').fill(`${LONG_PICTURE}\nno address`)
    await sendButton(page).click()

    // Assert
    await expect(rating(page, '5（とても満足）')).toBeFocused()
    await expect(page.getByText('総合の評価を選んでください。')).toBeVisible()
    await expect(
      page.getByText(
        '2 行目を確かめてください。http:// または https:// で始まる URL を、500 文字以内で書いてください。',
      ),
    ).toBeVisible()
    await expect(page).toHaveURL(`${PORTAL.origin}/bookings/${visit.id}/review`)
    await expectSoundPage(page)

    // Act
    await rating(page, '3（ふつう）').check()
    await choice(page, '評価するスタッフ').selectOption({ label: HIROSHI })
    await choice(page, 'スタッフ').selectOption('5')
    await text(page, '写真の URL').fill(`${LONG_PICTURE}\n${PICTURE}`)
    await sendButton(page).click()

    // Assert
    await expect(heading(page, '自分のレビュー')).toBeFocused()
    const review = ownReviews(page).first()
    await expect(review.getByText(LONG_TITLE)).toBeVisible()
    await expect(review.getByText(`評価したスタッフ: ${HIROSHI}`)).toBeVisible()
    await expect(pictures(review)).toHaveText([LONG_PICTURE, PICTURE])
    // Each address stands on a line of its own, below the one before
    const first = await pictures(review).first().boundingBox()
    const second = await pictures(review).last().boundingBox()
    expect(first).not.toBeNull()
    expect(second?.y).toBeGreaterThanOrEqual(
      (first?.y ?? Number.POSITIVE_INFINITY) + (first?.height ?? 0),
    )
    // The way to change the review and the way to remove it share a line
    const change = await changeLink(review).boundingBox()
    const removal = await removeButton(review).boundingBox()
    expect(change).not.toBeNull()
    expect(removal?.y).toBe(change?.y)
    expect(removal?.height).toBe(change?.height)
    expect(removal?.x).toBeGreaterThan(change?.x ?? Number.POSITIVE_INFINITY)
    await expectSoundPage(page)
    const [written] = await stored(api, visit.id)
    expect(written).toMatchObject({
      staff: HIROSHI,
      overallRating: 3,
      staffRating: 5,
      title: LONG_TITLE,
      comment: LONG_COMMENT,
      imageUrls: [LONG_PICTURE, PICTURE],
    })

    // Act: the salon answers, at length
    await respond(request, api, written?.['id'], LONG_RESPONSE)
    await page.reload()

    // Assert: what was written in paragraphs keeps its line breaks
    await expect(
      review.getByText(/^またのご来店をお待ちしています。/),
    ).toHaveCSS('white-space', 'pre-line')
    await expectSoundPage(page)

    // Act: the dialog, which names the review
    await removeButton(review).click()

    // Assert
    await expect(dialog(page)).toBeVisible()
    await expectSoundPage(page)

    // Act: out of the dialog, and to the form that changes the review
    await dialog(page).getByRole('button', { name: '戻る' }).click()
    await expect(dialog(page)).toBeHidden()
    await changeLink(review).click()

    // Assert
    await expect(heading(page, 'レビューを変更する')).toBeFocused()
    await expect(text(page, 'タイトル')).toHaveValue(LONG_TITLE)
    await expect(text(page, '写真の URL')).toHaveValue(
      `${LONG_PICTURE}\n${PICTURE}`,
    )
    await expectSoundPage(page)

    // Act: what cannot be right
    await text(page, 'タイトル').fill('あ'.repeat(256))
    await saveButton(page).click()

    // Assert
    await expect(text(page, 'タイトル')).toBeFocused()
    await expect(
      page.getByText('255 文字以内で入力してください。'),
    ).toBeVisible()
    await expectSoundPage(page)
  })
})
