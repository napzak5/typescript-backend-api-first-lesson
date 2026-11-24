import { languageStore } from '@beauty-salon-frontend/io'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { asked, sent } from '@beauty-salon-frontend/testing/answers'
import {
  giveBack,
  idOf,
  takeAway,
  testApi,
} from '@beauty-salon-frontend/testing/api'
import {
  address,
  asTheApplicationKeeps,
  heading,
  queryClientOfATest,
  statusMessages,
} from '@beauty-salon-frontend/testing/screens'
import {
  CUSTOMER,
  KENJI,
  OPERATOR,
  OSAKA,
  STYLIST,
  TOKYO,
  VIP,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as z from 'zod'
import { renderAt } from '../../__tests__/screens'
import {
  HIROSHI,
  NEWCOMER,
  NEWCOMER_PASSWORD,
  registerNewcomer,
  signedInAs,
} from '../../bookings/__tests__/arrangements'
import { OWN_PROFILE } from '../../profile/api/profile-api'
import {
  dayInEnglish,
  dismissesReportOf,
  findsHelpful,
  overall,
  paragraphsIn,
  ratingOf,
  region,
  removes,
  reports,
  TAKESHI,
  visitToReview,
} from '../__tests__/arrangements'

/*
 * What somebody who reads the reviews of a salon does with them, on the
 * page of the salon: a customer says that a review was helpful and reports
 * one, in a dialog; everybody sees how each member of the staff was rated.
 * What a test starts from is written as a customer or an administrator
 * writes it, through the API. The seed data has helpful marks and reports
 * as well, and does not say which account its reports are of: no test
 * goes by them.
 *
 * Not met here: the API limiting the requests, and a report that the API
 * refuses although the form took it (the form sends nothing of the kind).
 * They are in `reader-flow.test.ts` and `reviews-api.test.ts`.
 */

const REPORT_TITLE = 'レビューを通報する'
const SAID = '「参考になった」と伝えました。'
const REPORTED =
  'レビューを通報しました。運営が内容を確かめます。確かめが済むまで、レビューは掲載されたままです。'
const REPORTED_BEFORE =
  'このレビューは、すでに通報しています。1 つのレビューを通報できるのは、1 回です。'
const GONE = 'このレビューは、削除されていました。レビューを読み込み直します。'
const NOT_SENT =
  '送信できませんでした。通信の状態を確かめて、もう一度お試しください。'
const SIGN_IN_LINE =
  'サインインすると、レビューが参考になったと伝えたり、問題のあるレビューを通報したりできます。'
const NOT_RATED = 'レビューは、まだありません'

// --- What the tests ask of the database

const salonPathOf = async (name: string): Promise<string> => {
  const id = await idOf('select id::text from salons where name = $1', [name])

  return `/salons/${id}`
}

const seenSchema = z.array(
  z.object({
    id: z.uuid(),
    title: z.string(),
    writer: z.string(),
    helpfulCount: z.number().int(),
    /** The day it was posted on, at its salon, as a screen says it */
    posted: z.string(),
    /** The same day, as the formats are given it: `2026-11-10` */
    postedOn: z.iso.date(),
    /** The customer is among those who found it helpful */
    voted: z.boolean(),
    /** The account of the customer reported it */
    reported: z.boolean(),
  }),
)

type Seen = z.infer<typeof seenSchema>[number]

/** The reviews of a salon as they are stored, each with what a customer did with it. */
const reviewsSeenBy = async (email: string, salon: string): Promise<Seen[]> =>
  seenSchema.parse(
    await testApi().query(
      `select reviews.id::text, reviews.title, writers.email as writer, reviews."helpfulCount",
              to_char(reviews."createdAt" at time zone salons.timezone, 'YYYY"年"FMMM"月"FMDD"日"') as posted,
              to_char(reviews."createdAt" at time zone salons.timezone, 'YYYY-MM-DD') as "postedOn",
              exists (select 1 from review_helpful_votes votes
                      join customers readers on readers.id = votes."customerId"
                      where votes."reviewId" = reviews.id and readers.email = $1) as voted,
              exists (select 1 from review_reports reports
                      join users on users.id = reports."reportedBy"
                      where reports."reviewId" = reviews.id and users.email = $1) as reported
       from reviews
       join salons on salons.id = reviews."salonId"
       join customers writers on writers.id = reviews."customerId"
       where salons.name = $2
       order by reviews."helpfulCount", reviews.id`,
      [email, salon],
    ),
  )

/** The one of the reviews that is as a test needs it. */
const reviewThat = async (
  what: string,
  email: string,
  salon: string,
  is: (review: Seen) => boolean,
): Promise<Seen> => {
  const found = (await reviewsSeenBy(email, salon)).find(is)
  if (found === undefined) {
    throw new Error(`${salon} has no review that ${email} ${what}`)
  }

  return found
}

/** A review of somebody else that the customer has done nothing with: the one fewest found helpful. */
const untouchedBy = (email: string, salon = TOKYO): Promise<Seen> =>
  reviewThat(
    'has done nothing with',
    email,
    salon,
    ({ writer, voted, reported }) => writer !== email && !voted && !reported,
  )

const storedSchema = z.tuple([
  z.object({
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

/** What is stored of a review: who found it helpful, and who reported it why. */
const storedOf = async (reviewId: string) => {
  const [stored] = storedSchema.parse(
    await testApi().query(
      `select reviews."helpfulCount", reviews."reportCount",
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
       from reviews where reviews.id = $1`,
      [reviewId],
    ),
  )

  return stored
}

/** The reviews of the seed data were written at one moment: the better the rating, the earlier. */
const inTheOrderOfTheirRatings = () =>
  testApi().query(
    `update reviews set "createdAt" = now() - "overallRating" * interval '1 day'`,
  )

/** The reviews of Beauty Studio Tokyo, in that order: the latest first. */
const TOKYO_LATEST_FIRST = [
  'Good but could be better',
  'Satisfied with the result',
  'Excellent service!',
]

// --- What the tests read on the screen

const reviewsPart = () => region('レビュー')

const reviewList = async (): Promise<HTMLElement> =>
  within(await reviewsPart()).findByRole('list', { name: 'レビュー' })

const reviewsListed = async (): Promise<HTMLElement[]> =>
  within(await reviewList()).getAllByRole('listitem')

/** The titles of the reviews, in the order of the list. */
const titles = async (): Promise<string[]> =>
  (await reviewsListed()).map(
    (review) =>
      within(review).getAllByRole('paragraph').at(1)?.textContent ?? '',
  )

const reviewTitled = async (title: string): Promise<HTMLElement> => {
  const found = (await reviewsListed()).find(
    (review) => within(review).queryByText(title) !== null,
  )
  if (found === undefined) {
    throw new Error(`No review is titled ${title}`)
  }

  return found
}

const HELPFUL_BUTTON = /のレビューが参考になった$/
const REPORT_BUTTON = /のレビューを通報する$/

const helpfulButtonIn = (review: HTMLElement): HTMLElement =>
  within(review).getByRole('button', { name: HELPFUL_BUTTON })

const reportButtonIn = (review: HTMLElement): HTMLElement =>
  within(review).getByRole('button', { name: REPORT_BUTTON })

/** The review of a title, once the page knows that a customer reads: it has its buttons. */
const reviewToActOn = async (title: string): Promise<HTMLElement> => {
  await within(await reviewList()).findAllByRole('button', {
    name: HELPFUL_BUTTON,
  })

  return reviewTitled(title)
}

/** What a review says about those who found it helpful; `null` when nobody did. */
const helpfulIn = (review: HTMLElement): string | null =>
  within(review).queryByText(/「参考になった」と答えています$/)?.textContent ??
  null

/** The buttons and the links of each review, as they are written on them. */
const controls = async (): Promise<(string | null)[][]> =>
  (await reviewsListed()).map((review) =>
    [
      ...within(review).queryAllByRole('button'),
      ...within(review).queryAllByRole('link'),
    ].map((control) => control.textContent),
  )

const order = async (): Promise<HTMLElement> =>
  within(await reviewsPart()).findByRole('combobox', { name: '並び順' })

const dialog = () => screen.getByRole('dialog', { name: REPORT_TITLE })
const reason = (name: string) => within(dialog()).getByRole('radio', { name })
const details = () =>
  within(dialog()).getByRole('textbox', { name: '詳しい内容' })
const sendButton = () =>
  within(dialog()).getByRole('button', { name: '通報する' })

/** Opens the dialog that reports the review of a title. */
const askToReport = async (title: string): Promise<void> => {
  await userEvent.click(reportButtonIn(await reviewToActOn(title)))
}

const sectionHeading = () =>
  screen.getByRole('heading', { level: 2, name: 'レビュー' })

/** A line of what was asked that is about the reviews: the screen asks for more than them. */
const ofTheReviews = (line: string): boolean => line.includes(' /reviews')

/** A member of the staff, in the part of the page that shows the people. */
const personNamed = async (name: string): Promise<HTMLElement> => {
  const staff = await region('スタッフ')
  await within(staff).findByRole('heading', { level: 3, name })
  const found = within(staff)
    .getAllByRole('listitem')
    .find(
      (candidate) =>
        within(candidate).queryByRole('heading', { level: 3, name }) !== null,
    )
  if (found === undefined) {
    throw new Error(`Nobody is named ${name}`)
  }

  return found
}

/** Signs in on the screen, as a seeded account. */
const signInOnTheScreenAs = async (email: string): Promise<void> => {
  const user = userEvent.setup()
  await user.type(
    await screen.findByRole('textbox', { name: 'メールアドレス' }),
    email,
  )
  await user.type(screen.getByLabelText('パスワード'), testApi().seedPassword)
  await user.click(screen.getByRole('button', { name: 'サインイン' }))
}

describe('what a reader does with the reviews of a salon, against the API', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('who is offered what', () => {
    it('should offer somebody who is not signed in the way to sign in, and no button of a review', async () => {
      // Arrange
      const path = await salonPathOf(TOKYO)

      // Act
      renderAt(path)

      // Assert
      const part = await reviewsPart()
      expect(await controls()).toEqual([[], [], []])
      expect(paragraphsIn(part)).toContain(SIGN_IN_LINE)
      expect(
        within(part).getByRole('link', { name: 'サインイン' }),
      ).toHaveAttribute('href', `/sign-in?from=${encodeURIComponent(path)}`)
    })

    it('should bring somebody who signs in from there back to the page of the salon, and offer them the buttons of a customer', async () => {
      // Arrange
      const path = await salonPathOf(TOKYO)
      renderAt(path)
      await reviewList()

      // Act
      await userEvent.click(
        within(await reviewsPart()).getByRole('link', { name: 'サインイン' }),
      )
      await signInOnTheScreenAs(KENJI.email)

      // Assert
      await heading(TOKYO)
      expect(address()).toBe(path)
      await reviewToActOn('Good but could be better')
      expect(await controls()).toEqual([
        ['参考になった', '通報する'],
        ['参考になった', '通報する'],
        ['参考になった', '通報する'],
      ])
      expect(paragraphsIn(await reviewsPart())).not.toContain(SIGN_IN_LINE)
    })

    it('should go on to the start, and nowhere else, after a sign-in at an address that names another site', async () => {
      // Arrange
      renderAt('/sign-in?from=https%3A%2F%2Fexample.com%2F')

      // Act
      await signInOnTheScreenAs(KENJI.email)

      // Assert
      await screen.findByRole('searchbox', { name: 'キーワード' })
      expect(address()).toBe('/')
    })

    it.each([
      ['a member of a staff', STYLIST],
      ['an administrator', OPERATOR],
    ])(
      'should let %s read the reviews, and offer neither the buttons nor the way to sign in',
      async (_who, email) => {
        // Arrange
        await signedInAs(email)

        // Act
        renderAt(await salonPathOf(TOKYO))

        // Assert
        await within(screen.getByRole('banner')).findByText(email)
        expect(await titles()).toHaveLength(3)
        expect(await controls()).toEqual([[], [], []])
        expect(paragraphsIn(await reviewsPart())).not.toContain(SIGN_IN_LINE)
      },
    )

    it('should offer nothing to an account that has not said who its customer is', async () => {
      // Arrange
      await registerNewcomer()
      await signedInAs(NEWCOMER, NEWCOMER_PASSWORD)
      const client = queryClientOfATest()

      // Act
      renderAt(await salonPathOf(TOKYO), { client })

      // Assert: the profile was asked for, and there is none
      await reviewList()
      await waitFor(() => {
        expect(client.getQueryData(OWN_PROFILE)).toEqual({ type: 'none' })
        expect(client.isFetching()).toBe(0)
      })
      expect(await controls()).toEqual([[], [], []])
      expect(paragraphsIn(await reviewsPart())).not.toContain(SIGN_IN_LINE)
    })

    it('should give what the customer wrote the link to the form that changes it, and the reviews of the others their two buttons', async () => {
      // Arrange
      await inTheOrderOfTheirRatings()
      await signedInAs(CUSTOMER)
      const own = await reviewThat(
        'wrote',
        CUSTOMER,
        TOKYO,
        ({ writer }) => writer === CUSTOMER,
      )

      // Act
      renderAt(await salonPathOf(TOKYO))

      // Assert
      await reviewToActOn(own.title)
      expect(await titles()).toEqual(TOKYO_LATEST_FIRST)
      expect(await controls()).toEqual([
        ['参考になった', '通報する'],
        ['参考になった', '通報する'],
        ['レビューを変更する'],
      ])
      expect(
        within(await reviewTitled(own.title)).getByRole('link', {
          name: `「${own.title}」（${own.posted} 投稿）のレビューを変更する`,
        }),
      ).toHaveAttribute('href', `/mypage/reviews/${own.id}`)
    })

    it('should open the form that changes the review from its link', async () => {
      // Arrange
      await signedInAs(KENJI.email)
      renderAt(await salonPathOf(OSAKA))
      const own = await reviewToActOn('Great experience')

      // Act
      await userEvent.click(within(own).getByRole('link'))

      // Assert
      await heading('レビューを変更する')
      expect(
        await screen.findByRole('textbox', { name: 'タイトル' }),
      ).toHaveValue('Great experience')
    })

    it('should name the buttons of a review by its title and the day it was posted', async () => {
      // Arrange
      await signedInAs(KENJI.email)
      const review = await untouchedBy(KENJI.email)

      // Act
      renderAt(await salonPathOf(TOKYO))

      // Assert
      const listed = await reviewToActOn(review.title)
      const subject = `「${review.title}」（${review.posted} 投稿）`
      expect(helpfulButtonIn(listed)).toHaveAccessibleName(
        `${subject}のレビューが参考になった`,
      )
      expect(reportButtonIn(listed)).toHaveAccessibleName(
        `${subject}のレビューを通報する`,
      )
    })
  })

  describe('saying that a review was helpful', () => {
    it('should count the customer among those who found the review helpful, say so, and show the button as pressed', async () => {
      // Arrange
      await signedInAs(KENJI.email)
      const review = await untouchedBy(KENJI.email)
      renderAt(await salonPathOf(TOKYO))
      const listed = await reviewToActOn(review.title)
      expect(helpfulIn(listed)).toBeNull()
      expect(helpfulButtonIn(listed)).toHaveAttribute('aria-pressed', 'false')
      const fetched = vi.spyOn(globalThis, 'fetch')

      // Act
      await userEvent.click(helpfulButtonIn(listed))

      // Assert
      await screen.findByText(SAID)
      expect(statusMessages()).toContain(SAID)
      expect(helpfulIn(listed)).toBe('1 人が「参考になった」と答えています')
      expect(helpfulButtonIn(listed)).toHaveAttribute('aria-pressed', 'true')
      expect(helpfulButtonIn(listed)).toHaveFocus()
      expect(await storedOf(review.id)).toMatchObject({
        helpfulCount: 1,
        voters: [KENJI.email],
      })
      // The reviews are not read again: the answer says how many there are
      expect(asked(fetched).filter(ofTheReviews)).toEqual([
        `POST /reviews/${review.id}/helpful`,
      ])
    })

    it('should leave the buttons of the other reviews as they were, and keep a button pressed when another review is found helpful', async () => {
      // Arrange
      await inTheOrderOfTheirRatings()
      await signedInAs(KENJI.email)
      renderAt(await salonPathOf(TOKYO))
      const listed = await reviewToActOn('Good but could be better')
      const pressed = async (): Promise<(string | null)[]> =>
        (await reviewsListed()).map((review) =>
          helpfulButtonIn(review).getAttribute('aria-pressed'),
        )

      // Act
      await userEvent.click(helpfulButtonIn(listed))
      await screen.findByText(SAID)

      // Assert
      expect(await pressed()).toEqual(['true', 'false', 'false'])
      expect(await titles()).toEqual(TOKYO_LATEST_FIRST)

      // Act: the next review, too
      await userEvent.click(
        helpfulButtonIn(await reviewTitled('Satisfied with the result')),
      )

      // Assert
      await waitFor(async () => {
        expect(await pressed()).toEqual(['true', 'true', 'false'])
      })
      expect(await titles()).toEqual(TOKYO_LATEST_FIRST)
    })

    it('should send nothing when the button that is pressed is pressed again', async () => {
      // Arrange
      await signedInAs(KENJI.email)
      const review = await untouchedBy(KENJI.email)
      renderAt(await salonPathOf(TOKYO))
      const listed = await reviewToActOn(review.title)
      const fetched = vi.spyOn(globalThis, 'fetch')
      await userEvent.click(helpfulButtonIn(listed))
      await screen.findByText(SAID)

      // Act
      await userEvent.click(helpfulButtonIn(listed))
      await userEvent.keyboard('{Enter}')

      // Assert
      expect(asked(fetched).filter(ofTheReviews)).toEqual([
        `POST /reviews/${review.id}/helpful`,
      ])
      expect(await storedOf(review.id)).toMatchObject({
        helpfulCount: 1,
        voters: [KENJI.email],
      })
    })

    it('should not know on a page that is opened anew that the customer said so before, and count them once when they say it again', async () => {
      // Arrange: the API does not say who found a review helpful
      await signedInAs(KENJI.email)
      const review = await untouchedBy(KENJI.email)
      await findsHelpful(review.id, KENJI.email)
      const before = await storedOf(review.id)
      expect(before).toMatchObject({ helpfulCount: 1, voters: [KENJI.email] })
      renderAt(await salonPathOf(TOKYO))
      const listed = await reviewToActOn(review.title)
      expect(helpfulButtonIn(listed)).toHaveAttribute('aria-pressed', 'false')

      // Act
      await userEvent.click(helpfulButtonIn(listed))

      // Assert
      await screen.findByText(SAID)
      expect(helpfulButtonIn(listed)).toHaveAttribute('aria-pressed', 'true')
      expect(helpfulIn(listed)).toBe('1 人が「参考になった」と答えています')
      expect(await storedOf(review.id)).toEqual(before)
    })

    it('should leave the review where it is in the order by helpfulness, read that order again when it is next asked for, and never show another order as it was read before', async () => {
      // Arrange: two reviews that one customer each found helpful, behind
      // one that three did; the application keeps what it read
      await inTheOrderOfTheirRatings()
      await signedInAs(KENJI.email)
      const review = await untouchedBy(KENJI.email)
      await findsHelpful(review.id, VIP.email)
      renderAt(await salonPathOf(TOKYO), {
        client: asTheApplicationKeeps(),
      })
      const user = userEvent.setup()
      await reviewToActOn(review.title)
      await user.selectOptions(await order(), '参考になった順')
      await waitFor(async () => {
        expect((await titles()).at(0)).toBe('Excellent service!')
      })
      const tied = await titles()
      const [first = '', second = '', last = ''] = tied
      const fetched = vi.spyOn(globalThis, 'fetch')

      // Act: the customer finds the last of them helpful
      await user.click(helpfulButtonIn(await reviewTitled(last)))
      await screen.findByText(SAID)

      // Assert: it has more than the one before it, and stays behind it
      expect(await titles()).toEqual(tied)
      expect(helpfulIn(await reviewTitled(last))).toBe(
        '2 人が「参考になった」と答えています',
      )
      expect(helpfulIn(await reviewTitled(second))).toBe(
        '1 人が「参考になった」と答えています',
      )
      // The order on the screen is what was read before, with the count
      // the API answered: nothing is read to show it
      expect(asked(fetched).filter(ofTheReviews)).toEqual([
        expect.stringMatching(/^POST \/reviews\/[\da-f-]+\/helpful$/),
      ])
      expect(await titles()).toEqual(tied)

      // Act: another order, which the page had read before
      await user.selectOptions(await order(), '新しい順')

      // Assert
      await waitFor(async () => {
        expect(await titles()).toEqual(TOKYO_LATEST_FIRST)
      })
      expect(helpfulIn(await reviewTitled(last))).toBe(
        '2 人が「参考になった」と答えています',
      )

      // Act: the order by helpfulness again
      await user.selectOptions(await order(), '参考になった順')

      // Assert
      await waitFor(async () => {
        expect(await titles()).toEqual([first, last, second])
      })
    })

    it('should say that the review is gone when somebody removed it meanwhile, take it off the page and move the focus to the heading of the part', async () => {
      // Arrange
      await inTheOrderOfTheirRatings()
      await signedInAs(KENJI.email)
      const review = await untouchedBy(KENJI.email)
      renderAt(await salonPathOf(TOKYO))
      const listed = await reviewToActOn(review.title)
      await within(await reviewsPart()).findByRole('img', {
        name: '5 段階中 4.0（3 件）',
      })
      await removes(review.id, OPERATOR)

      // Act
      await userEvent.click(helpfulButtonIn(listed))

      // Assert
      await screen.findByText(GONE)
      expect(sectionHeading()).toHaveFocus()
      expect(await titles()).toEqual(
        TOKYO_LATEST_FIRST.filter((title) => title !== review.title),
      )
      // What counts the reviews is read again
      expect(
        await within(await reviewsPart()).findByRole('img', {
          name: '5 段階中 4.5（2 件）',
        }),
      ).toBeVisible()
    })

    it('should say that nothing was sent when the API fails, leave the review as it was, and count the customer when they press again', async () => {
      // Arrange
      await signedInAs(KENJI.email)
      const review = await untouchedBy(KENJI.email)
      renderAt(await salonPathOf(TOKYO))
      const listed = await reviewToActOn(review.title)
      await takeAway('review_helpful_votes')

      // Act
      await userEvent.click(helpfulButtonIn(listed))

      // Assert
      await screen.findByText(NOT_SENT)
      expect(helpfulButtonIn(listed)).toHaveAttribute('aria-pressed', 'false')
      expect(helpfulButtonIn(listed)).toBeEnabled()
      expect(helpfulIn(listed)).toBeNull()

      // Act
      await giveBack('review_helpful_votes')
      await userEvent.click(helpfulButtonIn(listed))

      // Assert
      await screen.findByText(SAID)
      expect(helpfulButtonIn(listed)).toHaveAttribute('aria-pressed', 'true')
      expect(await storedOf(review.id)).toMatchObject({ voters: [KENJI.email] })
    })
  })

  describe('reporting a review', () => {
    it('should ask in a dialog why, naming the review, with no reason chosen, and send nothing yet', async () => {
      // Arrange
      await signedInAs(KENJI.email)
      const review = await untouchedBy(KENJI.email)
      renderAt(await salonPathOf(TOKYO))
      const listed = await reviewToActOn(review.title)
      const fetched = vi.spyOn(globalThis, 'fetch')

      // Act
      await userEvent.click(reportButtonIn(listed))

      // Assert
      expect(dialog()).toHaveAccessibleDescription(
        `「${review.title}」（${review.posted} 投稿）のレビューを、運営に通報します。運営が内容を確かめ、規則に反するレビューは削除します。確かめが済むまで、レビューは掲載されたままです。`,
      )
      expect(
        within(dialog())
          .getAllByRole('radio')
          .filter((option) => option.matches(':checked')),
      ).toEqual([])
      expect(details()).toHaveValue('')
      expect(asked(fetched).filter(ofTheReviews)).toEqual([])
    })

    it.each([
      ['不適切な表現（暴言、差別的な表現など）', 'inappropriate'],
      ['事実と違う内容', 'false_information'],
      ['個人情報（氏名や連絡先など）', 'personal_information'],
      ['宣伝や、来店と関係のない内容', 'spam'],
    ])(
      'should report the review for the reason 「%s」, close the dialog, say so, and leave the review on the page',
      async (label, value) => {
        // Arrange
        await signedInAs(KENJI.email)
        const review = await untouchedBy(KENJI.email)
        renderAt(await salonPathOf(TOKYO))
        await askToReport(review.title)
        const fetched = vi.spyOn(globalThis, 'fetch')

        // Act
        await userEvent.click(reason(label))
        await userEvent.click(sendButton())

        // Assert
        await screen.findByText(REPORTED)
        expect(screen.queryByRole('dialog')).toBeNull()
        expect(await sent(fetched)).toEqual([{ reason: value, details: null }])
        expect(await storedOf(review.id)).toMatchObject({
          reportCount: 1,
          reports: [
            {
              by: KENJI.email,
              reason: value,
              details: null,
              status: 'pending',
            },
          ],
        })
        expect(await titles()).toContain(review.title)
        expect(asked(fetched).filter(ofTheReviews)).toEqual([
          `POST /reviews/${review.id}/report`,
        ])
      },
    )

    it('should report a review for a reason of its own with what the customer says about it, without the spaces around it', async () => {
      // Arrange
      await signedInAs(KENJI.email)
      const review = await untouchedBy(KENJI.email)
      renderAt(await salonPathOf(TOKYO))
      await askToReport(review.title)
      const fetched = vi.spyOn(globalThis, 'fetch')

      // Act
      await userEvent.click(reason('その他'))
      await userEvent.type(details(), '  ほかのサロンのことが書かれています ')
      await userEvent.click(sendButton())

      // Assert
      await screen.findByText(REPORTED)
      expect(await sent(fetched)).toEqual([
        { reason: 'other', details: 'ほかのサロンのことが書かれています' },
      ])
      expect(await storedOf(review.id)).toMatchObject({
        reports: [
          {
            by: KENJI.email,
            reason: 'other',
            details: 'ほかのサロンのことが書かれています',
            status: 'pending',
          },
        ],
      })
    })

    it('should send nothing without a reason, or for a reason of its own without a word about it, and say at the control what is missing', async () => {
      // Arrange
      await signedInAs(KENJI.email)
      const review = await untouchedBy(KENJI.email)
      renderAt(await salonPathOf(TOKYO))
      await askToReport(review.title)
      const fetched = vi.spyOn(globalThis, 'fetch')
      const reasons = within(dialog()).getByRole('radiogroup', {
        name: '通報の理由',
      })

      // Act
      await userEvent.click(sendButton())

      // Assert
      expect(reasons).toHaveAttribute('aria-invalid', 'true')
      expect(reasons).toHaveAccessibleDescription(
        '通報の理由を選んでください。',
      )
      expect(reason('不適切な表現（暴言、差別的な表現など）')).toHaveFocus()

      // Act
      await userEvent.click(reason('その他'))
      await userEvent.type(details(), '   ')
      await userEvent.click(sendButton())

      // Assert
      expect(reasons).not.toHaveAttribute('aria-invalid')
      expect(details()).toHaveAttribute('aria-invalid', 'true')
      expect(details()).toHaveAccessibleDescription(
        /「その他」を選んだときは、何が問題かを入力してください。$/,
      )
      expect(details()).toHaveFocus()
      expect(asked(fetched).filter(ofTheReviews)).toEqual([])
      expect(await storedOf(review.id)).toMatchObject({ reports: [] })
    })

    it.each<[string, () => Promise<Seen>]>([
      [
        'somewhere else, a moment ago',
        async () => {
          const review = await untouchedBy(KENJI.email)
          await reports(review.id, { reason: 'spam', details: null })

          return review
        },
      ],
      [
        'with a report that an administrator has dismissed since',
        async () => {
          const review = await untouchedBy(KENJI.email)
          await reports(review.id, { reason: 'spam', details: null })
          await dismissesReportOf(review.id)

          return review
        },
      ],
    ])(
      'should say in the dialog that the account reported the review before (%s), write nothing, leave the way out alone, and offer the form again for another review',
      async (_when, arrange) => {
        // Arrange
        await signedInAs(KENJI.email)
        const review = await arrange()
        const before = await storedOf(review.id)
        renderAt(await salonPathOf(TOKYO))
        await askToReport(review.title)

        // Act
        await userEvent.click(reason('不適切な表現（暴言、差別的な表現など）'))
        await userEvent.click(sendButton())

        // Assert
        expect(await within(dialog()).findByRole('status')).toHaveTextContent(
          REPORTED_BEFORE,
        )
        expect(within(dialog()).queryByRole('radiogroup')).toBeNull()
        expect(
          within(dialog())
            .getAllByRole('button')
            .map((button) => button.textContent),
        ).toEqual(['閉じる'])
        // The focus is on the answer, which took the place of the form
        expect(within(dialog()).getByRole('status').parentElement).toHaveFocus()
        expect(await storedOf(review.id)).toEqual(before)

        // Act
        await userEvent.click(
          within(dialog()).getByRole('button', { name: '閉じる' }),
        )

        // Assert
        expect(screen.queryByRole('dialog')).toBeNull()
        expect(await titles()).toContain(review.title)

        // Act: another review, which the account has not reported
        const [other = ''] = TOKYO_LATEST_FIRST.filter(
          (title) => title !== review.title,
        )
        await askToReport(other)

        // Assert: its form, and nothing of what was said about the last one
        expect(
          within(dialog()).getByRole('radiogroup', { name: '通報の理由' }),
        ).toBeVisible()
        expect(within(dialog()).queryByRole('status')).toBeNull()
        expect(sendButton()).toBeEnabled()
      },
    )

    it('should take the dialog away when somebody removed the review meanwhile, say so, take the review off the page and move the focus to the heading of the part', async () => {
      // Arrange
      await inTheOrderOfTheirRatings()
      await signedInAs(KENJI.email)
      const review = await untouchedBy(KENJI.email)
      renderAt(await salonPathOf(TOKYO))
      await askToReport(review.title)
      await userEvent.click(reason('事実と違う内容'))
      await removes(review.id, OPERATOR)

      // Act
      await userEvent.click(sendButton())

      // Assert
      await screen.findByText(GONE)
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(sectionHeading()).toHaveFocus()
      expect(await titles()).toEqual(
        TOKYO_LATEST_FIRST.filter((title) => title !== review.title),
      )
    })

    it('should say in the dialog that nothing was sent when the API fails, keep what was entered, and report the review when it is sent again', async () => {
      // Arrange
      await signedInAs(KENJI.email)
      const review = await untouchedBy(KENJI.email)
      renderAt(await salonPathOf(TOKYO))
      await askToReport(review.title)
      await userEvent.click(reason('その他'))
      await userEvent.type(details(), '同じ文章が何度も投稿されています')
      await takeAway('review_reports')

      // Act
      await userEvent.click(sendButton())

      // Assert
      expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
        NOT_SENT,
      )
      expect(reason('その他')).toBeChecked()
      expect(details()).toHaveValue('同じ文章が何度も投稿されています')
      expect(sendButton()).toBeEnabled()

      // Act
      await giveBack('review_reports')
      await userEvent.click(sendButton())

      // Assert
      await screen.findByText(REPORTED)
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(await storedOf(review.id)).toMatchObject({
        reports: [
          {
            by: KENJI.email,
            reason: 'other',
            details: '同じ文章が何度も投稿されています',
          },
        ],
      })
    })

    it('should send nothing when the dialog is left by its button, and open with an empty form the next time', async () => {
      // Arrange
      await signedInAs(KENJI.email)
      const review = await untouchedBy(KENJI.email)
      renderAt(await salonPathOf(TOKYO))
      await askToReport(review.title)
      const fetched = vi.spyOn(globalThis, 'fetch')
      await userEvent.click(sendButton())
      await userEvent.click(reason('宣伝や、来店と関係のない内容'))
      await userEvent.type(details(), '書きかけの内容')

      // Act
      await userEvent.click(
        within(dialog()).getByRole('button', { name: '戻る' }),
      )

      // Assert
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(asked(fetched).filter(ofTheReviews)).toEqual([])

      // Act
      await askToReport(review.title)

      // Assert
      expect(
        within(dialog())
          .getAllByRole('radio')
          .filter((option) => option.matches(':checked')),
      ).toEqual([])
      expect(details()).toHaveValue('')
      expect(
        within(dialog()).getByRole('radiogroup', { name: '通報の理由' }),
      ).not.toHaveAttribute('aria-invalid')
      expect(await storedOf(review.id)).toMatchObject({ reports: [] })
    })
  })

  describe('how the staff was rated', () => {
    const ratedSchema = z.array(
      z.object({
        name: z.string(),
        total: z.number().int(),
        average: z.number().nullable(),
      }),
    )

    /** How the reviews that rate each member of a salon add up, as the database counts them. */
    const ratingsOf = async (salon: string) =>
      ratedSchema.parse(
        await testApi().query(
          `select staff."displayName" as name, count(reviews.id)::int as total,
                  round(avg(reviews."overallRating"), 2)::float8 as average
           from staff
           join salons on salons.id = staff."salonId"
           left join reviews on reviews."staffId" = staff.id
           where salons.name = $1 and staff."deletedAt" is null
           group by staff."displayName"
           order by staff."displayName"`,
          [salon],
        ),
      )

    /** What the page says of how a member was rated. */
    const ratingShownOf = async (name: string): Promise<string | null> => {
      const person = await personNamed(name)

      return (
        within(person).queryByRole('img')?.getAttribute('aria-label') ??
        within(person).queryByText(NOT_RATED)?.textContent ??
        null
      )
    }

    it('should show of each member how the reviews that rate them add up, and say of the others that they have none yet', async () => {
      // Arrange: two reviews rate one member, and none another
      await testApi().query(
        `update reviews set "staffId" = (select id from staff where "displayName" = $1)
         where title = 'Satisfied with the result'`,
        [HIROSHI],
      )
      const stored = await ratingsOf(TOKYO)

      // Act
      renderAt(await salonPathOf(TOKYO))

      // Assert
      await within(await personNamed(HIROSHI)).findByRole('img')
      expect(
        Object.fromEntries(
          await Promise.all(
            stored.map(
              async ({ name }) => [name, await ratingShownOf(name)] as const,
            ),
          ),
        ),
      ).toEqual(
        Object.fromEntries(
          stored.map(({ name, total, average }) => [
            name,
            average === null
              ? NOT_RATED
              : `5 段階中 ${average.toFixed(1)}（${total} 件）`,
          ]),
        ),
      )
      expect(await ratingShownOf(HIROSHI)).toBe('5 段階中 4.5（2 件）')
      expect(await ratingShownOf('Mika Suzuki')).toBe(NOT_RATED)
      expect(await ratingShownOf('Yui Watanabe')).toBe('5 段階中 3.0（1 件）')
    })

    it('should show the people when their ratings cannot be read, say so, and show the ratings when asked again', async () => {
      // Arrange
      await takeAway('reviews')
      renderAt(await salonPathOf(TOKYO))
      const staff = await region('スタッフ')

      // Assert
      expect(
        await within(staff).findByText(
          'スタッフの評価を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
        ),
      ).toBeVisible()
      expect(await ratingShownOf(HIROSHI)).toBeNull()
      expect(within(staff).getAllByRole('heading', { level: 3 })).toHaveLength(
        5,
      )

      // Act
      await giveBack('reviews')
      await userEvent.click(
        within(staff).getByRole('button', { name: 'もう一度読み込む' }),
      )

      // Assert
      await within(await personNamed(HIROSHI)).findByRole('img')
      expect(await ratingShownOf(HIROSHI)).toBe('5 段階中 5.0（1 件）')
      expect(within(staff).queryByRole('button')).toBeNull()
    })

    it('should show the rating of a member as it is after a customer wrote a review that rates them, and not as it was read before', async () => {
      // Arrange: the application keeps what it read; the page of the salon is read, and left
      await signedInAs(KENJI.email)
      const visit = await visitToReview()
      const path = await salonPathOf(OSAKA)
      const client = asTheApplicationKeeps()
      const salonPage = renderAt(path, { client })
      await within(await personNamed(TAKESHI)).findByRole('img')
      expect(await ratingShownOf(TAKESHI)).toBe('5 段階中 5.0（2 件）')
      salonPage.unmount()

      // Act: the customer writes about a visit to that member
      const form = renderAt(`/bookings/${visit.id}/review`, { client })
      await overall()
      await userEvent.click(ratingOf('2（やや不満）'))
      await userEvent.click(
        screen.getByRole('button', { name: 'レビューを投稿する' }),
      )
      await screen.findByText('レビューを投稿しました。')
      form.unmount()
      renderAt(path, { client })

      // Assert
      expect(
        await within(await personNamed(TAKESHI)).findByRole('img', {
          name: '5 段階中 4.0（3 件）',
        }),
      ).toBeVisible()
    })
  })

  describe('accessibility', () => {
    it('should have no accessibility violations with the buttons of a customer, and with the dialog open', async () => {
      // Arrange
      await signedInAs(KENJI.email)
      const review = await untouchedBy(KENJI.email)
      renderAt(await salonPathOf(TOKYO))
      await within(await personNamed(HIROSHI)).findByRole('img')
      const listed = await reviewToActOn(review.title)
      await userEvent.click(helpfulButtonIn(listed))
      await screen.findByText(SAID)

      // Act
      const onThePage = await findAccessibilityViolations()
      await userEvent.click(reportButtonIn(listed))
      await userEvent.click(sendButton())
      const inTheDialog = await findAccessibilityViolations()

      // Assert
      expect(onThePage).toEqual([])
      expect(inTheDialog).toEqual([])
    })

    it('should have no accessibility violations for somebody who is not signed in', async () => {
      // Arrange
      renderAt(await salonPathOf(TOKYO))
      await within(await personNamed(HIROSHI)).findByRole('img')
      await reviewList()

      // Act
      const violations = await findAccessibilityViolations()

      // Assert
      expect(violations).toEqual([])
    })
  })
})

describe('reporting a review on a page in English, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  const reporting = () =>
    screen.getByRole('dialog', { name: 'Report the review' })

  /** The review of a title, once the page knows that a customer reads: it has its buttons. */
  const reviewInEnglish = async (title: string): Promise<HTMLElement> => {
    const list = await within(await region('Reviews')).findByRole('list', {
      name: 'Reviews',
    })
    await within(list).findAllByRole('button', { name: /^Helpful: / })
    const found = within(list)
      .getAllByRole('listitem')
      .find((review) => within(review).queryByText(title) !== null)
    if (found === undefined) {
      throw new Error(`No review is titled ${title}`)
    }

    return found
  }

  it('should ask in English why, naming the review, say that a reason is missing, and report the review', async () => {
    // Arrange
    await signedInAs(KENJI.email)
    const review = await untouchedBy(KENJI.email)
    renderAt(await salonPathOf(TOKYO))
    const subject = `“${review.title}” (posted ${dayInEnglish(review.postedOn)})`
    const user = userEvent.setup()

    // Act
    await user.click(
      within(await reviewInEnglish(review.title)).getByRole('button', {
        name: `Report the review ${subject}`,
      }),
    )

    // Assert
    expect(reporting()).toHaveAccessibleDescription(
      `This reports the review ${subject} to the team that runs the site. The team checks it, and deletes a review that breaks the rules. Until then, the review stays listed.`,
    )

    // Act
    await user.click(
      within(reporting()).getByRole('button', { name: 'Report' }),
    )

    // Assert
    expect(
      within(reporting()).getByRole('radiogroup', {
        name: 'Reason for the report',
      }),
    ).toHaveAccessibleDescription('Choose the reason for the report.')

    // Act
    await user.click(
      within(reporting()).getByRole('radio', {
        name: 'Something that is not true',
      }),
    )
    await user.click(
      within(reporting()).getByRole('button', { name: 'Report' }),
    )

    // Assert
    expect(
      await screen.findByText(
        'You reported the review. The team that runs the site will check it, and the review stays listed until then.',
      ),
    ).toBeVisible()
    expect(await storedOf(review.id)).toMatchObject({
      reports: [{ by: KENJI.email, reason: 'false_information' }],
    })
  })
})
