import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as bookingRecordStories from './booking-record.stories'

const stories = composeStories(bookingRecordStories)

/** The terms of a part of the record, each with what it says. */
const termsOf = (name: string): [string, string][] => {
  const part = screen.getByRole('region', { name })

  return within(part)
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])
}

const linesOf = (): string[][] =>
  within(screen.getByRole('table', { name: '施術明細' }))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      [
        ...within(row).getAllByRole('rowheader'),
        ...within(row).getAllByRole('cell'),
      ].map((cell) => cell.textContent ?? ''),
    )

describe('BookingRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say who comes when, with whom, and what is empty', async () => {
    // Act
    await stories.Pending.run()

    // Assert
    expect(termsOf('予約')).toEqual([
      ['予約番号', 'BK-4F7H-2KQM'],
      ['来店日', '2026年11月20日（金）'],
      ['時刻', '10:00〜11:00'],
      ['お客様', '山田 花子'],
      ['お客様の電話番号', '090-1234-5678'],
      ['担当', '田中 美咲'],
      ['お客様の要望', '前髪は、眉が隠れるくらいの長さにしたいです。'],
      ['サロン内のメモ', 'なし'],
      ['受付の経路', '記録なし'],
      ['予約金', '記録なし'],
    ])
    expect(linesOf()).toEqual([
      ['カット', '田中 美咲', '10:00〜11:00', '￥5,500（税込）', '未'],
    ])
    expect(termsOf('金額')).toEqual([
      ['小計', '￥5,500'],
      ['割引', '￥0'],
      ['消費税', '￥0'],
      ['合計', '￥5,500'],
    ])
  })

  it('should show the services in the order of the booking, how the booking came, and what actually happened', async () => {
    // Act
    await stories.Completed.run()

    // Assert
    expect(linesOf()).toEqual([
      ['カット', '田中 美咲', '10:00〜11:00', '￥5,500（税込）', '済み'],
      [
        'カラー',
        '未定',
        '11:00〜12:30',
        '￥7,800（割引 ￥1,000）（税込）',
        '済み',
      ],
    ])
    expect(termsOf('予約').slice(-6)).toEqual([
      ['サロン内のメモ', '次回はトリートメントを提案する。'],
      ['受付の経路', '電話'],
      ['予約金', '￥2,000'],
      ['実際の開始', '2026年11月20日（金） 10:05'],
      ['実際の終了', '2026年11月20日（金） 12:40'],
      ['完了を記録した日時', '2026年11月20日（金） 12:45'],
    ])
  })

  it('should lead from the service of each line to the page of the line', async () => {
    // Act
    await stories.Completed.run()

    // Assert
    expect(
      within(screen.getByRole('table', { name: '施術明細' }))
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      [
        'カット',
        '/salons/3b8e2f4a-6c1d-4e9b-8a7f-2d5c9e1b4a60/bookings/d2a05e8b/services/b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
      ],
      [
        'カラー',
        '/salons/3b8e2f4a-6c1d-4e9b-8a7f-2d5c9e1b4a60/bookings/d2a05e8b/services/a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      ],
    ])
  })

  it('should say when and why a booking was cancelled, and who is gone', async () => {
    // Act
    await stories.Cancelled.run()

    // Assert
    const terms = termsOf('予約')
    expect(terms).toContainEqual(['お客様', '削除された顧客'])
    expect(terms.map(([term]) => term)).not.toContain('お客様の電話番号')
    expect(terms).toContainEqual(['担当', '一覧にないスタッフ'])
    expect(terms.slice(-2)).toEqual([
      ['キャンセルした日時', '2026年11月19日（木） 15:30'],
      ['キャンセルの理由', '体調不良のため'],
    ])
  })
})
