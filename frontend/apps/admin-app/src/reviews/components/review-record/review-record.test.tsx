import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import { customers, salon } from '../../../bookings/components/examples'
import { answeredReview } from '../examples'
import * as reviewRecordStories from './review-record.stories'

const stories = composeStories(reviewRecordStories)

/** Each term with its description, in the order they are shown */
const details = (): string[][] => {
  const descriptions = screen.getAllByRole('definition')

  return screen
    .getAllByRole('term')
    .map((term, index) => [
      term.textContent ?? '',
      descriptions[index]?.textContent ?? '',
    ])
}

describe('ReviewRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say the rating and the day, what the customer wrote, and the rest of the review', async () => {
    // Act
    await stories.Rated.run()

    // Assert
    expect(screen.getByRole('heading', { name: 'レビュー' })).toBeVisible()
    expect(screen.getByRole('img', { name: '5 段階中 5.0' })).toBeVisible()
    expect(screen.getByText('2026年11月18日（水）')).toHaveAttribute(
      'datetime',
      answeredReview.createdAt,
    )
    expect(screen.getByText('来店確認済み')).toBeVisible()
    expect(screen.getByText('仕上がりに大満足')).toBeVisible()
    expect(screen.getByText(/カウンセリングが丁寧で/).textContent).toBe(
      answeredReview.comment,
    )
    expect(details()).toEqual([
      ['サービスの評価', '5'],
      ['スタッフの評価', '5'],
      ['雰囲気の評価', '4'],
      ['清潔さの評価', '5'],
      ['価格の評価', '4'],
      ['お客様', '山田 花子'],
      ['予約', '来店の予約'],
      ['担当スタッフ', '田中 美咲'],
      ['投稿日時', '2026年11月18日（水） 18:30'],
      ['写真', 'https://images.example.com/reviews/after.jpg'],
      ['参考になった', '3 人'],
      ['未処理の通報', 'なし'],
    ])
    expect(screen.getByRole('link', { name: '山田 花子' })).toHaveAttribute(
      'href',
      `/salons/${salon.id}/customers/${customers[0]?.id}`,
    )
    expect(screen.getByRole('link', { name: '来店の予約' })).toHaveAttribute(
      'href',
      `/salons/${salon.id}/bookings/${answeredReview.bookingId}`,
    )
    expect(
      screen.getByRole('link', {
        name: 'https://images.example.com/reviews/after.jpg',
      }),
    ).toHaveAttribute('rel', 'noreferrer nofollow ugc')
  })

  it('should say which sides the customer did not rate, that nobody was named, when it was changed and how many reports wait', async () => {
    // Act
    await stories.Reported.run()

    // Assert
    expect(screen.getByText('来店確認済み')).toBeVisible()
    expect(details()).toEqual([
      ['サービスの評価', '4'],
      ['スタッフの評価', '評価なし'],
      ['雰囲気の評価', '3'],
      ['清潔さの評価', '評価なし'],
      ['価格の評価', '評価なし'],
      ['お客様', '鈴木 一郎'],
      ['予約', '来店の予約'],
      ['担当スタッフ', '指名なし'],
      ['投稿日時', '2026年11月20日（金） 14:00'],
      ['修正日時', '2026年11月20日（金） 15:15'],
      ['参考になった', '0 人'],
      ['未処理の通報', '1 件'],
    ])
  })

  it('should say that the customer was removed from the ledger, and name no member while the staff are read', async () => {
    // Act
    await stories.AuthorGone.run()

    // Assert
    expect(details()).toContainEqual(['お客様', '台帳から削除されたお客様'])
    expect(details()).toContainEqual(['担当スタッフ', ''])
    expect(screen.queryByRole('link', { name: '山田 花子' })).toBeNull()
  })

  it('should say that the customer could not be read', async () => {
    // Act
    await stories.AuthorUnread.run()

    // Assert
    expect(details()).toContainEqual(['お客様', '読み込めませんでした'])
  })

  it('should say that a review has no comment', async () => {
    // Act
    await stories.WithoutComment.run()

    // Assert
    expect(screen.getByText('ヘッドスパが気持ちよかった')).toBeVisible()
    expect(screen.getByText('コメントなし')).toBeVisible()
  })

  it('should show an address that is none of the web as text, not as a link', async () => {
    // Act
    await stories.Rated.run({
      args: {
        ...stories.Rated.args,
        review: { ...answeredReview, imageUrls: ['javascript:alert(1)'] },
      },
    })

    // Assert
    expect(details()).toContainEqual(['写真', 'javascript:alert(1)'])
    expect(screen.queryByRole('link', { name: /javascript/ })).toBeNull()
  })
})

describe('ReviewRecord on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say the rating, the day and the rest of the review in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Rated.run()

    // Assert
    expect(screen.getByRole('heading', { name: 'Review' })).toBeVisible()
    expect(screen.getByRole('img', { name: '5.0 out of 5' })).toBeVisible()
    expect(screen.getByText('Wed, November 18, 2026')).toBeVisible()
    expect(screen.getByText('Verified visit')).toBeVisible()
    expect(details()).toEqual([
      ['Service rating', '5'],
      ['Staff rating', '5'],
      ['Atmosphere rating', '4'],
      ['Cleanliness rating', '5'],
      ['Value rating', '4'],
      ['Customer', '山田 花子'],
      ['Booking', 'Booking of the visit'],
      ['Staff member', '田中 美咲'],
      ['Posted', 'Wed, November 18, 2026 at 18:30'],
      ['Pictures', 'https://images.example.com/reviews/after.jpg'],
      ['Found helpful by', '3 people'],
      ['Pending reports', 'None'],
    ])
  })

  it('should say what the customer did not rate, that nobody was named and what reports wait, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Reported.run()

    // Assert
    expect(details()).toEqual([
      ['Service rating', '4'],
      ['Staff rating', 'Not rated'],
      ['Atmosphere rating', '3'],
      ['Cleanliness rating', 'Not rated'],
      ['Value rating', 'Not rated'],
      ['Customer', '鈴木 一郎'],
      ['Booking', 'Booking of the visit'],
      ['Staff member', 'No staff member'],
      ['Posted', 'Fri, November 20, 2026 at 14:00'],
      ['Edited', 'Fri, November 20, 2026 at 15:15'],
      ['Found helpful by', '0 people'],
      ['Pending reports', '1 report'],
    ])
  })

  it.each<['AuthorGone' | 'AuthorUnread', string]>([
    ['AuthorGone', 'Removed from the ledger'],
    ['AuthorUnread', 'Could not be loaded'],
  ])(
    'should say in English of the story %s who wrote it',
    async (story, customer) => {
      // Arrange
      languageStore.choose('en')

      // Act
      await stories[story].run()

      // Assert
      expect(details()).toContainEqual(['Customer', customer])
    },
  )
})
