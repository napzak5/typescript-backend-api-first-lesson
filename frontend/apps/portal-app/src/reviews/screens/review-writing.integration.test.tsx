import { languageStore } from '@beauty-salon-frontend/io'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { asked } from '@beauty-salon-frontend/testing/answers'
import { giveBack, takeAway } from '@beauty-salon-frontend/testing/api'
import {
  address,
  asTheApplicationKeeps,
  firstSight,
  heading,
  optionsOf,
  statusMessages,
} from '@beauty-salon-frontend/testing/screens'
import {
  CUSTOMER,
  KENJI,
  OSAKA,
  VIP,
} from '@beauty-salon-frontend/testing/seed'
import { focusManager, onlineManager } from '@tanstack/react-query'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderAt } from '../../__tests__/screens'
import { NOTHING, signedInAs } from '../../bookings/__tests__/arrangements'
import {
  answers,
  bookingToCome,
  button,
  detailsIn,
  overall,
  paragraphsIn,
  ratingOf,
  region,
  removes,
  reviewCountOf,
  salonIsRemoved,
  select,
  selects,
  staffIsRemoved,
  storedReviewOf,
  TAKESHI,
  text,
  visitReviewed,
  visitToReview,
  WRITTEN,
  whenOf,
  writes,
} from '../__tests__/arrangements'

/*
 * A customer writes about a visit: from the page of its booking, on the
 * screen of the form. What a test starts from is written as a customer or
 * a salon writes it, through the API.
 *
 * Not met here: the API limiting the requests, and a value of the form
 * that the API refuses although the form took it (the form sends nothing
 * of the kind, but for a member of the staff who was removed meanwhile).
 * They are in `review-flow.test.ts` and `reviews-api.test.ts`.
 */

const TITLE = 'レビューを書く'

const NOT_WRITTEN = 'この来店のレビューは、まだ書かれていません。'
const NOT_SENT =
  '送信できませんでした。通信の状態を確かめて、もう一度お試しください。'
const STAFF_GONE =
  'このスタッフは、選べなくなりました。ほかのスタッフか、「スタッフを評価しない」を選んでください。'

const PICTURE = 'https://images.example.com/reviews/after.jpg'

const sendButton = () => button('レビューを投稿する')

const writePathOf = (bookingId: string): string =>
  `/bookings/${bookingId}/review`

/** How a result of the search says its salon is rated: the picture of the stars, named with the count. */
const ratingInResultOf = async (salon: string): Promise<HTMLElement> => {
  const link = await screen.findByRole('link', { name: salon })

  return within(link.closest('li') ?? document.body).getByRole('img')
}

/** A line of what was asked that is about the reviews: the screen asks for more than them. */
const ofTheReviews = (line: string): boolean => line.includes(' /reviews')

describe('the review of a visit, against the API', () => {
  beforeEach(async () => {
    await signedInAs(KENJI.email)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    focusManager.setFocused(undefined)
    onlineManager.setOnline(true)
  })

  describe('the page of a booking', () => {
    it('should say of a visit nobody has written about that it has no review, and lead to the form', async () => {
      // Arrange
      const visit = await visitToReview()

      // Act
      renderAt(`/bookings/${visit.id}`)

      // Assert
      const part = await region('レビュー')
      expect(await within(part).findByText(NOT_WRITTEN)).toBeVisible()
      expect(
        within(part).getByRole('link', { name: 'レビューを書く' }),
      ).toHaveAttribute('href', writePathOf(visit.id))
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should show what the customer wrote about a visit, as the page of the salon shows it, with the way to change it', async () => {
      // Arrange
      const visit = await visitReviewed()

      // Act
      renderAt(`/bookings/${visit.id}`)

      // Assert
      const part = await region('レビュー')
      expect(await within(part).findByText(WRITTEN.title)).toBeVisible()
      expect(within(part).getByText(WRITTEN.comment)).toBeVisible()
      expect(
        within(part).getByRole('img', { name: '5 段階中 5.0' }),
      ).toBeInTheDocument()
      expect(
        within(part).getByRole('link', { name: 'レビューを変更する' }),
      ).toHaveAttribute('href', `/mypage/reviews/${visit.reviewId}`)
      expect(
        within(part).queryByRole('link', { name: 'レビューを書く' }),
      ).toBeNull()
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should say nothing of a review on the page of a booking that is no visit that took place', async () => {
      // Arrange
      const id = await bookingToCome(KENJI.email)

      // Act
      renderAt(`/bookings/${id}`)

      // Assert: the booking is there, with what can be done with it
      expect(
        await screen.findByRole('button', { name: '予約をキャンセルする' }),
      ).toBeEnabled()
      expect(screen.queryByRole('region', { name: 'レビュー' })).toBeNull()
    })

    it('should say in its place that the review could not be read, show the booking all the same, and read again when asked', async () => {
      // Arrange
      const visit = await visitToReview()
      await takeAway('reviews')

      // Act
      renderAt(`/bookings/${visit.id}`)

      // Assert
      const part = await region('レビュー')
      expect(await within(part).findByRole('alert')).toHaveTextContent(
        'レビューを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(
        detailsIn(
          screen.getByRole('region', {
            name: `予約番号 ${visit.bookingNumber}`,
          }),
        ),
      ).toMatchObject({ サロン: OSAKA })

      // Act
      await giveBack('reviews')
      await userEvent.click(
        within(part).getByRole('button', { name: 'もう一度読み込む' }),
      )

      // Assert
      expect(await within(part).findByText(NOT_WRITTEN)).toBeVisible()
    })

    it('should say that nobody writes about a salon that is no longer shown, and lead to no form', async () => {
      // Arrange
      const visit = await visitToReview()
      await salonIsRemoved(OSAKA)
      const fetched = vi.spyOn(globalThis, 'fetch')

      // Act
      renderAt(`/bookings/${visit.id}`)

      // Assert
      const part = await region('レビュー')
      expect(paragraphsIn(part)).toEqual([
        '掲載を終えたサロンのレビューは、書けません。',
      ])
      expect(within(part).queryByRole('link')).toBeNull()
      // The API gives no review of such a salon: the part asks for none
      expect(asked(fetched).filter(ofTheReviews)).toEqual([])
    })

    it('should show the review as it is now whenever the page is shown: with what the salon answered meanwhile', async () => {
      // Arrange: the application keeps what it read; the page is read, and left
      await signedInAs(VIP.email)
      const visit = await visitReviewed(VIP.email)
      const client = asTheApplicationKeeps()
      const { unmount } = renderAt(`/bookings/${visit.id}`, { client })
      await within(await region('レビュー')).findByText(
        'Satisfied with the result',
      )
      unmount()

      // Act
      await answers(visit.reviewId, 'またのご来店をお待ちしています。')
      renderAt(`/bookings/${visit.id}`, { client })

      // Assert
      expect(
        await within(await region('レビュー')).findByText(
          'またのご来店をお待ちしています。',
        ),
      ).toBeVisible()
    })
  })

  describe('the form', () => {
    it('should open with the visit it is about, and with nothing chosen but the member of the staff the booking was with', async () => {
      // Arrange
      const visit = await visitToReview()

      // Act
      renderAt(writePathOf(visit.id))

      // Assert
      const group = await overall()
      expect(await heading(TITLE)).toBeVisible()
      const about = screen.getByRole('region', { name: 'レビューする来店' })
      expect(detailsIn(about)).toEqual({
        サロン: OSAKA,
        来店日時: whenOf(visit),
      })
      expect(within(about).getByRole('link', { name: OSAKA })).toHaveAttribute(
        'href',
        `/salons/${visit.salonId}`,
      )
      expect(within(group).queryByRole('radio', { checked: true })).toBeNull()
      expect(select('評価するスタッフ')).toHaveValue(visit.staffId)
      expect(optionsOf(select('評価するスタッフ'))).toEqual([
        'スタッフを評価しない',
        TAKESHI,
      ])
      expect(selects()).toEqual([
        'staffId',
        'serviceRating',
        'staffRating',
        'atmosphereRating',
        'cleanlinessRating',
        'valueRating',
      ])
      expect(
        screen.getByRole('link', { name: '予約の内容へ戻る' }),
      ).toHaveAttribute('href', `/bookings/${visit.id}`)
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should write the review of the visit with everything the form holds, say so, and show it among what the customer wrote', async () => {
      // Arrange
      const visit = await visitToReview()
      renderAt(writePathOf(visit.id))
      const user = userEvent.setup()
      await overall()

      // Act
      await user.click(ratingOf('4（満足）'))
      await user.selectOptions(select('サービス'), '5')
      await user.selectOptions(select('スタッフ'), '3')
      await user.selectOptions(select('価格'), '2')
      await user.type(text('タイトル'), '  また行きます  ')
      await user.type(
        text('本文'),
        '丁寧でした。{Enter}待ち時間もありませんでした。',
      )
      await user.type(text('写真の URL'), `${PICTURE}{Enter}{Enter}${PICTURE}`)
      await user.click(sendButton())

      // Assert
      expect(await heading('自分のレビュー')).toHaveFocus()
      expect(address()).toBe('/mypage/reviews')
      expect(statusMessages()).toContain('レビューを投稿しました。')
      const list = await screen.findByRole('list', { name: '自分のレビュー' })
      expect(
        within(list)
          .getAllByRole('heading', { level: 2 })
          .map((salon) => salon.textContent),
      ).toEqual([OSAKA, OSAKA])
      expect(within(list).getByText('また行きます')).toBeVisible()
      expect(await storedReviewOf(visit.id)).toMatchObject({
        customer: KENJI.email,
        salon: OSAKA,
        staff: TAKESHI,
        overallRating: 4,
        serviceRating: 5,
        staffRating: 3,
        atmosphereRating: null,
        cleanlinessRating: null,
        valueRating: 2,
        title: 'また行きます',
        comment: '丁寧でした。\n待ち時間もありませんでした。',
        imageUrls: [PICTURE],
        ownerResponse: null,
      })
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should write a review that holds its rating alone', async () => {
      // Arrange
      const visit = await visitToReview()
      renderAt(writePathOf(visit.id))
      await overall()

      // Act
      await userEvent.click(ratingOf('1（不満）'))
      await userEvent.click(sendButton())

      // Assert
      await screen.findByText('レビューを投稿しました。')
      expect(await storedReviewOf(visit.id)).toMatchObject({
        staff: TAKESHI,
        overallRating: 1,
        serviceRating: null,
        staffRating: null,
        atmosphereRating: null,
        cleanlinessRating: null,
        valueRating: null,
        title: null,
        comment: null,
        imageUrls: [],
      })
    })

    it('should have no rating of the staff once nobody is rated, and write a review that rates nobody', async () => {
      // Arrange
      const visit = await visitToReview()
      renderAt(writePathOf(visit.id))
      const user = userEvent.setup()
      await overall()
      await user.selectOptions(select('スタッフ'), '5')

      // Act
      await user.selectOptions(
        select('評価するスタッフ'),
        'スタッフを評価しない',
      )

      // Assert
      expect(selects()).toEqual([
        'staffId',
        'serviceRating',
        'atmosphereRating',
        'cleanlinessRating',
        'valueRating',
      ])

      // Act
      await user.click(ratingOf('5（とても満足）'))
      await user.click(sendButton())

      // Assert
      await screen.findByText('レビューを投稿しました。')
      expect(await storedReviewOf(visit.id)).toMatchObject({
        staff: null,
        overallRating: 5,
        staffRating: null,
      })
    })

    it('should ask for no member of the staff when the salon shows none of those who took the booking, say why, and write a review that rates nobody', async () => {
      // Arrange: the member the booking was with has left the page of the salon
      const visit = await visitToReview()
      await staffIsRemoved(TAKESHI)
      renderAt(writePathOf(visit.id))
      const user = userEvent.setup()

      // Act
      await overall()

      // Assert: neither whom to rate nor how the staff was is asked
      expect(
        screen.getByText(
          'この来店を担当したスタッフは、いまサロンのページに掲載されていないため、スタッフの評価はできません。',
        ),
      ).toBeVisible()
      expect(selects()).toEqual([
        'serviceRating',
        'atmosphereRating',
        'cleanlinessRating',
        'valueRating',
      ])
      expect(await findAccessibilityViolations()).toEqual([])

      // Act
      await user.click(ratingOf('4（満足）'))
      await user.click(sendButton())

      // Assert
      await screen.findByText('レビューを投稿しました。')
      expect(await storedReviewOf(visit.id)).toMatchObject({
        staff: null,
        overallRating: 4,
        staffRating: null,
      })
    })

    it('should offer everybody who took the booking, the member it was with first, and write the review of the one who is chosen', async () => {
      // Arrange: a visit that two members of the staff took, written about again
      await signedInAs(VIP.email)
      const visit = await visitReviewed(VIP.email)
      await removes(visit.reviewId, VIP.email)
      renderAt(writePathOf(visit.id))
      const user = userEvent.setup()
      await overall()

      // Assert
      expect(select('評価するスタッフ')).toHaveValue(visit.staffId)
      expect(optionsOf(select('評価するスタッフ'))).toEqual([
        'スタッフを評価しない',
        'Mika Suzuki',
        'Hiroshi Tanaka',
      ])

      // Act
      await user.selectOptions(select('評価するスタッフ'), 'Hiroshi Tanaka')
      await user.selectOptions(select('スタッフ'), '5')
      await user.click(ratingOf('4（満足）'))
      await user.click(sendButton())

      // Assert
      await screen.findByText('レビューを投稿しました。')
      expect(await storedReviewOf(visit.id)).toMatchObject({
        customer: VIP.email,
        staff: 'Hiroshi Tanaka',
        overallRating: 4,
        staffRating: 5,
      })
    })

    it('should not send a review without its rating: it says so at the rating, where the focus goes', async () => {
      // Arrange
      const visit = await visitToReview()
      renderAt(writePathOf(visit.id))
      const user = userEvent.setup()
      const group = await overall()
      await user.type(text('タイトル'), 'また行きます')
      const fetched = vi.spyOn(globalThis, 'fetch')

      // Act
      await user.click(sendButton())

      // Assert
      expect(group).toHaveAccessibleDescription('総合の評価を選んでください。')
      expect(ratingOf('5（とても満足）')).toHaveFocus()
      expect(asked(fetched).filter(ofTheReviews)).toEqual([])
      expect(text('タイトル')).toHaveValue('また行きます')
      expect(address()).toBe(writePathOf(visit.id))
      expect(await storedReviewOf(visit.id)).toBeNull()
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should not send a picture whose address is none of the web, and name its line', async () => {
      // Arrange
      const visit = await visitToReview()
      renderAt(writePathOf(visit.id))
      const user = userEvent.setup()
      await overall()
      await user.click(ratingOf('4（満足）'))
      await user.type(text('写真の URL'), `${PICTURE}{Enter}after.jpg`)

      // Act
      await user.click(sendButton())

      // Assert
      expect(text('写真の URL')).toHaveAccessibleDescription(
        expect.stringContaining(
          '2 行目を確かめてください。http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
        ),
      )
      expect(text('写真の URL')).toHaveFocus()
      expect(await storedReviewOf(visit.id)).toBeNull()
    })
  })

  describe('a visit that cannot be written about', () => {
    it('should say that the visit has its review, and lead to the form that changes it', async () => {
      // Arrange
      const visit = await visitReviewed()

      // Act
      renderAt(writePathOf(visit.id))

      // Assert
      expect(
        await screen.findByText('この来店のレビューは、投稿済みです'),
      ).toBeVisible()
      expect(
        screen.getByRole('link', { name: 'レビューを変更する' }),
      ).toHaveAttribute('href', `/mypage/reviews/${visit.reviewId}`)
      expect(
        screen.queryByRole('button', { name: 'レビューを投稿する' }),
      ).toBeNull()
      expect(await heading(TITLE)).toBeVisible()
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should say that a booking whose day has not come is no visit to write about, and lead to the booking', async () => {
      // Arrange
      const id = await bookingToCome(KENJI.email)

      // Act
      renderAt(writePathOf(id))

      // Assert
      expect(
        await screen.findByText('この予約は、まだ来店が済んでいません'),
      ).toBeVisible()
      expect(
        screen.getByRole('link', { name: '予約の内容を見る' }),
      ).toHaveAttribute('href', `/bookings/${id}`)
      expect(
        screen.queryByRole('button', { name: 'レビューを投稿する' }),
      ).toBeNull()
    })

    it('should find no booking of another customer', async () => {
      // Arrange
      const visit = await visitReviewed(CUSTOMER)

      // Act
      renderAt(writePathOf(visit.id))

      // Assert
      expect(await screen.findByText('予約が見つかりません')).toBeVisible()
      expect(
        screen.getByRole('link', { name: 'これまでの予約を見る' }),
      ).toHaveAttribute('href', '/bookings?when=past')
      expect(
        screen.queryByRole('button', { name: 'レビューを投稿する' }),
      ).toBeNull()
    })

    it.each([
      ['names nothing', NOTHING],
      ['is no ID', 'first'],
    ])('should find no booking for an address that %s', async (_case, id) => {
      // Act
      renderAt(writePathOf(id))

      // Assert
      expect(await screen.findByText('予約が見つかりません')).toBeVisible()
      expect(await heading(TITLE)).toBeVisible()
    })

    it('should say that a salon that is no longer shown is written about no more', async () => {
      // Arrange
      const visit = await visitToReview()
      await salonIsRemoved(OSAKA)

      // Act
      renderAt(writePathOf(visit.id))

      // Assert
      expect(
        await screen.findByText('このサロンは、掲載を終えています'),
      ).toBeVisible()
      expect(
        screen.getByText('掲載を終えたサロンのレビューは、書けません。'),
      ).toBeVisible()
      expect(
        screen.queryByRole('button', { name: 'レビューを投稿する' }),
      ).toBeNull()
    })

    it('should say that the visit could not be read, and open the form when it is read again', async () => {
      // Arrange
      const visit = await visitToReview()
      await takeAway('reviews')

      // Act
      renderAt(writePathOf(visit.id))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        '来店の内容を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(
        screen.queryByRole('button', { name: 'レビューを投稿する' }),
      ).toBeNull()

      // Act
      await giveBack('reviews')
      await userEvent.click(button('もう一度読み込む'))

      // Assert
      expect(await overall()).toBeVisible()
      expect(select('評価するスタッフ')).toHaveValue(visit.staffId)
    })
  })

  describe('what happens while the form is open', () => {
    it('should say that the review was not written when the visit got its review meanwhile, show what the visit is now, and move the focus to the heading', async () => {
      // Arrange
      const visit = await visitToReview()
      renderAt(writePathOf(visit.id))
      const user = userEvent.setup()
      await overall()
      await user.click(ratingOf('2（やや不満）'))
      await user.type(text('タイトル'), 'この画面で書いたレビュー')
      const elsewhere = await writes(visit, {
        title: 'ほかの画面で書いたレビュー',
      })

      // Act
      await user.click(sendButton())

      // Assert
      expect(
        await screen.findByText('この来店のレビューは、投稿済みです'),
      ).toBeVisible()
      expect(await heading(TITLE)).toHaveFocus()
      expect(statusMessages()).toContain(
        'このレビューは、投稿できませんでした。',
      )
      expect(
        screen.getByRole('link', { name: 'レビューを変更する' }),
      ).toHaveAttribute('href', `/mypage/reviews/${elsewhere}`)
      expect(await storedReviewOf(visit.id)).toMatchObject({
        id: elsewhere,
        overallRating: 4,
        title: 'ほかの画面で書いたレビュー',
      })
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should say at the staff that the member can be chosen no more when the salon removed them meanwhile, and write the review once nobody is rated', async () => {
      // Arrange
      const visit = await visitToReview()
      renderAt(writePathOf(visit.id))
      const user = userEvent.setup()
      await overall()
      await user.click(ratingOf('3（ふつう）'))
      await user.type(text('本文'), '担当の方が辞められたと聞きました。')
      await staffIsRemoved(TAKESHI)

      // Act
      await user.click(sendButton())

      // Assert
      await waitFor(() =>
        expect(select('評価するスタッフ')).toHaveAccessibleDescription(
          expect.stringContaining(STAFF_GONE),
        ),
      )
      expect(select('評価するスタッフ')).toHaveFocus()
      expect(text('本文')).toHaveValue('担当の方が辞められたと聞きました。')
      expect(await storedReviewOf(visit.id)).toBeNull()

      // Act
      await user.selectOptions(
        select('評価するスタッフ'),
        'スタッフを評価しない',
      )
      await user.click(sendButton())

      // Assert
      await screen.findByText('レビューを投稿しました。')
      expect(await storedReviewOf(visit.id)).toMatchObject({
        staff: null,
        overallRating: 3,
        comment: '担当の方が辞められたと聞きました。',
      })
    })

    it('should say in the form that nothing was sent when the API fails, keep what was written, and write it when it is sent again', async () => {
      // Arrange
      const visit = await visitToReview()
      renderAt(writePathOf(visit.id))
      const user = userEvent.setup()
      await overall()
      await user.click(ratingOf('4（満足）'))
      await user.type(text('タイトル'), 'また行きます')
      await takeAway('reviews')

      // Act
      await user.click(sendButton())

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(NOT_SENT)
      expect(text('タイトル')).toHaveValue('また行きます')
      expect(ratingOf('4（満足）')).toBeChecked()
      expect(address()).toBe(writePathOf(visit.id))

      // Act
      await giveBack('reviews')
      await user.click(sendButton())

      // Assert
      await screen.findByText('レビューを投稿しました。')
      expect(await storedReviewOf(visit.id)).toMatchObject({
        overallRating: 4,
        title: 'また行きます',
      })
    })

    it('should read nothing behind the form: not when the window gets the focus again, not when the network comes back', async () => {
      // Arrange
      const visit = await visitToReview()
      renderAt(writePathOf(visit.id))
      const user = userEvent.setup()
      await overall()
      await user.click(ratingOf('4（満足）'))
      await user.type(text('本文'), '書きかけのレビュー')
      // A read behind the form would fail, and put its notice in the place of the form
      await takeAway('reviews')
      const fetched = vi.spyOn(globalThis, 'fetch')

      // Act
      focusManager.setFocused(false)
      focusManager.setFocused(true)
      onlineManager.setOnline(false)
      onlineManager.setOnline(true)
      await user.click(sendButton())

      // Assert: by the time the failure of the form is said, a read that
      // the focus or the network started would have been asked for
      expect(await screen.findByRole('alert')).toHaveTextContent(NOT_SENT)
      expect(asked(fetched).filter(ofTheReviews)).toEqual(['POST /reviews'])
      expect(text('本文')).toHaveValue('書きかけのレビュー')
    })
  })

  describe('what the application kept', () => {
    it('should show the list of what the customer wrote as it is after the review was written, and never as it was read before', async () => {
      // Arrange: the list is read, and then the customer goes to a visit
      const visit = await visitToReview()
      renderAt('/mypage/reviews', { client: asTheApplicationKeeps() })
      const user = userEvent.setup()
      await within(
        await screen.findByRole('list', { name: '自分のレビュー' }),
      ).findByText(WRITTEN.title)
      await user.click(screen.getByRole('link', { name: '予約の一覧' }))
      await user.click(
        await screen.findByRole('link', { name: 'これまでの予約' }),
      )
      await user.click(await screen.findByRole('link', { name: whenOf(visit) }))
      await user.click(
        await screen.findByRole('link', { name: 'レビューを書く' }),
      )
      await overall()
      await user.click(ratingOf('2（やや不満）'))
      await user.type(text('タイトル'), '二度目の来店')

      // Act
      await user.click(sendButton())

      // Assert: the commit that shows the list again holds no list
      const list = await screen.findByRole('list', { name: '自分のレビュー' })
      expect(firstSight()).toEqual([
        '/mypage/reviews',
        expect.stringContaining('レビューを読み込んでいます'),
      ])
      expect(firstSight().at(1)).not.toContain(WRITTEN.title)
      expect(
        within(list)
          .getAllByRole('paragraph')
          .map((paragraph) => paragraph.textContent)
          .filter((said) => said === '二度目の来店' || said === WRITTEN.title),
      ).toEqual(['二度目の来店', WRITTEN.title])
    })

    it('should show the review on the page of its booking the moment the page is shown again, without reading it', async () => {
      // Arrange: the page of the visit is read, and says that it has no review
      const visit = await visitToReview()
      renderAt(`/bookings/${visit.id}`, { client: asTheApplicationKeeps() })
      const user = userEvent.setup()
      await within(await region('レビュー')).findByText(NOT_WRITTEN)
      await user.click(screen.getByRole('link', { name: 'レビューを書く' }))
      await overall()
      await user.click(ratingOf('5（とても満足）'))
      await user.type(text('タイトル'), '今回も満足です')
      await user.click(sendButton())
      await screen.findByText('レビューを投稿しました。')

      // Act
      await user.click(screen.getByRole('link', { name: '予約の一覧' }))
      await user.click(
        await screen.findByRole('link', { name: 'これまでの予約' }),
      )
      await user.click(await screen.findByRole('link', { name: whenOf(visit) }))

      // Assert
      await region('レビュー')
      expect(firstSight()).toEqual([
        `/bookings/${visit.id}`,
        expect.stringContaining('今回も満足です'),
      ])
      expect(firstSight().at(1)).not.toContain(NOT_WRITTEN)
    })

    it('should count the review on the page of the salon the moment the page is shown again', async () => {
      // Arrange: the page of the salon is read, with the reviews it has
      const visit = await visitToReview()
      const countedBefore = await reviewCountOf(OSAKA)
      renderAt(`/salons/${visit.salonId}`, { client: asTheApplicationKeeps() })
      const user = userEvent.setup()
      const before = await within(await region('レビュー')).findByRole('list', {
        name: 'レビュー',
      })
      const counted = within(before).getAllByRole('listitem').length
      // The salon is public: the links of the header come with the user
      await user.click(await screen.findByRole('link', { name: '予約の一覧' }))
      await user.click(
        await screen.findByRole('link', { name: 'これまでの予約' }),
      )
      await user.click(await screen.findByRole('link', { name: whenOf(visit) }))
      await user.click(
        await screen.findByRole('link', { name: 'レビューを書く' }),
      )
      await overall()
      await user.click(ratingOf('5（とても満足）'))
      await user.type(text('タイトル'), '今回も満足です')
      await user.type(text('写真の URL'), PICTURE)
      await user.click(sendButton())
      await screen.findByText('レビューを投稿しました。')

      // Act: from the list of what the customer wrote to the salon of the review
      const list = await screen.findByRole('list', { name: '自分のレビュー' })
      await user.click(
        within(list).getAllByRole('link', { name: OSAKA }).at(0) ??
          document.body,
      )

      // Assert: nothing of what was read before is shown first
      const reviews = await within(await region('レビュー')).findByRole(
        'list',
        { name: 'レビュー' },
      )
      expect(firstSight()).toEqual([
        `/salons/${visit.salonId}`,
        expect.stringContaining('サロンを読み込んでいます'),
      ])
      expect(firstSight().at(1)).not.toContain(WRITTEN.title)
      // The salon is rated by one review more
      expect(await reviewCountOf(OSAKA)).toBe(countedBefore + 1)
      expect(
        await within(await region('レビュー')).findByRole('img', {
          name: new RegExp(`（${countedBefore + 1} 件）$`),
        }),
      ).toBeInTheDocument()
      const listed = within(reviews)
        .getAllByRole('listitem')
        .filter((item) => item.parentElement === reviews)
      expect(listed).toHaveLength(counted + 1)
      // The latest review is the first, with its picture as a link
      expect(
        within(listed.at(0) ?? document.body).getByText('今回も満足です'),
      ).toBeVisible()
      expect(
        within(listed.at(0) ?? document.body).getByRole('link', {
          name: PICTURE,
        }),
      ).toHaveAttribute('rel', 'noreferrer nofollow ugc')
    })

    it('should look for the salons anew after a review was written: a result says how its salon is rated now', async () => {
      // Arrange: the salons are looked for, and found with their ratings
      const visit = await visitToReview()
      const countedBefore = await reviewCountOf(OSAKA)
      renderAt('/', { client: asTheApplicationKeeps() })
      const user = userEvent.setup()
      expect(await ratingInResultOf(OSAKA)).toHaveAccessibleName(
        expect.stringContaining(`（${countedBefore} 件）`),
      )
      // The search is public: the links of the header come with the user
      await user.click(await screen.findByRole('link', { name: '予約の一覧' }))
      await user.click(
        await screen.findByRole('link', { name: 'これまでの予約' }),
      )
      await user.click(await screen.findByRole('link', { name: whenOf(visit) }))
      await user.click(
        await screen.findByRole('link', { name: 'レビューを書く' }),
      )
      await overall()
      await user.click(ratingOf('1（不満）'))
      await user.click(sendButton())
      await screen.findByText('レビューを投稿しました。')

      // Act
      await user.click(screen.getByRole('link', { name: 'サロンを探す' }))

      // Assert: the commit that shows the search again holds no result
      const rating = await ratingInResultOf(OSAKA)
      expect(firstSight()).toEqual([
        '/',
        expect.stringContaining('サロンを探しています'),
      ])
      expect(firstSight().at(1)).not.toContain(OSAKA)
      expect(rating).toHaveAccessibleName(
        expect.stringContaining(`（${countedBefore + 1} 件）`),
      )
    })

    it('should open the form with the visit as it is now, not as the form held it before', async () => {
      // Arrange: the form is opened, and left for the page of the booking
      const visit = await visitToReview()
      const client = asTheApplicationKeeps()
      renderAt(`/bookings/${visit.id}`, { client })
      const user = userEvent.setup()
      await user.click(
        await screen.findByRole('link', { name: 'レビューを書く' }),
      )
      await overall()
      await user.click(screen.getByRole('link', { name: '予約の内容へ戻る' }))
      await within(await region('レビュー')).findByText(NOT_WRITTEN)
      // The page has read what it reads whenever it is shown: it still
      // offers to write, and does so after the review is written elsewhere
      await waitFor(() => expect(client.isFetching()).toBe(0))
      const elsewhere = await writes(visit)

      // Act
      await user.click(screen.getByRole('link', { name: 'レビューを書く' }))

      // Assert: the commit that shows the screen again holds no form
      expect(
        await screen.findByText('この来店のレビューは、投稿済みです'),
      ).toBeVisible()
      expect(firstSight()).toEqual([
        writePathOf(visit.id),
        expect.stringContaining('来店の内容を読み込んでいます'),
      ])
      expect(
        screen.getByRole('link', { name: 'レビューを変更する' }),
      ).toHaveAttribute('href', `/mypage/reviews/${elsewhere}`)
    })
  })
})

describe('the review of a visit on a page in English, against the API', () => {
  beforeEach(async () => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
    await signedInAs(KENJI.email)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    localStorage.clear()
  })

  const overallInEnglish = () =>
    screen.findByRole('radiogroup', { name: 'Overall rating' })

  it('should say in English on the page of a booking that the visit has no review, and lead to the form', async () => {
    // Arrange
    const visit = await visitToReview()

    // Act
    renderAt(`/bookings/${visit.id}`)

    // Assert
    const part = await region('Review')
    expect(
      await within(part).findByText(
        'No review of this visit has been written yet.',
      ),
    ).toBeVisible()
    expect(
      within(part).getByRole('link', { name: 'Write a review' }),
    ).toHaveAttribute('href', writePathOf(visit.id))
  })

  it('should open the form in English, say what is missing, write the review and say so', async () => {
    // Arrange
    const visit = await visitToReview()
    const user = userEvent.setup()

    // Act
    renderAt(writePathOf(visit.id))

    // Assert
    const group = await overallInEnglish()
    expect(await heading('Write a review')).toBeVisible()
    expect(
      Object.keys(
        detailsIn(screen.getByRole('region', { name: 'The visit to review' })),
      ),
    ).toEqual(['Salon', 'Date and time of the visit'])
    expect(optionsOf(select('Staff to rate'))).toEqual([
      'Do not rate the staff',
      TAKESHI,
    ])
    expect(
      screen.getByRole('link', { name: 'Back to the booking' }),
    ).toHaveAttribute('href', `/bookings/${visit.id}`)

    // Act
    await user.click(button('Post the review'))

    // Assert
    expect(group).toHaveAccessibleDescription('Choose an overall rating.')

    // Act
    await user.click(ratingOf('4 (satisfied)'))
    await user.click(button('Post the review'))

    // Assert
    expect(await heading('Your reviews')).toHaveFocus()
    expect(statusMessages()).toContain('Your review was posted.')
    expect(await storedReviewOf(visit.id)).toMatchObject({ overallRating: 4 })
  })
})
