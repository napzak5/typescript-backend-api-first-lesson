import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as bookingSummaryStories from './booking-summary.stories'

const stories = composeStories(bookingSummaryStories)

/** The names and the values, as the list shows them. */
const details = (): Record<string, string | null> =>
  Object.fromEntries(
    screen
      .getAllByRole('term')
      .map((term) => [
        term.textContent,
        term.nextElementSibling?.textContent ?? null,
      ]),
  )

describe('BookingSummary', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say where the booking stands, where and what it is, with whom, when, what it comes to and what was asked for', async () => {
    // Act
    await stories.Pending.run()

    // Assert
    expect(details()).toEqual({
      状態: '確定待ちサロンが内容を確認すると、予約が確定します。',
      サロン: 'ヘアサロン こもれび 表参道',
      メニュー: 'レディースカット',
      担当: '田中 ひろし',
      日時: '2026年11月24日火曜日 10:30〜11:30（1 時間）',
      料金: '￥5,500',
      ご要望: '前髪は、眉が隠れるくらいの長さにしたいです。',
    })
  })

  it('should lead to the page of the salon', async () => {
    // Act
    await stories.Pending.run()

    // Assert
    expect(
      screen.getByRole('link', { name: 'ヘアサロン こもれび 表参道' }),
    ).toHaveAttribute('href', '/salons/0b7f5c1e-3a52-4d8e-9c41-6f2e8d1a7b90')
  })

  it.each([
    ['Confirmed', stories.Confirmed, '確定'],
    ['Completed', stories.Completed, '完了'],
    ['Cancelled', stories.Cancelled, 'キャンセル'],
    ['NoShow', stories.NoShow, '来店なし'],
  ])(
    'should say the state in a word, and nothing about what comes next, in the story %s',
    async (_name, story, word) => {
      // Act
      await story.run()

      // Assert
      expect(details()).toMatchObject({ 状態: word })
    },
  )

  it('should name the tax that was added to the amount', async () => {
    // Act
    await stories.WithTaxAdded.run()

    // Assert
    expect(details()).toMatchObject({ 料金: '￥6,050（うち消費税 ￥550）' })
  })

  it('should say that nothing was asked for', async () => {
    // Act
    await stories.WithoutRequest.run()

    // Assert
    expect(details()).toMatchObject({ ご要望: 'なし' })
  })

  it('should show a request with the lines it was written in', async () => {
    // Act
    await stories.WithLongRequest.run()

    // Assert
    expect(screen.getByText(/^前回と同じ長さでお願いします。/)).toHaveClass(
      'request',
    )
    expect(
      screen.getByText(/^前回と同じ長さでお願いします。/).textContent,
    ).toContain('お願いします。\n\nカラーの相談もしたいです。')
  })

  it('should tell the day alone, and neither a time nor an amount, of a booking whose salon is no longer there', async () => {
    // Act
    await stories.WithoutSalon.run()

    // Assert
    expect(details()).toEqual({
      状態: '確定待ちサロンが内容を確認すると、予約が確定します。',
      サロン: '（掲載を終えています）',
      メニュー: '（掲載を終えています）',
      担当: '（掲載を終えています）',
      日時: '2026年11月24日火曜日 （1 時間）',
      ご要望: '前髪は、眉が隠れるくらいの長さにしたいです。',
    })
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('should say that the salon no longer shows the service and the member of the staff, and show the rest', async () => {
    // Act
    await stories.NoLongerShown.run()

    // Assert
    expect(details()).toMatchObject({
      状態: '完了',
      メニュー: '（掲載を終えています）',
      担当: '（掲載を終えています）',
      日時: '2026年11月24日火曜日 10:30〜11:30（1 時間）',
    })
  })
})
