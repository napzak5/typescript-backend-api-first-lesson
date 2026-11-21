import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as staffRecordStories from './staff-record.stories'

const stories = composeStories(staffRecordStories)

/** The terms of a card with what they say, in their order. */
const termsOf = (title: string): [string | null, string | null][] => {
  const card = screen.getByRole('region', { name: title })

  return within(card)
    .getAllByRole('term')
    .map((term) => [
      term.textContent,
      term.nextElementSibling?.textContent ?? null,
    ])
}

describe('StaffRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show everything the ledger keeps of a member, card by card', async () => {
    // Act
    await stories.Full.run()

    // Assert
    expect(termsOf('スタッフ')).toEqual([
      ['表示名', '田中 美咲'],
      ['氏名', '田中 美咲（タナカ ミサキ）'],
      ['スタッフコード', 'STF010'],
      ['レベル', 'シニア'],
      ['役職', 'トップスタイリスト'],
      ['状態', '有効'],
      ['ログインアカウント', '紐づいています'],
      ['登録した日時', '2026年4月1日（水） 09:00'],
    ])
    expect(termsOf('連絡先')).toEqual([
      ['メールアドレス', 'misaki.tanaka@example.com'],
      ['電話番号', '090-1234-5678'],
      ['予備の電話番号', '記録なし'],
    ])
    expect(termsOf('雇用')).toEqual([
      ['雇用形態', '正社員'],
      ['入社日', '2018年4月1日（日）'],
      ['基本給', '￥280,000'],
      ['歩合率', '12.5%'],
    ])
    expect(termsOf('紹介')).toEqual([
      ['専門', 'カットカラー'],
      ['資格', '美容師免許管理美容師'],
      ['経験年数', '8 年'],
      [
        '紹介文',
        'ショートカットと、透明感のあるカラーが得意です。\nお気軽にご相談ください。',
      ],
      ['写真の URL', 'https://photos.example.com/staff/misaki.jpg'],
    ])
    expect(termsOf('予約の受け方')).toEqual([
      ['予約', '受ける'],
      ['同時に担当できる予約', '2 件まで'],
      ['予約の前に確保する時間', 'なし'],
      ['予約の後に確保する時間', '15 分'],
    ])
    expect(
      within(screen.getByRole('list', { name: '専門' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['カット', 'カラー'])
  })

  it('should say what the ledger does not have of a member', async () => {
    // Act
    await stories.Sparse.run()

    // Assert
    expect(termsOf('スタッフ')).toContainEqual(['スタッフコード', '記録なし'])
    expect(termsOf('スタッフ')).toContainEqual(['状態', '無効'])
    expect(termsOf('スタッフ')).toContainEqual([
      'ログインアカウント',
      '紐づいていません',
    ])
    expect(termsOf('雇用')).toEqual([
      ['雇用形態', '記録なし'],
      ['入社日', '記録なし'],
      ['基本給', '記録なし'],
      ['歩合率', '記録なし'],
    ])
    expect(termsOf('紹介')).toEqual([
      ['専門', 'なし'],
      ['資格', 'なし'],
      ['経験年数', '記録なし'],
      ['紹介文', '記録なし'],
      ['写真の URL', '記録なし'],
    ])
    expect(termsOf('予約の受け方')).toContainEqual(['予約', '受けない'])
  })

  it('should offer what can be done with the member', async () => {
    // Act
    await stories.Full.run()

    // Assert
    const card = screen.getByRole('region', { name: 'スタッフ' })
    expect(
      within(card).getByRole('link', { name: 'スタッフ情報を直す' }),
    ).toBeVisible()
    expect(within(card).getByRole('button', { name: '削除' })).toBeVisible()
  })
})
