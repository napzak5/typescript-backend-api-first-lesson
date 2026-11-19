import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { focusManager, onlineManager } from '@tanstack/react-query'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest'
import {
  CUSTOMER,
  giveBack,
  NEWCOMER,
  NEWCOMER_PASSWORD,
  NOTHING,
  registerNewcomer,
  signedInAs,
  takeAway,
} from '../bookings/__tests__/arrangements'
import {
  ADMIN,
  answers,
  asTheApplicationKeeps,
  button,
  changes,
  detailsIn,
  heading,
  insertReviews,
  KENJI,
  OSAKA,
  overall,
  ratingOf,
  region,
  removes,
  renderAt,
  select,
  selects,
  shown,
  staffIsRemoved,
  statusMessages,
  storedReviewOf,
  storedReviewsOf,
  TAKESHI,
  text,
  VIP,
  visitReviewed,
  visitToReview,
  WRITTEN,
  whenOf,
  writes,
} from './__tests__/arrangements'

/*
 * What a customer wrote about their visits: the list, the dialog that asks
 * before a review is removed, and the form that changes one. What a test
 * starts from is written as a customer or a salon writes it, through the
 * API.
 *
 * Not met here: the API limiting the requests, and a value of the form
 * that the API refuses although the form took it (the form sends nothing
 * of the kind). They are in `review-flow.test.ts` and
 * `reviews-api.test.ts`.
 */

const LIST = '/mypage/reviews'
const LIST_TITLE = '自分のレビュー'
const CHANGE_TITLE = 'レビューを変更する'

const READING = 'レビューを読み込んでいます'
const NOTHING_YET = 'レビューは、まだありません'
const REMOVED = 'レビューを削除しました。'
const CHANGED = 'レビューを変更しました。'
const NOT_FOUND = 'レビューが見つかりません'
const NOT_READ =
  'レビューを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。'
const NOT_SENT =
  '送信できませんでした。通信の状態を確かめて、もう一度お試しください。'
const QUESTION = 'レビューを削除しますか？'

const changePathOf = (reviewId: string): string => `${LIST}/${reviewId}`

const ownList = () => screen.findByRole('list', { name: LIST_TITLE })

/** The reviews of the list. A review may hold a list of its own: its pictures. */
const reviewsIn = (list: HTMLElement): HTMLElement[] =>
  within(list)
    .getAllByRole('listitem')
    .filter((item) => item.parentElement === list)

/** The reviews of the list when it is there. */
const listed = async (): Promise<HTMLElement[]> => reviewsIn(await ownList())

/** What the list says of each review: the texts of its paragraphs. */
const saidIn = (review: HTMLElement): (string | null)[] =>
  within(review)
    .getAllByRole('paragraph')
    .map((paragraph) => paragraph.textContent)

/** The button that removes the review at a place of the list. */
const removeButtonAt = async (index: number): Promise<HTMLElement> =>
  within((await listed()).at(index) ?? document.body).getByRole('button', {
    name: /のレビューを削除する$/,
  })

const dialog = () => screen.getByRole('dialog', { name: QUESTION })
const confirmButton = () =>
  within(dialog()).getByRole('button', { name: '削除する' })

const saveButton = () => button('変更を保存する')

/**
 * What was asked of the API about reviews since `fetch` is watched: the
 * method and the path of each request.
 */
const askedOfTheReviews = (fetched: MockInstance<typeof fetch>): string[] =>
  fetched.mock.calls.flatMap(([input, init]) => {
    const [, path = ''] = new URL(String(input)).pathname.split('/api/v1')

    return path.startsWith('/reviews')
      ? [`${init?.method ?? 'GET'} ${path}`]
      : []
  })

/** What the requests that write were sent with, as they were read from their bodies. */
const sentWith = (fetched: MockInstance<typeof fetch>): unknown[] =>
  fetched.mock.calls.flatMap(([, init]) =>
    typeof init?.body === 'string' ? [JSON.parse(init.body)] : [],
  )

describe('what a customer wrote, against the API', () => {
  beforeEach(async () => {
    await signedInAs(KENJI)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    focusManager.setFocused(undefined)
    onlineManager.setOnline(true)
  })

  describe('the page of the customer', () => {
    it('should lead to what the customer wrote', async () => {
      // Arrange
      renderAt('/mypage')

      // Act
      await userEvent.click(
        within(await region('レビュー')).getByRole('link', {
          name: '自分のレビューを見る',
        }),
      )

      // Assert
      expect(await heading(LIST_TITLE)).toHaveFocus()
      expect(shown.address).toBe(LIST)
      expect(
        screen.getByRole('link', { name: 'マイページへ戻る' }),
      ).toHaveAttribute('href', '/mypage')
    })
  })

  describe('the list', () => {
    it('should list what the customer wrote, the latest first: each with its salon, whom it rates, what it says, and the ways to change it and to remove it', async () => {
      // Arrange: the customer has written about the first visit, and writes about the second
      const first = await visitReviewed()
      const second = await visitToReview()
      const later = await writes(second, {
        staffId: null,
        overallRating: 2,
        title: 'Second visit',
        comment: 'Not as good as the first time.',
      })
      const [latest, earliest] = await storedReviewsOf()

      // Act
      renderAt(LIST)

      // Assert
      const reviews = await listed()
      expect(
        reviews.map((review) => {
          const salon = within(
            within(review).getByRole('heading', { level: 2 }),
          ).getByRole('link')

          return [salon.textContent, salon.getAttribute('href')]
        }),
      ).toEqual([
        [OSAKA, `/salons/${first.salonId}`],
        [OSAKA, `/salons/${first.salonId}`],
      ])
      expect(saidIn(reviews.at(0) ?? document.body)).toEqual([
        `2.0${latest?.posted}来店確認済み`,
        'Second visit',
        'Not as good as the first time.',
      ])
      expect(saidIn(reviews.at(1) ?? document.body)).toEqual([
        `評価したスタッフ: ${TAKESHI}`,
        `5.0${earliest?.posted}来店確認済み`,
        WRITTEN.title,
        WRITTEN.comment,
        'サービス 5・スタッフ 5・雰囲気 4・清潔さ 5・価格 4',
        '2 人が「参考になった」と答えています',
      ])
      expect(
        within(reviews.at(0) ?? document.body).getByRole('link', {
          name: `${OSAKA}（${latest?.posted} 投稿）のレビューを変更する`,
        }),
      ).toHaveAttribute('href', changePathOf(later))
      expect(
        within(reviews.at(1) ?? document.body).getByRole('link', {
          name: `${OSAKA}（${earliest?.posted} 投稿）のレビューを変更する`,
        }),
      ).toHaveAttribute('href', changePathOf(first.reviewId))
      expect(statusMessages()).toContain('2 件のレビューがあります')
      expect(await heading(LIST_TITLE)).toBeVisible()
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should say that the customer has written nothing yet, and lead to the visits that were', async () => {
      // Arrange
      await signedInAs(VIP)
      const { reviewId } = await visitReviewed(VIP)
      await removes(reviewId, VIP)

      // Act
      renderAt(LIST)

      // Assert
      expect(await screen.findByText(NOTHING_YET)).toBeVisible()
      expect(
        screen.getByRole('link', { name: 'これまでの予約を見る' }),
      ).toHaveAttribute('href', '/bookings?when=past')
      expect(screen.queryByRole('list', { name: LIST_TITLE })).toBeNull()
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should lead an account that has not said who its customer is to where it says so: it has no visit to write about', async () => {
      // Arrange
      await registerNewcomer()
      await signedInAs(NEWCOMER, NEWCOMER_PASSWORD)

      // Act
      renderAt(LIST)

      // Assert
      expect(
        await screen.findByText('レビューは、お客様の情報を登録すると書けます'),
      ).toBeVisible()
      expect(
        screen.getByRole('link', { name: 'お客様の情報を登録する' }),
      ).toHaveAttribute('href', '/mypage/profile')
      expect(screen.queryByText(NOTHING_YET)).toBeNull()
      expect(
        screen.queryByRole('link', { name: 'これまでの予約を見る' }),
      ).toBeNull()
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should show the first reviews, add the next ones below when asked, and move the focus to the salon of the first that was added', async () => {
      // Arrange
      await insertReviews(KENJI, 12)
      renderAt(LIST)
      expect(await listed()).toHaveLength(10)
      expect(statusMessages()).toContain(
        '13 件のレビューがあります（10 件を表示しています）',
      )

      // Act
      await userEvent.click(button('さらに表示'))

      // Assert
      await waitFor(async () => expect(await listed()).toHaveLength(13))
      const reviews = await listed()
      expect(
        within(reviews.at(10) ?? document.body).getByRole('link', {
          name: OSAKA,
        }),
      ).toHaveFocus()
      expect(reviews.slice(9).map((review) => saidIn(review).at(1))).toEqual([
        'Earlier visit 9',
        'Earlier visit 10',
        'Earlier visit 11',
        'Earlier visit 12',
      ])
      expect(statusMessages()).toContain('13 件のレビューがあります')
      expect(screen.queryByRole('button', { name: 'さらに表示' })).toBeNull()
    })

    it('should say that the next reviews did not come, keep those that are there, and add them when asked again', async () => {
      // Arrange
      await insertReviews(KENJI, 12)
      renderAt(LIST)
      expect(await listed()).toHaveLength(10)
      await takeAway('reviews')

      // Act
      await userEvent.click(button('さらに表示'))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(
        '続きを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(await listed()).toHaveLength(10)

      // Act
      await giveBack('reviews')
      await userEvent.click(button('もう一度読み込む'))

      // Assert
      await waitFor(async () => expect(await listed()).toHaveLength(13))
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('should say that the reviews could not be read, and list them when asked again', async () => {
      // Arrange
      await takeAway('reviews')

      // Act
      renderAt(LIST)

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(NOT_READ)
      expect(screen.queryByRole('list', { name: LIST_TITLE })).toBeNull()

      // Act
      await giveBack('reviews')
      await userEvent.click(button('もう一度読み込む'))

      // Assert
      expect(await listed()).toHaveLength(1)
    })

    it('should list the reviews as they are now whenever the list is shown: with what the salon answered meanwhile', async () => {
      // Arrange: the application keeps what it read; the list is read, and left
      await signedInAs(VIP)
      const { reviewId } = await visitReviewed(VIP)
      const client = asTheApplicationKeeps()
      const { unmount } = renderAt(LIST, client)
      expect(await listed()).toHaveLength(1)
      unmount()

      // Act
      await answers(reviewId, 'またのご来店をお待ちしています。')
      renderAt(LIST, client)

      // Assert
      expect(
        await screen.findByText('またのご来店をお待ちしています。'),
      ).toBeVisible()
    })
  })

  describe('removing a review', () => {
    it('should ask before it removes, name the review and say what goes with it, and remove nothing when the customer goes back', async () => {
      // Arrange
      const visit = await visitReviewed()
      const [review] = await storedReviewsOf()
      renderAt(LIST)

      // Act
      await userEvent.click(await removeButtonAt(0))

      // Assert
      expect(dialog()).toHaveAccessibleDescription(
        `${OSAKA}（${review?.posted} 投稿）のレビューを削除します。削除したレビューは、サロンからの返信とともに消え、元に戻せません。この来店のレビューは、もう一度書けます。`,
      )
      expect(await findAccessibilityViolations()).toEqual([])

      // Act
      await userEvent.click(
        within(dialog()).getByRole('button', { name: '戻る' }),
      )

      // Assert
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      expect(await listed()).toHaveLength(1)
      expect(await storedReviewOf(visit.id)).toMatchObject({
        id: visit.reviewId,
      })
    })

    it('should remove the review, say so, read the list again, and move the focus to the heading of the screen', async () => {
      // Arrange
      const visit = await visitReviewed()
      renderAt(LIST)
      await userEvent.click(await removeButtonAt(0))

      // Act
      await userEvent.click(confirmButton())

      // Assert: the list that held the review is gone with it
      expect(await screen.findByText(NOTHING_YET)).toBeVisible()
      expect(await heading(LIST_TITLE)).toHaveFocus()
      expect(statusMessages()).toContain(REMOVED)
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.queryByText(WRITTEN.title)).toBeNull()
      expect(await storedReviewOf(visit.id)).toBeNull()
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should keep the other reviews, and count them anew', async () => {
      // Arrange
      const first = await visitReviewed()
      const second = await visitToReview()
      await writes(second, { title: 'Second visit' })
      renderAt(LIST)
      expect(await listed()).toHaveLength(2)

      // Act: the latest review, which is the first of the list
      await userEvent.click(await removeButtonAt(0))
      await userEvent.click(confirmButton())

      // Assert
      await screen.findByText(REMOVED)
      await waitFor(() => expect(screen.queryByText('Second visit')).toBeNull())
      const reviews = await listed()
      // The dialog went with the review it asked about
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(reviews.map((review) => saidIn(review).at(2))).toEqual([
        WRITTEN.title,
      ])
      expect(await heading(LIST_TITLE)).toHaveFocus()
      expect(statusMessages()).toContain('1 件のレビューがあります')
      expect(await storedReviewOf(second.id)).toBeNull()
      expect(await storedReviewOf(first.id)).toMatchObject({
        id: first.reviewId,
      })
    })

    it('should say in the dialog that the removal was not sent, keep the dialog, and remove when it is asked for again', async () => {
      // Arrange
      const visit = await visitReviewed()
      renderAt(LIST)
      await userEvent.click(await removeButtonAt(0))
      await takeAway('reviews')

      // Act
      await userEvent.click(confirmButton())

      // Assert
      expect(await within(dialog()).findByRole('alert')).toHaveTextContent(
        NOT_SENT,
      )
      expect(dialog()).toHaveAttribute('open')

      // Act
      await giveBack('reviews')
      await userEvent.click(confirmButton())

      // Assert
      expect(await screen.findByText(REMOVED)).toBeVisible()
      expect(await storedReviewOf(visit.id)).toBeNull()
    })

    it('should say nothing of an attempt before when the dialog is opened again', async () => {
      // Arrange
      renderAt(LIST)
      await userEvent.click(await removeButtonAt(0))
      await takeAway('reviews')
      await userEvent.click(confirmButton())
      await within(dialog()).findByRole('alert')
      await giveBack('reviews')
      await userEvent.click(
        within(dialog()).getByRole('button', { name: '戻る' }),
      )
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

      // Act
      await userEvent.click(await removeButtonAt(0))

      // Assert
      expect(within(dialog()).queryByRole('alert')).toBeNull()
    })

    it('should take a review that was removed elsewhere meanwhile for removed: what the customer asked for is so', async () => {
      // Arrange
      const visit = await visitReviewed()
      renderAt(LIST)
      await userEvent.click(await removeButtonAt(0))
      await removes(visit.reviewId, ADMIN)

      // Act
      await userEvent.click(confirmButton())

      // Assert
      expect(await screen.findByText(NOTHING_YET)).toBeVisible()
      expect(statusMessages()).toContain(REMOVED)
      expect(await heading(LIST_TITLE)).toHaveFocus()
    })

    it('should say on the page of the booking that the visit has no review the moment the page is shown again, and offer to write one', async () => {
      // Arrange: the page of the visit is read, with its review
      const visit = await visitReviewed()
      renderAt(`/bookings/${visit.id}`, asTheApplicationKeeps())
      const user = userEvent.setup()
      await within(await region('レビュー')).findByText(WRITTEN.title)
      await user.click(screen.getByRole('link', { name: 'マイページ' }))
      await user.click(
        await screen.findByRole('link', { name: '自分のレビューを見る' }),
      )
      await user.click(await removeButtonAt(0))
      await user.click(confirmButton())
      await screen.findByText(REMOVED)

      // Act
      await user.click(screen.getByRole('link', { name: '予約の一覧' }))
      await user.click(
        await screen.findByRole('link', { name: 'これまでの予約' }),
      )
      await user.click(await screen.findByRole('link', { name: whenOf(visit) }))

      // Assert
      const part = await region('レビュー')
      expect(shown.firstSight).toEqual([
        `/bookings/${visit.id}`,
        expect.stringContaining('この来店のレビューは、まだ書かれていません。'),
      ])
      expect(shown.firstSight.at(1)).not.toContain(WRITTEN.title)
      expect(
        within(part).getByRole('link', { name: 'レビューを書く' }),
      ).toHaveAttribute('href', `/bookings/${visit.id}/review`)
    })
  })

  describe('changing a review', () => {
    it('should open with what the review holds, say what it is of, and say whom it rates in place of the choice', async () => {
      // Arrange
      const visit = await visitReviewed()
      const [review] = await storedReviewsOf()

      // Act
      renderAt(changePathOf(visit.reviewId))

      // Assert
      await overall()
      expect(await heading(CHANGE_TITLE)).toBeVisible()
      const about = screen.getByRole('region', { name: '変更するレビュー' })
      expect(detailsIn(about)).toEqual({
        サロン: OSAKA,
        投稿日: review?.posted,
      })
      expect(within(about).getByRole('link', { name: OSAKA })).toHaveAttribute(
        'href',
        `/salons/${visit.salonId}`,
      )
      expect(ratingOf('5（とても満足）')).toBeChecked()
      expect(selects()).toEqual([
        'serviceRating',
        'staffRating',
        'atmosphereRating',
        'cleanlinessRating',
        'valueRating',
      ])
      expect(
        ['サービス', 'スタッフ', '雰囲気', '清潔さ', '価格'].map(
          (name) =>
            screen.getByRole<HTMLSelectElement>('combobox', { name }).value,
        ),
      ).toEqual(['5', '5', '4', '5', '4'])
      expect(text('タイトル')).toHaveValue(WRITTEN.title)
      expect(text('本文')).toHaveValue(WRITTEN.comment)
      expect(text('写真の URL')).toHaveValue('')
      expect(
        screen.getByText(
          `評価するスタッフ: ${TAKESHI}。評価するスタッフは、変更できません。`,
        ),
      ).toBeVisible()
      expect(
        screen.getByRole('link', { name: '自分のレビューへ戻る' }),
      ).toHaveAttribute('href', LIST)
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should send what was changed and nothing else, say so, and show the review as it is now among what the customer wrote', async () => {
      // Arrange
      const visit = await visitReviewed()
      renderAt(changePathOf(visit.reviewId))
      const user = userEvent.setup()
      await overall()
      const fetched = vi.spyOn(globalThis, 'fetch')

      // Act
      await user.click(ratingOf('3（ふつう）'))
      await user.selectOptions(select('雰囲気'), '評価しない')
      await user.clear(text('本文'))
      await user.type(text('本文'), '  思い返すと、待ち時間が長めでした。  ')
      await user.click(saveButton())

      // Assert
      expect(await heading(LIST_TITLE)).toHaveFocus()
      expect(shown.address).toBe(LIST)
      expect(statusMessages()).toContain(CHANGED)
      expect(sentWith(fetched)).toEqual([
        {
          overallRating: 3,
          atmosphereRating: null,
          comment: '思い返すと、待ち時間が長めでした。',
        },
      ])
      expect(askedOfTheReviews(fetched).at(0)).toBe(
        `PATCH /reviews/${visit.reviewId}`,
      )
      const [review] = await listed()
      expect(saidIn(review ?? document.body)).toEqual(
        expect.arrayContaining([
          WRITTEN.title,
          '思い返すと、待ち時間が長めでした。',
          'サービス 5・スタッフ 5・清潔さ 5・価格 4',
        ]),
      )
      expect(await storedReviewOf(visit.id)).toMatchObject({
        id: visit.reviewId,
        staff: TAKESHI,
        overallRating: 3,
        serviceRating: 5,
        staffRating: 5,
        atmosphereRating: null,
        cleanlinessRating: 5,
        valueRating: 4,
        title: WRITTEN.title,
        comment: '思い返すと、待ち時間が長めでした。',
      })
    })

    it('should ask the API for nothing when the form is sent as it was opened, say so, and go back to the list', async () => {
      // Arrange
      const visit = await visitReviewed()
      const before = await storedReviewOf(visit.id)
      renderAt(changePathOf(visit.reviewId))
      await overall()
      const fetched = vi.spyOn(globalThis, 'fetch')

      // Act
      await userEvent.click(saveButton())

      // Assert
      expect(await heading(LIST_TITLE)).toHaveFocus()
      expect(statusMessages()).toContain('変更された項目はありません。')
      expect(
        askedOfTheReviews(fetched).filter((request) =>
          request.startsWith('PATCH'),
        ),
      ).toEqual([])
      expect(await storedReviewOf(visit.id)).toEqual(before)
    })

    it('should leave alone what was changed elsewhere while the form was open', async () => {
      // Arrange
      const visit = await visitReviewed()
      renderAt(changePathOf(visit.reviewId))
      const user = userEvent.setup()
      await overall()
      await changes(visit.reviewId, {
        title: 'ほかの画面で変えたタイトル',
        valueRating: 1,
      })

      // Act
      await user.selectOptions(select('サービス'), '2')
      await user.click(saveButton())

      // Assert
      await screen.findByText(CHANGED)
      expect(await storedReviewOf(visit.id)).toMatchObject({
        serviceRating: 2,
        title: 'ほかの画面で変えたタイトル',
        valueRating: 1,
        comment: WRITTEN.comment,
      })
    })

    it('should have no rating of the staff for a review that rates nobody, and say that nobody can be added', async () => {
      // Arrange
      const visit = await visitToReview()
      const reviewId = await writes(visit, { staffId: null, overallRating: 2 })

      // Act
      renderAt(changePathOf(reviewId))

      // Assert
      await overall()
      expect(ratingOf('2（やや不満）')).toBeChecked()
      expect(selects()).toEqual([
        'serviceRating',
        'atmosphereRating',
        'cleanlinessRating',
        'valueRating',
      ])
      expect(
        screen.getByText(
          'このレビューは、スタッフを評価していません。評価するスタッフは、あとから追加できません。',
        ),
      ).toBeVisible()
    })

    it('should say that the member a review rates is no longer shown, and still take a change', async () => {
      // Arrange
      const visit = await visitReviewed()
      await staffIsRemoved(TAKESHI)
      renderAt(changePathOf(visit.reviewId))
      const user = userEvent.setup()
      await overall()

      // Assert
      expect(
        screen.getByText(
          '評価するスタッフ: スタッフ（掲載を終えています）。評価するスタッフは、変更できません。',
        ),
      ).toBeVisible()

      // Act
      await user.selectOptions(select('スタッフ'), '4')
      await user.click(saveButton())

      // Assert
      await screen.findByText(CHANGED)
      expect(await storedReviewOf(visit.id)).toMatchObject({ staffRating: 4 })
    })

    it('should not send a title that is too long: it says so at the title, where the focus goes', async () => {
      // Arrange
      const visit = await visitReviewed()
      renderAt(changePathOf(visit.reviewId))
      await overall()

      // Act: 256 characters are not typed one by one
      fireEvent.change(text('タイトル'), {
        target: { value: 'あ'.repeat(256) },
      })
      await userEvent.click(saveButton())

      // Assert
      expect(text('タイトル')).toHaveAccessibleDescription(
        expect.stringContaining('255 文字以内で入力してください。'),
      )
      expect(text('タイトル')).toHaveFocus()
      expect(shown.address).toBe(changePathOf(visit.reviewId))
      expect(await storedReviewOf(visit.id)).toMatchObject({
        title: WRITTEN.title,
      })
    })

    it('should find no review that another customer wrote', async () => {
      // Arrange
      const { reviewId } = await visitReviewed(CUSTOMER)

      // Act
      renderAt(changePathOf(reviewId))

      // Assert
      expect(await screen.findByText(NOT_FOUND)).toBeVisible()
      expect(
        screen.getByRole('link', { name: '自分のレビューを見る' }),
      ).toHaveAttribute('href', LIST)
      expect(
        screen.queryByRole('button', { name: '変更を保存する' }),
      ).toBeNull()
      expect(await heading(CHANGE_TITLE)).toBeVisible()
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it.each([
      ['names nothing', NOTHING],
      ['is no ID', 'first'],
    ])('should find no review for an address that %s', async (_case, id) => {
      // Act
      renderAt(changePathOf(id))

      // Assert
      expect(await screen.findByText(NOT_FOUND)).toBeVisible()
    })

    it('should say that the review was removed meanwhile, in the place of the form, and move the focus to the heading', async () => {
      // Arrange
      const visit = await visitReviewed()
      renderAt(changePathOf(visit.reviewId))
      const user = userEvent.setup()
      await overall()
      await removes(visit.reviewId, ADMIN)

      // Act
      await user.click(ratingOf('1（不満）'))
      await user.click(saveButton())

      // Assert
      expect(await screen.findByText(NOT_FOUND)).toBeVisible()
      expect(await heading(CHANGE_TITLE)).toHaveFocus()
      expect(statusMessages()).toContain(
        'このレビューは、すでに削除されていたため、変更を保存できませんでした。',
      )
      expect(
        screen.queryByRole('button', { name: '変更を保存する' }),
      ).toBeNull()
      expect(await findAccessibilityViolations()).toEqual([])
    })

    it('should say that the review could not be read, and open the form when it is read again', async () => {
      // Arrange
      const visit = await visitReviewed()
      await takeAway('reviews')

      // Act
      renderAt(changePathOf(visit.reviewId))

      // Assert
      expect(await screen.findByRole('alert')).toHaveTextContent(NOT_READ)

      // Act
      await giveBack('reviews')
      await userEvent.click(button('もう一度読み込む'))

      // Assert
      await overall()
      expect(text('タイトル')).toHaveValue(WRITTEN.title)
    })

    it('should say in the form that nothing was sent when the API fails, keep what was written, and read nothing behind the form', async () => {
      // Arrange
      const visit = await visitReviewed()
      renderAt(changePathOf(visit.reviewId))
      const user = userEvent.setup()
      await overall()
      await user.type(text('本文'), ' 追記です。')
      // A read behind the form would fail, and put its notice in the place of the form
      await takeAway('reviews')
      const fetched = vi.spyOn(globalThis, 'fetch')

      // Act
      focusManager.setFocused(false)
      focusManager.setFocused(true)
      onlineManager.setOnline(false)
      onlineManager.setOnline(true)
      await user.click(saveButton())

      // Assert: by the time the failure of the form is said, a read that
      // the focus or the network started would have been asked for
      expect(await screen.findByRole('alert')).toHaveTextContent(NOT_SENT)
      expect(askedOfTheReviews(fetched)).toEqual([
        `PATCH /reviews/${visit.reviewId}`,
      ])
      expect(text('本文')).toHaveValue(`${WRITTEN.comment} 追記です。`)

      // Act
      await giveBack('reviews')
      await user.click(saveButton())

      // Assert
      await screen.findByText(CHANGED)
      expect(await storedReviewOf(visit.id)).toMatchObject({
        comment: `${WRITTEN.comment} 追記です。`,
      })
    })
  })

  describe('what the application kept', () => {
    it('should open the form with the review as it is now, not as the form held it before', async () => {
      // Arrange: the form is opened, and left
      const visit = await visitReviewed()
      renderAt(LIST, asTheApplicationKeeps())
      const user = userEvent.setup()
      await user.click(
        within((await listed()).at(0) ?? document.body).getByRole('link', {
          name: /のレビューを変更する$/,
        }),
      )
      await overall()
      expect(text('タイトル')).toHaveValue(WRITTEN.title)
      await user.click(
        screen.getByRole('link', { name: '自分のレビューへ戻る' }),
      )
      await changes(visit.reviewId, { title: 'ほかの画面で変えたタイトル' })

      // Act
      await user.click(
        within((await listed()).at(0) ?? document.body).getByRole('link', {
          name: /のレビューを変更する$/,
        }),
      )

      // Assert
      expect(
        await screen.findByDisplayValue('ほかの画面で変えたタイトル'),
      ).toBe(text('タイトル'))
    })

    it('should show the list as it is after the change, and never as it was read before', async () => {
      // Arrange: the list is read before the review is changed
      renderAt(LIST, asTheApplicationKeeps())
      const user = userEvent.setup()
      await user.click(
        within((await listed()).at(0) ?? document.body).getByRole('link', {
          name: /のレビューを変更する$/,
        }),
      )
      await overall()
      await user.clear(text('タイトル'))
      await user.type(text('タイトル'), '書き直したタイトル')

      // Act
      await user.click(saveButton())

      // Assert: the commit that shows the list again holds no list
      const [review] = await listed()
      expect(shown.firstSight).toEqual([LIST, expect.stringContaining(READING)])
      expect(shown.firstSight.at(1)).not.toContain(WRITTEN.title)
      expect(saidIn(review ?? document.body)).toContain('書き直したタイトル')
    })
  })
})
