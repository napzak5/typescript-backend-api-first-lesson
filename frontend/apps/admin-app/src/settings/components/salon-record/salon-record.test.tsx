import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as salonRecordStories from './salon-record.stories'

const stories = composeStories(salonRecordStories)

/** The terms of a card and what each says */
const termsOf = (card: string): [string | null, string | null][] => {
  const region = screen.getByRole('region', { name: card })

  return within(region)
    .getAllByRole('term')
    .map((term) => [
      term.textContent,
      term.nextElementSibling?.textContent ?? null,
    ])
}

/** The rows of a table, each as the texts of its cells */
const rowsOf = (caption: string): (string | null)[][] =>
  within(screen.getByRole('table', { name: caption }))
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      [
        ...within(row).queryAllByRole('rowheader'),
        ...within(row).queryAllByRole('cell'),
      ].map((cell) => cell.textContent),
    )

describe('SalonRecord', () => {
  it('should show what the salon is, where it is and how it is reached', async () => {
    // Act
    await stories.Recorded.run()

    // Assert
    expect(termsOf('サロン')).toEqual([
      ['名前', 'Salon Hikari 表参道店'],
      ['カナ', 'サロン ヒカリ オモテサンドウテン'],
      ['紹介', '表参道の駅から歩いて 3 分です。\n個室もあります。'],
      ['オンライン予約', '受け付ける'],
      ['評価', '4.5（12 件のレビュー）'],
    ])
    expect(termsOf('所在地')).toEqual([
      ['郵便番号', '150-0001'],
      ['都道府県', '東京都'],
      ['市区町村', '渋谷区'],
      ['町名・番地', '神宮前 4-1-1'],
      ['建物', '光ビル 2 階'],
      ['地図の位置', '緯度 35.665、経度 139.7121'],
    ])
    expect(termsOf('連絡先')).toEqual([
      ['電話番号', '03-1234-5678'],
      ['予備の電話番号', '090-1234-5678'],
      ['メールアドレス', 'omotesando@example.com'],
      ['公式サイト', 'https://hikari.example.com'],
    ])
    expect(termsOf('写真')).toEqual([
      ['ロゴの URL', 'https://hikari.example.com/logo.png'],
      [
        '写真の URL',
        'https://hikari.example.com/photos/entrance.jpghttps://hikari.example.com/photos/seats.jpg',
      ],
    ])
    expect(
      within(screen.getByRole('list', { name: '設備' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Wi-Fi', '個室'])
    expect(termsOf('会計')).toEqual([
      ['タイムゾーン', 'Asia/Tokyo'],
      ['通貨', 'JPY'],
      ['税率', '10%'],
    ])
  })

  it('should show the week from Monday and the dates of the calendar from today', async () => {
    // Act
    await stories.Recorded.run()

    // Assert
    expect(rowsOf('営業時間')).toEqual([
      ['月曜日', '10:00〜20:00（休憩 13:00〜14:00）'],
      ['火曜日', '10:00〜20:00'],
      ['水曜日', '10:00〜20:00'],
      ['木曜日', '10:00〜20:00'],
      ['金曜日', '10:00〜20:00'],
      ['土曜日', '09:00〜18:00'],
      ['日曜日', '休業'],
    ])
    expect(rowsOf('営業日カレンダー')).toEqual([
      ['2026年11月23日（月）', '10:00〜17:00', '勤労感謝の日', '短縮営業'],
      ['2026年12月31日（木）', '終日休業', '年末年始', '記録なし'],
    ])
  })

  it('should say what is not recorded, and that the week decides when there are no dates', async () => {
    // Act
    await stories.LittleRecorded.run()

    // Assert
    expect(termsOf('サロン')).toEqual([
      ['名前', 'Salon Hikari 表参道店'],
      ['カナ', '記録なし'],
      ['紹介', '記録なし'],
      ['オンライン予約', '受け付ける'],
      ['評価', 'まだありません'],
    ])
    expect(termsOf('特徴と設備')).toEqual([
      ['特徴', 'なし'],
      ['設備', 'なし'],
    ])
    expect(new Set(rowsOf('営業時間').map(([, hours]) => hours))).toEqual(
      new Set(['休業']),
    )
    expect(
      within(screen.getByRole('table', { name: '営業日カレンダー' })).getByText(
        '今日からの日付はありません。曜日ごとの営業時間で営業します。',
      ),
    ).toBeInTheDocument()
  })

  it('should say that the salon has stopped taking bookings online', async () => {
    // Act
    await stories.NotBookedOnline.run()

    // Assert
    expect(termsOf('サロン')).toContainEqual(['オンライン予約', '止めている'])
  })

  itShouldBeAccessibleInEveryStory(stories)
})
