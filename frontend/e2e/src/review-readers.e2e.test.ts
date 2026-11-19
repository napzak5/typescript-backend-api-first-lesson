import type { APIRequestContext, Locator, Page } from '@playwright/test'
import * as z from 'zod'
import { PORTAL } from './applications'
import { HIROSHI, part, salonId, TOKYO } from './bookings'
import { expectSoundPage } from './checks'
import { expect, type TestApi, test } from './fixtures'
import { accessTokenOf, enterCredentials, heading } from './sign-in'

/*
 * The reader is the second customer of the seed data, Kenji Yamamoto. He
 * wrote none of the three reviews of Beauty Studio Tokyo, and one of the
 * two of Hair & Spa Osaka. Nobody found the review 'Good but could be
 * better' helpful, and nobody reported it.
 */

const KENJI = 'customer2@example.com'
const ADMIN = 'admin@beautysalon.jp'

const OSAKA = 'Hair & Spa Osaka'

const GOOD = 'Good but could be better'
const SATISFIED = 'Satisfied with the result'
const OWN = 'Great experience'

/* A title that no line can be broken in: a browser breaks no line at an underscore. */
const LONG_TITLE =
  'A_colour_that_is_exactly_what_I_asked_for_and_a_cut_that_keeps_its_shape_for_weeks'

const SIGN_IN_LINE =
  'サインインすると、レビューが参考になったと伝えたり、問題のあるレビューを通報したりできます。'
const SAID = '「参考になった」と伝えました。'
const REPORTED =
  'レビューを通報しました。運営が内容を確かめます。確かめが済むまで、レビューは掲載されたままです。'
const REPORTED_BEFORE =
  'このレビューは、すでに通報しています。1 つのレビューを通報できるのは、1 回です。'
const GONE = 'このレビューは、削除されていました。レビューを読み込み直します。'

const FIRST_REASON = '不適切な表現（暴言、差別的な表現など）'
const WHAT_IS_WRONG = 'ほかのサロンのことが書かれています'

const storedSchema = z.tuple([
  z.object({
    id: z.uuid(),
    helpfulCount: z.number().int(),
    reportCount: z.number().int(),
    voters: z.array(z.string()),
    reports: z.array(
      z.object({
        by: z.string(),
        reason: z.string(),
        details: z.string().nullable(),
        status: z.string(),
      }),
    ),
  }),
])

/** What the database has of the review of a title: who found it helpful, and who reported it why. */
const stored = async (api: TestApi, title: string) => {
  const [review] = storedSchema.parse(
    await api.query(
      `select reviews.id::text, reviews."helpfulCount", reviews."reportCount",
              coalesce((select json_agg(customers.email order by customers.email)
                        from review_helpful_votes votes
                        join customers on customers.id = votes."customerId"
                        where votes."reviewId" = reviews.id), '[]'::json) as voters,
              coalesce((select json_agg(json_build_object('by', users.email, 'reason', reports.reason,
                                                          'details', reports.details, 'status', reports.status)
                                        order by reports."createdAt")
                        from review_reports reports
                        join users on users.id = reports."reportedBy"
                        where reports."reviewId" = reviews.id), '[]'::json) as reports
       from reviews where reviews.title = $1`,
      [title],
    ),
  )

  return review
}

const idSchema = z.tuple([z.object({ id: z.uuid() })])

const salonPath = async (api: TestApi, name: string): Promise<string> => {
  const [{ id }] = idSchema.parse(
    await api.query('select id::text from salons where name = $1', [name]),
  )

  return `/salons/${id}`
}

/** An administrator removes a review while a customer reads it: no screen of the portal does that. */
const remove = async (
  request: APIRequestContext,
  api: TestApi,
  reviewId: string,
): Promise<void> => {
  const answer = await request.delete(
    `${api.origin}/api/v1/reviews/${reviewId}`,
    {
      headers: {
        Authorization: `Bearer ${await accessTokenOf(request, api, ADMIN)}`,
      },
    },
  )
  expect(answer.status()).toBe(204)
}

const reviews = (page: Page): Locator => part(page, 'レビュー')

/** The review of a title, in the list of the page of a salon. */
const review = (page: Page, title: string): Locator =>
  reviews(page)
    .getByRole('list', { name: 'レビュー' })
    .getByRole('listitem')
    .filter({ hasText: title })

const helpfulButton = (of: Locator): Locator =>
  of.getByRole('button', { name: /のレビューが参考になった$/ })

const reportButton = (of: Locator): Locator =>
  of.getByRole('button', { name: /のレビューを通報する$/ })

const dialog = (page: Page): Locator =>
  page.getByRole('dialog', { name: 'レビューを通報する' })

const reasons = (page: Page): Locator =>
  dialog(page).getByRole('radiogroup', { name: '通報の理由' })

const reason = (page: Page, name: string): Locator =>
  dialog(page).getByRole('radio', { name, exact: true })

const details = (page: Page): Locator =>
  dialog(page).getByRole('textbox', { name: '詳しい内容' })

const sendButton = (page: Page): Locator =>
  dialog(page).getByRole('button', { name: '通報する' })

/**
 * The colour of the surface of a button that waits for nothing, once the
 * browser has finished changing it. A button that waits has a colour of
 * its own, and goes from one colour to the next in a moment: a colour on
 * the way is neither.
 */
const surfaceOf = async (button: Locator): Promise<string> => {
  await expect(button).not.toHaveAttribute('aria-busy')

  return button.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map(({ finished }) => finished))

    return getComputedStyle(element).backgroundColor
  })
}

/** From the reasons to the button that sends, as the Tab key goes: the text, the way back, the button. */
const tabToTheSendButton = async (page: Page): Promise<void> => {
  await page.keyboard.press('Tab')
  await expect(details(page)).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog(page).getByRole('button', { name: '戻る' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(sendButton(page)).toBeFocused()
}

test.describe('the reviews of a salon and who reads them, in a browser', () => {
  test('should bring a visitor back from the sign-in, and let the customer find a review helpful and report one with the keyboard, and say when a review is gone', async ({
    page,
    api,
    request,
  }) => {
    // Arrange
    const address = `${PORTAL.origin}/salons/${await salonId(api)}`
    await page.goto(address)

    // Assert: somebody who is not signed in reads, and is shown the way in
    await expect(reviews(page).getByText(SIGN_IN_LINE)).toBeVisible()
    await expect(review(page, GOOD)).toBeVisible()
    await expect(reviews(page).getByRole('button')).toHaveCount(0)
    await expectSoundPage(page)

    // Act: to the sign-in by the link of the reviews, and the Enter key
    await reviews(page).getByRole('link', { name: 'サインイン' }).focus()
    await page.keyboard.press('Enter')
    await enterCredentials(page, KENJI, api.seedPassword)

    // Assert: back on the page of the salon, with the buttons of a customer
    await expect(heading(page, TOKYO)).toBeFocused()
    await expect(page).toHaveURL(address)
    const good = review(page, GOOD)
    await expect(helpfulButton(good)).toHaveAttribute('aria-pressed', 'false')
    await expect(reviews(page).getByText(SIGN_IN_LINE)).toHaveCount(0)
    await expectSoundPage(page)

    // Act: the review was helpful, by the Space key. The pointer is still
    // where the sign-in was pressed, and the page moves under it when it
    // says something: out of the way, so that no button has the colour of
    // one that is pointed at
    await page.mouse.move(0, 0)
    await helpfulButton(good).focus()
    const unpressed = await surfaceOf(helpfulButton(good))
    await page.keyboard.press('Space')

    // Assert: the button is pressed, does not look as it did, and keeps
    // the focus
    await expect(page.getByText(SAID)).toBeVisible()
    await expect(helpfulButton(good)).toHaveAttribute('aria-pressed', 'true')
    expect(await surfaceOf(helpfulButton(good))).not.toBe(unpressed)
    await expect(helpfulButton(good)).toBeFocused()
    await expect(
      good.getByText('1 人が「参考になった」と答えています'),
    ).toBeVisible()
    expect(await stored(api, GOOD)).toMatchObject({
      helpfulCount: 1,
      voters: [KENJI],
    })
    await expectSoundPage(page)

    // Act: the next stop of the Tab key reports the review
    await page.keyboard.press('Tab')
    await expect(reportButton(good)).toBeFocused()
    await page.keyboard.press('Enter')

    // Assert: the dialog takes the focus, at the first of its reasons
    await expect(dialog(page)).toBeVisible()
    await expect(reason(page, FIRST_REASON)).toBeFocused()
    await expect(
      reasons(page).getByRole('radio', { checked: true }),
    ).toHaveCount(0)
    await expectSoundPage(page)

    // Act: sent as it is
    await tabToTheSendButton(page)
    await page.keyboard.press('Enter')

    // Assert: a reason is missing, and the focus is on the first of them
    await expect(reasons(page)).toHaveAccessibleDescription(
      '通報の理由を選んでください。',
    )
    await expect(reason(page, FIRST_REASON)).toBeFocused()
    await expectSoundPage(page)

    // Act: an arrow chooses; before the first reason is the last, which
    // needs a word about it
    await page.keyboard.press('ArrowUp')
    await expect(reason(page, 'その他')).toBeChecked()
    await tabToTheSendButton(page)
    await page.keyboard.press('Enter')

    // Assert
    await expect(details(page)).toBeFocused()
    await expect(details(page)).toHaveAttribute('aria-invalid', 'true')
    await expect(reasons(page)).not.toHaveAttribute('aria-invalid')
    await expectSoundPage(page)

    // Act: the Enter key begins a line where a text is written, so the
    // button sends
    await page.keyboard.type(WHAT_IS_WRONG)
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await expect(sendButton(page)).toBeFocused()
    await page.keyboard.press('Enter')

    // Assert: the review is reported and stays, and the focus is back on
    // the button that opened the dialog
    await expect(dialog(page)).toBeHidden()
    await expect(page.getByText(REPORTED)).toBeVisible()
    await expect(reportButton(good)).toBeFocused()
    await expect(good).toBeVisible()
    expect(await stored(api, GOOD)).toMatchObject({
      reportCount: 1,
      reports: [
        {
          by: KENJI,
          reason: 'other',
          details: WHAT_IS_WRONG,
          status: 'pending',
        },
      ],
    })
    await expectSoundPage(page)

    // Act: once more, and out by the Escape key
    await page.keyboard.press('Enter')

    // Assert: the form is a new one
    await expect(reason(page, FIRST_REASON)).toBeFocused()
    await expect(
      reasons(page).getByRole('radio', { checked: true }),
    ).toHaveCount(0)
    await expect(details(page)).toHaveValue('')
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toBeHidden()
    await expect(reportButton(good)).toBeFocused()

    // Act: a second report of the same review
    await page.keyboard.press('Enter')
    await page.keyboard.press('Space')
    await expect(reason(page, FIRST_REASON)).toBeChecked()
    await tabToTheSendButton(page)
    await page.keyboard.press('Enter')

    // Assert: the dialog says that there is nothing to send, and the focus
    // is on the way out that is left
    await expect(dialog(page).getByText(REPORTED_BEFORE)).toBeVisible()
    await expect(dialog(page).getByRole('button')).toHaveText(['閉じる'])
    await expect(
      dialog(page).getByRole('button', { name: '閉じる' }),
    ).toBeFocused()
    await expectSoundPage(page)
    await page.keyboard.press('Enter')
    await expect(dialog(page)).toBeHidden()
    await expect(reportButton(good)).toBeFocused()
    expect((await stored(api, GOOD)).reports).toHaveLength(1)

    // Act: an administrator removes another review, and the customer
    // reports it from the page that still shows it
    const satisfied = review(page, SATISFIED)
    await remove(request, api, (await stored(api, SATISFIED)).id)
    await reportButton(satisfied).focus()
    await page.keyboard.press('Enter')
    await expect(reason(page, FIRST_REASON)).toBeFocused()
    await page.keyboard.press('Space')
    await tabToTheSendButton(page)
    await page.keyboard.press('Enter')

    // Assert: the dialog went with the review and its buttons, the focus
    // is on the heading of the part, and what counts the reviews is read
    // again
    await expect(page.getByText(GONE)).toBeVisible()
    await expect(dialog(page)).toHaveCount(0)
    await expect(
      reviews(page).getByRole('heading', { level: 2, name: 'レビュー' }),
    ).toBeFocused()
    await expect(satisfied).toHaveCount(0)
    await expect(
      reviews(page).getByRole('img', { name: '5 段階中 4.0（2 件）' }),
    ).toBeVisible()
    await expect(helpfulButton(good)).toHaveAttribute('aria-pressed', 'true')
    await expectSoundPage(page)

    // Act: the page behind the dialog is in use again, and the keyboard
    // goes on from the heading
    await page.keyboard.press('Tab')

    // Assert
    await expect(
      reviews(page).getByRole('combobox', { name: '並び順' }),
    ).toBeFocused()
  })
})

test.describe('the reviews of a salon and who reads them, on a screen as narrow as a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('should fit the ratings of the staff, the buttons of a review with a long title, the dialog with what is wrong and with an earlier report, and the link of what the customer wrote into the width', async ({
    page,
    api,
  }) => {
    // Arrange: a review whose title no line can be broken in; the address
    // of the sign-in names the page to go on to
    await api.query('update reviews set title = $1 where title = $2', [
      LONG_TITLE,
      GOOD,
    ])
    const path = `/salons/${await salonId(api)}`
    await page.goto(`${PORTAL.origin}/sign-in?from=${encodeURIComponent(path)}`)
    await enterCredentials(page, KENJI, api.seedPassword)

    // Assert: how each member of the staff was rated, and the buttons
    await expect(heading(page, TOKYO)).toBeFocused()
    const staff = part(page, 'スタッフ')
    await expect(
      staff
        .getByRole('listitem')
        .filter({ has: page.getByRole('heading', { level: 3, name: HIROSHI }) })
        .getByRole('img', { name: '5 段階中 5.0（1 件）' }),
    ).toBeVisible()
    await expect(staff.getByText('レビューは、まだありません')).toHaveCount(2)
    const long = review(page, LONG_TITLE)
    await expect(helpfulButton(long)).toBeVisible()
    const helpful = await helpfulButton(long).boundingBox()
    const report = await reportButton(long).boundingBox()
    expect(helpful).not.toBeNull()
    expect(report?.y).toBe(helpful?.y)
    expect(report?.x).toBeGreaterThan(helpful?.x ?? Number.POSITIVE_INFINITY)
    await expectSoundPage(page)

    // Act
    await helpfulButton(long).click()

    // Assert: the pressed button, with its mark
    await expect(helpfulButton(long)).toHaveAttribute('aria-pressed', 'true')
    await expect(helpfulButton(long)).toHaveText('✓参考になった')
    await expectSoundPage(page)

    // Act: the dialog, which names the review by its title
    await reportButton(long).click()

    // Assert
    await expect(dialog(page)).toBeVisible()
    await expect(dialog(page)).toHaveAccessibleDescription(
      new RegExp(
        `^「${LONG_TITLE}」（.+ 投稿）のレビューを、運営に通報します。`,
      ),
    )
    await expectSoundPage(page)

    // Act: sent without a reason, and for a reason of its own without a word
    await sendButton(page).click()
    await expect(reasons(page)).toHaveAccessibleDescription(
      '通報の理由を選んでください。',
    )
    await expectSoundPage(page)
    await reason(page, 'その他').check()
    await sendButton(page).click()

    // Assert
    await expect(details(page)).toHaveAttribute('aria-invalid', 'true')
    await expectSoundPage(page)

    // Act: the report, and a second one
    await details(page).fill(WHAT_IS_WRONG)
    await sendButton(page).click()
    await expect(dialog(page)).toBeHidden()
    await expect(page.getByText(REPORTED)).toBeVisible()
    await expectSoundPage(page)
    await reportButton(long).click()
    await reason(page, FIRST_REASON).check()
    await sendButton(page).click()

    // Assert
    await expect(dialog(page).getByText(REPORTED_BEFORE)).toBeVisible()
    await expectSoundPage(page)

    // Act: a salon the customer wrote about
    await page.goto(`${PORTAL.origin}${await salonPath(api, OSAKA)}`)

    // Assert: what the customer wrote has its link, beside the buttons of
    // what somebody else wrote
    await expect(heading(page, OSAKA)).toBeVisible()
    await expect(
      review(page, OWN).getByRole('link', { name: /のレビューを変更する$/ }),
    ).toBeVisible()
    await expect(review(page, OWN).getByRole('button')).toHaveCount(0)
    await expect(
      reviews(page).getByRole('button', { name: /のレビューが参考になった$/ }),
    ).toHaveCount(1)
    await expectSoundPage(page)
  })
})
