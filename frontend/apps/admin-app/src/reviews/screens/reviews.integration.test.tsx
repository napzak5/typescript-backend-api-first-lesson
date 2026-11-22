import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { salonIdOf } from '@beauty-salon-frontend/testing/api'
import { firstSight, heading } from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OPERATOR,
  OSAKA,
  OWNER,
  SAKURA,
  STYLIST,
  TOKYO,
  YUKI,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openAs } from '../../__tests__/screens'
import { refuse } from '../../bookings/__tests__/arrangements'
import {
  customersHrefOf,
  reviewHrefOf,
  reviewResponseHrefOf,
  reviewsHrefOf,
} from '../../navigation'
import {
  reviewIdOf,
  reviewRemovedMeanwhile,
  storedReportsOf,
  storedReviewOf,
} from '../__tests__/arrangements'

/*
 * The reviews of a salon against the API: what they come to, the list,
 * a review with the answer of the salon, and its report. The reviews of
 * the seed data are in `__tests__/arrangements.ts`.
 */

const EXCELLENT = 'Excellent service!'
const SATISFIED = 'Satisfied with the result'
const GOOD = 'Good but could be better'

const ANSWER_OF_THE_SEED =
  'Thank you for your wonderful review! We look forward to seeing you again.'

/** The address of a review of the salon in Tokyo, by its title */
const reviewAt = async (title: string, salon = TOKYO): Promise<string> =>
  reviewHrefOf(await salonIdOf(salon), await reviewIdOf(title))

/** Opens a review, and waits for its record. */
const openReviewAs = async (title: string, email: string): Promise<void> => {
  await openAs(await reviewAt(title), email)
  await heading(title)
  await screen.findByRole('link', { name: '来店の予約' })
}

/** Opens the answer to a review, and waits for its form. */
const openResponseAs = async (title: string, email: string): Promise<void> => {
  await openAs(
    reviewResponseHrefOf(await salonIdOf(TOKYO), await reviewIdOf(title)),
    email,
  )
  await screen.findByRole('textbox', { name: '返信' })
}

/** The titles of the reviews of the list, in its order */
const listed = (): string[] =>
  within(screen.getByRole('table'))
    .getAllByRole('rowheader')
    .map(({ textContent }) => textContent ?? '')

/** Each term of the record of the review with its description */
const detailsOf = (): string[][] => {
  const record = screen.getByRole('region', { name: 'レビュー' })
  const descriptions = within(record).getAllByRole('definition')

  return within(record)
    .getAllByRole('term')
    .map((term, index) => [
      term.textContent ?? '',
      descriptions[index]?.textContent ?? '',
    ])
}

const answerPart = (): HTMLElement =>
  screen.getByRole('region', { name: 'サロンからの返信' })

const RESPOND = '返信する'
const CHANGE = '返信を直す'

describe('the reviews of a salon', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('should lead the owner to what the reviews of the salon come to, and to the reviews, in the order asked for and narrowed', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(customersHrefOf(await salonIdOf(TOKYO)), OWNER)
    await heading('顧客台帳')

    // Act
    await user.click(screen.getByRole('link', { name: 'レビュー' }))

    // Assert
    await heading('レビュー')
    const summary = await screen.findByRole('region', { name: '評価のまとめ' })
    expect(
      within(summary).getByRole('img', { name: '5 段階中 4.0（3 件）' }),
    ).toBeVisible()
    expect(
      within(summary)
        .getAllByRole('listitem')
        .map(({ textContent }) => textContent),
    ).toEqual([
      '評価 51 件',
      '評価 41 件',
      '評価 31 件',
      '評価 20 件',
      '評価 10 件',
    ])
    await screen.findByRole('table', { name: 'レビュー' })
    expect(listed().toSorted()).toEqual([EXCELLENT, GOOD, SATISFIED])
    const good = screen.getByRole('row', { name: new RegExp(GOOD) })
    // The staff are read beside the reviews, and name the member once read
    await within(good).findByText('Yui Watanabe')
    expect(
      within(good)
        .getAllByRole('cell')
        .map(({ textContent }) => textContent),
    ).toEqual([
      expect.stringMatching(/^\d{4}年\d+月\d+日/),
      '3.0',
      'Service was good but had to wait despite having a reservation.',
      'Yui Watanabe',
      '未返信',
      'なし',
    ])
    expect(
      within(
        screen.getByRole('row', { name: new RegExp(EXCELLENT) }),
      ).getByText('返信済み'),
    ).toBeVisible()

    // Act
    await user.selectOptions(
      screen.getByRole('combobox', { name: '並び順' }),
      'rating',
    )
    await user.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    await waitFor(() => expect(listed()).toEqual([EXCELLENT, SATISFIED, GOOD]))
    expect(firstSight()[0]).toMatch(/\/reviews\?sort=rating$/)

    // Act
    await user.selectOptions(
      screen.getByRole('combobox', { name: '並び順' }),
      'helpful',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: '評価の上限' }),
      '4',
    )
    await user.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    expect(
      await screen.findByRole('table', { name: '条件に合うレビュー' }),
    ).toBeVisible()
    await waitFor(() => expect(listed()).toEqual([SATISFIED, GOOD]))

    // Act
    await user.selectOptions(
      screen.getByRole('combobox', { name: '担当スタッフ' }),
      'Yui Watanabe',
    )
    await user.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    await waitFor(() => expect(listed()).toEqual([GOOD]))

    // Act
    await user.click(screen.getByRole('link', { name: '条件を外す' }))

    // Assert
    expect(await screen.findByRole('table', { name: 'レビュー' })).toBeVisible()
    expect(listed()).toHaveLength(3)
  })

  it('should say what is wrong with a highest rating below the lowest, and ask for nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(reviewsHrefOf(await salonIdOf(TOKYO)), STYLIST)
    await screen.findByRole('table', { name: 'レビュー' })

    // Act
    await user.selectOptions(
      screen.getByRole('combobox', { name: '評価の下限' }),
      '4',
    )
    await user.selectOptions(
      screen.getByRole('combobox', { name: '評価の上限' }),
      '2',
    )
    await user.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    const highest = screen.getByRole('combobox', { name: '評価の上限' })
    await waitFor(() => expect(highest).toHaveFocus())
    expect(highest).toHaveAccessibleDescription(
      '評価の上限は、下限と同じか、それより高くしてください。',
    )
    expect(listed()).toHaveLength(3)
  })

  it('should say that no review meets the conditions', async () => {
    // Arrange
    await openAs(`${reviewsHrefOf(await salonIdOf(TOKYO))}?max=2`, STYLIST)

    // Assert
    expect(
      await screen.findByText('条件に合うレビューはありません'),
    ).toBeVisible()
  })

  it('should show a review with who wrote it, the visit and the member it rates, and what the salon answered', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(reviewsHrefOf(await salonIdOf(TOKYO)), STYLIST)

    // Act
    await user.click(await screen.findByRole('link', { name: EXCELLENT }))

    // Assert
    await heading(EXCELLENT)
    await waitFor(() =>
      expect(detailsOf()).toContainEqual(['お客様', YUKI.name]),
    )
    expect(detailsOf()).toEqual([
      ['サービスの評価', '5'],
      ['スタッフの評価', '5'],
      ['雰囲気の評価', '5'],
      ['清潔さの評価', '5'],
      ['価格の評価', '5'],
      ['お客様', YUKI.name],
      ['予約', '来店の予約'],
      ['担当スタッフ', 'Hiroshi Tanaka'],
      ['投稿日時', expect.stringMatching(/^\d{4}年\d+月\d+日/)],
      ['参考になった', '3 人'],
      ['未処理の通報', 'なし'],
    ])
    expect(
      screen.getByText(
        'The staff was very professional and friendly. My hair looks amazing!',
      ),
    ).toBeVisible()
    expect(within(answerPart()).getByText(ANSWER_OF_THE_SEED)).toBeVisible()
    expect(
      within(answerPart()).getByText(
        '返信を書くことと、運営への通報ができるのは、サロンのオーナーとマネージャーです。',
      ),
    ).toBeVisible()
    expect(within(answerPart()).queryByRole('button')).toBeNull()
    expect(screen.queryByRole('region', { name: '運営への通報' })).toBeNull()

    // Act
    await user.click(screen.getByRole('link', { name: YUKI.name }))

    // Assert
    await heading('お客様の台帳')
    expect(
      await screen.findByText('Tanaka Yuki（タナカ ユキ） 様'),
    ).toBeVisible()
  })

  it('should let the owner answer a review, show the answer on the review and in the list, and keep it', async () => {
    // Arrange: the list is read first, and keeps the review as unanswered
    const user = userEvent.setup()
    await openAs(reviewsHrefOf(await salonIdOf(TOKYO)), OWNER)
    const unanswered = await screen.findByRole('row', {
      name: new RegExp(GOOD),
    })
    expect(within(unanswered).getByText('未返信')).toBeVisible()
    await user.click(within(unanswered).getByRole('link', { name: GOOD }))
    await heading(GOOD)
    expect(
      await within(answerPart()).findByText('まだ返信していません。'),
    ).toBeVisible()

    // Act
    await user.click(
      within(answerPart()).getByRole('link', { name: '返信を書く' }),
    )
    await heading('レビューに返信する')
    expect(
      await screen.findByText(
        'Service was good but had to wait despite having a reservation.',
      ),
    ).toBeVisible()
    await user.type(
      screen.getByRole('textbox', { name: '返信' }),
      'お待たせして申し訳ありませんでした。{Enter}次回は時間どおりにご案内します。',
    )
    await user.click(screen.getByRole('button', { name: RESPOND }))

    // Assert
    expect(await screen.findByText('レビューに返信しました。')).toBeVisible()
    await heading(GOOD)
    expect(
      within(answerPart()).getByText(/お待たせして申し訳ありませんでした。/),
    ).toBeVisible()
    expect(within(answerPart()).getByText(/^返信日時 /)).toBeVisible()
    expect(
      within(answerPart()).getByRole('link', { name: CHANGE }),
    ).toBeVisible()
    expect(await storedReviewOf(GOOD)).toMatchObject({
      ownerResponse:
        'お待たせして申し訳ありませんでした。\n次回は時間どおりにご案内します。',
      ownerRespondedAt: expect.any(String),
    })

    // Act
    await user.click(screen.getByRole('link', { name: 'レビューへ' }))

    // Assert: the list that was read before is not shown, but read anew
    expect(firstSight()[1]).toContain('レビューを読み込んでいます')
    expect(firstSight()[1]).not.toContain('未返信')
    const good = await screen.findByRole('row', { name: new RegExp(GOOD) })
    expect(within(good).getByText('返信済み')).toBeVisible()
  })

  it('should let a manager change the answer of the salon, starting with the one the review holds', async () => {
    // Arrange
    const user = userEvent.setup()
    await openResponseAs(EXCELLENT, MANAGER)
    const answer = screen.getByRole('textbox', { name: '返信' })
    expect(answer).toHaveValue(ANSWER_OF_THE_SEED)

    // Act
    await user.clear(answer)
    await user.type(answer, 'ご来店ありがとうございました。')
    await user.click(screen.getByRole('button', { name: CHANGE }))

    // Assert
    expect(await screen.findByText('返信を直しました。')).toBeVisible()
    await heading(EXCELLENT)
    expect(
      within(answerPart()).getByText('ご来店ありがとうございました。'),
    ).toBeVisible()
    expect((await storedReviewOf(EXCELLENT)).ownerResponse).toBe(
      'ご来店ありがとうございました。',
    )
  })

  it('should send nothing when the answer is the one the review holds', async () => {
    // Arrange
    const user = userEvent.setup()
    const before = await storedReviewOf(EXCELLENT)
    await openResponseAs(EXCELLENT, OWNER)

    // Act
    await user.click(screen.getByRole('button', { name: CHANGE }))

    // Assert
    expect(
      await screen.findByText('変更された項目はありません。'),
    ).toBeVisible()
    await heading(EXCELLENT)
    expect(await storedReviewOf(EXCELLENT)).toEqual(before)
  })

  it('should ask for an answer that is more than spaces, and send nothing', async () => {
    // Arrange
    const user = userEvent.setup()
    await openResponseAs(GOOD, OWNER)
    const answer = screen.getByRole('textbox', { name: '返信' })

    // Act
    await user.type(answer, '   ')
    await user.click(screen.getByRole('button', { name: RESPOND }))

    // Assert
    await waitFor(() => expect(answer).toHaveFocus())
    expect(answer).toBeInvalid()
    expect(answer).toHaveAccessibleDescription(/返信を入力してください。/)
    expect((await storedReviewOf(GOOD)).ownerResponse).toBeNull()
  })

  it('should say that the answer could not be sent when the database fails', async () => {
    // Arrange
    const user = userEvent.setup()
    await openResponseAs(GOOD, OWNER)
    await refuse('update', 'reviews')

    // Act
    await user.type(screen.getByRole('textbox', { name: '返信' }), 'ありがとう')
    await user.click(screen.getByRole('button', { name: RESPOND }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '返信を送れませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(screen.getByRole('textbox', { name: '返信' })).toHaveValue(
      'ありがとう',
    )
  })

  it('should say that the review is gone when its customer removed it while it was answered', async () => {
    // Arrange
    const user = userEvent.setup()
    await openResponseAs(GOOD, OWNER)
    await reviewRemovedMeanwhile(GOOD)

    // Act
    await user.type(screen.getByRole('textbox', { name: '返信' }), 'ありがとう')
    await user.click(screen.getByRole('button', { name: RESPOND }))

    // Assert
    expect(await heading('レビューが見つかりません')).toBeVisible()
    expect(screen.getByRole('link', { name: 'レビューへ' })).toBeVisible()
  })

  it('should say why the owner of another salon does not answer its review', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(
      reviewResponseHrefOf(
        await salonIdOf(OSAKA),
        await reviewIdOf('Great experience'),
      ),
      OWNER,
    )
    await screen.findByRole('textbox', { name: '返信' })

    // Act
    await user.type(screen.getByRole('textbox', { name: '返信' }), 'ありがとう')
    await user.click(screen.getByRole('button', { name: RESPOND }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'このアカウントでは、このレビューに返信できません。返信できるのは、サロンのオーナーとマネージャーです。',
    )
    expect((await storedReviewOf('Great experience')).ownerResponse).toBeNull()
  })

  it('should tell a member of the staff at the address of the answer who writes it', async () => {
    // Arrange
    const user = userEvent.setup()
    await openAs(
      reviewResponseHrefOf(await salonIdOf(TOKYO), await reviewIdOf(GOOD)),
      STYLIST,
    )

    // Assert
    expect(
      await screen.findByText(
        'このアカウントでは、レビューに返信できません。返信を書けるのは、サロンのオーナーとマネージャーです。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('textbox', { name: '返信' })).toBeNull()

    // Act
    await user.click(screen.getByRole('link', { name: 'レビューへ戻る' }))

    // Assert
    expect(await heading(GOOD)).toBeVisible()
  })

  it('should let the owner withdraw the answer after the dialog asks, and move the focus to the answer', async () => {
    // Arrange
    const user = userEvent.setup()
    await openReviewAs(EXCELLENT, OWNER)

    // Act
    await user.click(
      within(answerPart()).getByRole('button', { name: '返信を取り下げる' }),
    )
    const dialog = screen.getByRole('dialog', {
      name: '返信を取り下げますか？',
    })
    await user.click(within(dialog).getByRole('button', { name: '取り下げる' }))

    // Assert
    expect(await screen.findByText('返信を取り下げました。')).toBeVisible()
    expect(
      within(answerPart()).getByText('まだ返信していません。'),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'サロンからの返信' }),
    ).toHaveFocus()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await storedReviewOf(EXCELLENT)).toMatchObject({
      ownerResponse: null,
      ownerRespondedAt: null,
    })
  })

  it('should let an administrator withdraw an answer, and offer no answer to write', async () => {
    // Arrange
    const user = userEvent.setup()
    await openReviewAs(EXCELLENT, OPERATOR)
    expect(
      within(answerPart()).getByText(
        '管理者は、規約に反する返信を取り下げられます。返信を書くことと、運営への通報は、サロンのオーナーとマネージャーがします。',
      ),
    ).toBeVisible()
    expect(within(answerPart()).queryByRole('link')).toBeNull()
    expect(screen.queryByRole('region', { name: '運営への通報' })).toBeNull()

    // Act
    await user.click(
      within(answerPart()).getByRole('button', { name: '返信を取り下げる' }),
    )
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: '取り下げる',
      }),
    )

    // Assert
    expect(await screen.findByText('返信を取り下げました。')).toBeVisible()
    expect((await storedReviewOf(EXCELLENT)).ownerResponse).toBeNull()
  })

  it('should change nothing when the dialog of the withdrawal is left', async () => {
    // Arrange
    const user = userEvent.setup()
    await openReviewAs(EXCELLENT, OWNER)

    // Act
    await user.click(
      within(answerPart()).getByRole('button', { name: '返信を取り下げる' }),
    )
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: '戻る' }),
    )

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(within(answerPart()).getByText(ANSWER_OF_THE_SEED)).toBeVisible()
    expect((await storedReviewOf(EXCELLENT)).ownerResponse).toBe(
      ANSWER_OF_THE_SEED,
    )
  })

  it('should say in the dialog that the withdrawal could not be sent when the database fails', async () => {
    // Arrange
    const user = userEvent.setup()
    await openReviewAs(EXCELLENT, OWNER)
    await refuse('update', 'reviews')

    // Act
    await user.click(
      within(answerPart()).getByRole('button', { name: '返信を取り下げる' }),
    )
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: '取り下げる',
      }),
    )

    // Assert
    expect(
      await within(screen.getByRole('dialog')).findByRole('alert'),
    ).toHaveTextContent(
      '返信を取り下げられませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
  })

  it('should let a manager report a review with the details «その他» needs, and count the report on the review', async () => {
    // Arrange
    const user = userEvent.setup()
    await openReviewAs(GOOD, MANAGER)

    // Act
    await user.click(
      within(screen.getByRole('region', { name: '運営への通報' })).getByRole(
        'button',
        { name: '通報する' },
      ),
    )
    const dialog = screen.getByRole('dialog', { name: 'レビューを通報する' })
    await user.click(within(dialog).getByRole('radio', { name: 'その他' }))
    await user.click(within(dialog).getByRole('button', { name: '通報する' }))

    // Assert
    const details = within(dialog).getByRole('textbox', { name: '詳しい内容' })
    await waitFor(() => expect(details).toHaveFocus())
    expect(details).toHaveAccessibleDescription(
      /「その他」を選んだときは、何が問題かを入力してください。/,
    )
    expect(await storedReportsOf(GOOD)).toEqual([])

    // Act
    await user.type(details, '  来店のない日のレビューです。 ')
    await user.click(within(dialog).getByRole('button', { name: '通報する' }))

    // Assert
    expect(
      await screen.findByText('通報しました。運営が内容を確かめます。'),
    ).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() =>
      expect(detailsOf()).toContainEqual(['未処理の通報', '1 件']),
    )
    expect(await storedReportsOf(GOOD)).toEqual([
      {
        reason: 'other',
        details: '来店のない日のレビューです。',
        status: 'pending',
        reportedBy: MANAGER,
      },
    ])
    expect((await storedReviewOf(GOOD)).reportCount).toBe(1)
  })

  it('should say that the account reported the review before, and offer to close the dialog alone', async () => {
    // Arrange
    const user = userEvent.setup()
    await openReviewAs(GOOD, OWNER)
    const report = async (): Promise<HTMLElement> => {
      await user.click(
        within(screen.getByRole('region', { name: '運営への通報' })).getByRole(
          'button',
          { name: '通報する' },
        ),
      )
      const dialog = screen.getByRole('dialog', { name: 'レビューを通報する' })
      await user.click(
        within(dialog).getByRole('radio', { name: '事実と違う内容' }),
      )
      await user.click(within(dialog).getByRole('button', { name: '通報する' }))

      return dialog
    }
    await report()
    await screen.findByText('通報しました。運営が内容を確かめます。')

    // Act
    const dialog = await report()

    // Assert
    expect(await within(dialog).findByRole('status')).toHaveTextContent(
      'このアカウントでは、このレビューをもう通報しています。',
    )
    // The focus is on the answer, which took the place of the form
    expect(within(dialog).getByRole('status').parentElement).toHaveFocus()
    expect(await storedReportsOf(GOOD)).toHaveLength(1)
  })

  it('should say in the dialog that the report could not be sent when the database fails', async () => {
    // Arrange
    const user = userEvent.setup()
    await openReviewAs(GOOD, OWNER)
    await refuse('insert', 'review_reports')

    // Act
    await user.click(
      within(screen.getByRole('region', { name: '運営への通報' })).getByRole(
        'button',
        { name: '通報する' },
      ),
    )
    const dialog = screen.getByRole('dialog', { name: 'レビューを通報する' })
    await user.click(
      within(dialog).getByRole('radio', {
        name: '宣伝や、来店と関係のない内容',
      }),
    )
    await user.click(within(dialog).getByRole('button', { name: '通報する' }))

    // Assert
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '通報を送れませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
  })

  it.each<[string, () => Promise<string>]>([
    ['a review of another salon', () => reviewAt('Great experience')],
    [
      'an ID of no review',
      async () =>
        reviewHrefOf(
          await salonIdOf(TOKYO),
          '00000000-0000-4000-8000-000000000000',
        ),
    ],
    [
      'a review removed',
      async () => {
        const address = await reviewAt(SATISFIED)
        await reviewRemovedMeanwhile(SATISFIED)

        return address
      },
    ],
  ])('should say that %s is not found', async (_, addressOf) => {
    // Arrange
    await openAs(await addressOf(), STYLIST)

    // Assert
    expect(await heading('レビューが見つかりません')).toBeVisible()
  })

  it.each<[string, () => Promise<string>, () => Promise<unknown>]>([
    [
      'the reviews',
      async () => reviewsHrefOf(await salonIdOf(TOKYO)),
      () => screen.findByRole('table', { name: 'レビュー' }),
    ],
    [
      'a review with its dialogs closed',
      () => reviewAt(GOOD),
      () => screen.findByRole('link', { name: SAKURA.name }),
    ],
    [
      'the answer to a review',
      async () =>
        reviewResponseHrefOf(await salonIdOf(TOKYO), await reviewIdOf(GOOD)),
      () => screen.findByRole('textbox', { name: '返信' }),
    ],
  ])('should show %s accessibly', async (_, pathOf, opened) => {
    // Arrange
    await openAs(await pathOf(), OWNER)
    await opened()

    // Act
    const violations = await findAccessibilityViolations(document.body)

    // Assert
    expect(violations).toEqual([])
  })
})
