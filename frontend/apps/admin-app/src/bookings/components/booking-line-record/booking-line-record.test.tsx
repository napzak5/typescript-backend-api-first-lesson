import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as bookingLineRecordStories from './booking-line-record.stories'

const stories = composeStories(bookingLineRecordStories)

const terms = (): [string, string][] =>
  within(screen.getByRole('region', { name: '施術明細' }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

describe('BookingLineRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say what the line is, who does it, when, what it costs, and that it is not done', async () => {
    // Act
    await stories.Waiting.run()

    // Assert
    expect(terms()).toEqual([
      ['メニュー', 'カット'],
      ['担当', '田中 美咲'],
      ['時刻', '2026年11月20日（金） 10:00〜11:00'],
      ['所要時間', '60 分'],
      ['料金', '￥5,500'],
      ['割引', '￥0'],
      ['支払う額', '￥5,500（税込）'],
      ['完了', '未'],
      ['メモ', '記録なし'],
    ])
  })

  it('should say that the service and the member of a line are gone', async () => {
    // Act
    await stories.OfWhatIsGone.run()

    // Assert
    expect(terms().slice(0, 2)).toEqual([
      ['メニュー', '削除されたメニュー'],
      ['担当', '一覧にないスタッフ'],
    ])
  })

  it('should say the discount, a price without the tax, that nobody does it, when it was done, and the note', async () => {
    // Act
    await stories.Done.run()

    // Assert
    expect(terms()).toEqual([
      ['メニュー', 'カラー'],
      ['担当', '未定'],
      ['時刻', '2026年11月20日（金） 11:00〜12:30'],
      ['所要時間', '90 分'],
      ['料金', '￥8,800'],
      ['割引', '￥1,000'],
      ['支払う額', '￥7,800（税別）'],
      ['完了', '済み（2026年11月20日（金） 12:35）'],
      ['メモ', '根元だけ'],
    ])
  })
})

describe('BookingLineRecord on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say what the line is, who does it, when and what it costs, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Done.run()

    // Assert
    expect(
      within(screen.getByRole('region', { name: 'Service line' }))
        .getAllByRole('term')
        .map((term) => [
          term.textContent,
          term.nextElementSibling?.textContent,
        ]),
    ).toEqual([
      ['Service', 'カラー'],
      ['Staff', 'Unassigned'],
      ['Time', 'Fri, November 20, 2026, 11:00–12:30'],
      ['Duration', '90 min'],
      ['Price', '¥8,800'],
      ['Discount', '¥1,000'],
      ['Amount to pay', '¥7,800 (before tax)'],
      ['Done', 'Done (Fri, November 20, 2026 at 12:35)'],
      ['Notes', '根元だけ'],
    ])
  })
})
