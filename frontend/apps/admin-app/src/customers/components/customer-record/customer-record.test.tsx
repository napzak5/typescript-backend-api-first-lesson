import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import { aCustomer, salon } from '../../../bookings/components/examples'
import * as customerRecordStories from './customer-record.stories'

const stories = composeStories(customerRecordStories)

const card = (name: string): HTMLElement => screen.getByRole('region', { name })

/** The terms of a list and what they say, in their order */
const itemsOf = (scope: HTMLElement): [string | null, string | null][] =>
  within(scope)
    .getAllByRole('term')
    .map((term) => [
      term.textContent,
      term.nextElementSibling?.textContent ?? null,
    ])

const CUSTOMER = `/salons/${salon.id}/customers`

describe('CustomerRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say of a customer of whom little is recorded what is missing', async () => {
    // Act
    await stories.Few.run()

    // Assert
    expect(itemsOf(card('台帳'))).toEqual([
      ['お名前', '山田 花子'],
      ['フリガナ', 'ヤマダ ハナコ'],
      ['メールアドレス', 'hanako@example.com'],
      ['電話番号', '090-1234-5678'],
      ['予備の電話番号', '未登録'],
      ['住所', '未登録'],
      ['生年月日', '未登録'],
      ['性別', '未登録'],
      ['職業', '未登録'],
      ['髪と頭皮', '未登録'],
      ['好みのメニュー', '未登録'],
      ['好みについてのメモ', '未登録'],
      ['会員ランク', 'レギュラー'],
      ['ステータス', '通常'],
      ['有効', '有効'],
      ['タグ', 'なし'],
      ['紹介コード', '未発行'],
      ['紹介元', 'なし'],
      ['送ってよい連絡', 'メール'],
      ['備考', '未登録'],
      ['スタッフ間の申し送り', '未登録'],
      ['登録日時', '2026年1月10日（土） 09:00'],
      ['最後に直した日時', '2026年1月10日（土） 09:00'],
    ])
    expect(itemsOf(card('来店とポイント'))).toEqual([
      ['初回来店日', '来店なし'],
      ['最終来店日', '来店なし'],
      ['来店回数', '0 回'],
      ['無断キャンセル', '0 回'],
      ['キャンセル', '0 回'],
      ['ポイント', '0 ポイント'],
    ])
  })

  it('should show everything that is recorded, the tags as a list and the notes with their lines', async () => {
    // Act
    await stories.Recorded.run()

    // Assert
    expect(itemsOf(card('台帳'))).toEqual([
      ['お名前', '山田 花子'],
      ['フリガナ', 'ヤマダ ハナコ'],
      ['メールアドレス', 'hanako@example.com'],
      ['電話番号', '090-1234-5678'],
      ['予備の電話番号', '03-1234-5678'],
      ['住所', '〒150-0001 東京都渋谷区神宮前 4-1-1 ハイツ 101'],
      ['生年月日', '1990年4月1日（日）'],
      ['性別', '女性'],
      ['職業', '会社員'],
      ['髪と頭皮', 'ウェーブ、細い髪、頭皮は敏感'],
      ['好みのメニュー', 'カット、スパ'],
      ['好みについてのメモ', '炭酸泉が好き'],
      ['会員ランク', 'ゴールド'],
      ['ステータス', 'VIP'],
      ['有効', '有効'],
      ['タグ', 'VIP常連'],
      ['紹介コード', 'HANAKO-2026'],
      ['紹介元', '紹介したお客様'],
      ['送ってよい連絡', 'メール、SMS'],
      ['備考', '駐車場を使う。\n次回は 2 台分。'],
      ['スタッフ間の申し送り', '前回、カラーで頭皮がしみた'],
      ['登録日時', '2026年1月10日（土） 09:00'],
      ['最後に直した日時', '2026年11月18日（水） 14:30'],
    ])
    expect(
      within(screen.getByRole('list', { name: 'タグ' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['VIP', '常連'])
    expect(itemsOf(card('来店とポイント'))).toEqual([
      ['初回来店日', '2026年1月15日（木）'],
      ['最終来店日', '2026年11月18日（水）'],
      ['来店回数', '14 回'],
      ['無断キャンセル', '1 回'],
      ['キャンセル', '2 回'],
      ['ポイント', '1,250 ポイント'],
    ])
  })

  it('should lead to the customer who referred this one, to a booking of the customer and to the change of the ledger', async () => {
    // Act
    await stories.Recorded.run()

    // Assert
    expect(
      screen.getByRole('link', { name: '紹介したお客様' }),
    ).toHaveAttribute(
      'href',
      `${CUSTOMER}/c19f4d7a-6e8c-4adf-8dbe-ac7e3f6a8bc5`,
    )
    expect(screen.getByRole('link', { name: '予約を入れる' })).toHaveAttribute(
      'href',
      `/salons/${salon.id}/bookings/new?date=2026-11-20&customerId=${aCustomer().id}`,
    )
    expect(screen.getByRole('link', { name: '台帳を直す' })).toHaveAttribute(
      'href',
      `${CUSTOMER}/${aCustomer().id}/edit`,
    )
  })

  it('should say that a customer who is not active may not book by themselves', async () => {
    // Act
    await stories.Inactive.run()

    // Assert
    expect(itemsOf(card('台帳'))).toContainEqual([
      '有効',
      '無効（ご自分では予約を入れられません）',
    ])
    expect(itemsOf(card('台帳'))).toContainEqual(['ステータス', '利用停止'])
  })
})
