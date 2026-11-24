import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import { salon } from '../../../bookings/components/examples'
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
      ['支払い方法', '支払い方法を見る'],
    ])
    expect(
      screen.getByRole('link', { name: '支払い方法を見る' }),
    ).toHaveAttribute('href', `/salons/${salon.id}/settings/payment-methods`)
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

describe('SalonRecord on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say everything the salon keeps of itself, card by card, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Recorded.run()

    // Assert
    expect(termsOf('Salon')).toEqual([
      ['Name', 'Salon Hikari 表参道店'],
      ['Name in kana', 'サロン ヒカリ オモテサンドウテン'],
      ['Introduction', '表参道の駅から歩いて 3 分です。\n個室もあります。'],
      ['Online booking', 'Accepted'],
      ['Rating', '4.5 (12 reviews)'],
    ])
    expect(termsOf('Location').map(([term]) => term)).toEqual([
      'Postal code',
      'Prefecture',
      'City',
      'Street address',
      'Building',
      'Place on the map',
    ])
    expect(termsOf('Location')).toContainEqual([
      'Place on the map',
      'Latitude 35.665, longitude 139.7121',
    ])
    expect(termsOf('Contact').map(([term]) => term)).toEqual([
      'Phone number',
      'Alternative phone number',
      'Email address',
      'Website',
    ])
    expect(termsOf('Photos').map(([term]) => term)).toEqual([
      'Logo URL',
      'Photo URLs',
    ])
    expect(screen.getByRole('list', { name: 'Amenities' })).toBeInTheDocument()
    expect(termsOf('Accounting')).toEqual([
      ['Time zone', 'Asia/Tokyo'],
      ['Currency', 'JPY'],
      ['Tax rate', '10%'],
      ['Payment methods', 'See the payment methods'],
    ])
  })

  it('should say the week and the dates of the calendar in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Recorded.run()

    // Assert
    expect(rowsOf('Hours')).toEqual([
      ['Monday', '10:00–20:00 (break 13:00–14:00)'],
      ['Tuesday', '10:00–20:00'],
      ['Wednesday', '10:00–20:00'],
      ['Thursday', '10:00–20:00'],
      ['Friday', '10:00–20:00'],
      ['Saturday', '09:00–18:00'],
      ['Sunday', 'Closed'],
    ])
    expect(rowsOf('Calendar')).toEqual([
      ['Mon, November 23, 2026', '10:00–17:00', '勤労感謝の日', '短縮営業'],
      ['Thu, December 31, 2026', 'Closed all day', '年末年始', 'Not recorded'],
    ])
  })

  it('should say in English what is not recorded, and that the week decides', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.LittleRecorded.run()

    // Assert
    expect(termsOf('Salon')).toContainEqual(['Rating', 'None yet'])
    expect(termsOf('Features and amenities')).toEqual([
      ['Features', 'None'],
      ['Amenities', 'None'],
    ])
    expect(
      within(screen.getByRole('table', { name: 'Calendar' })).getByText(
        'No dates from today on. The salon keeps the hours of the days of the week.',
      ),
    ).toBeInTheDocument()
  })

  it('should say in English that the salon has stopped taking bookings online', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.NotBookedOnline.run()

    // Assert
    expect(termsOf('Salon')).toContainEqual(['Online booking', 'Paused'])
  })
})
