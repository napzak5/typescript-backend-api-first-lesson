import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import { forTheCustomer } from '../examples'
import * as shareLinkListStories from './share-link-list.stories'

const stories = composeStories(shareLinkListStories)

const part = () => screen.getByRole('region', { name: '共有リンク' })

describe('ShareLinkList', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list each link with when it was issued, when it ends, its downloads, its password and its state, the latest first', async () => {
    // Act
    await stories.Listed.run()

    // Assert
    const table = screen.getByRole('table', { name: '発行した共有リンク' })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['発行日時', '有効期限', 'ダウンロード', 'パスワード', '状態'])
    expect(rowsOf(table)).toEqual([
      [
        '2026年11月21日（土） 09:40',
        '2026年11月28日（土） 09:40',
        '1 回（上限 3 回）',
        'あり',
        '使える',
      ],
      [
        '2026年11月20日（金） 11:00',
        '2026年11月24日（火） 11:00',
        '1 回（上限 1 回）',
        'なし',
        '回数の上限に達した',
      ],
      [
        '2026年11月19日（木） 09:00',
        '2026年11月20日（金） 09:00',
        '4 回（上限なし）',
        'なし',
        '期限切れ',
      ],
    ])
    expect(
      within(table).getByRole('link', { name: '2026年11月21日（土） 09:40' }),
    ).toHaveAttribute(
      'href',
      expect.stringMatching(new RegExp(`/share-links/${forTheCustomer.id}$`)),
    )
    expect(screen.getByText('3 件')).toBeVisible()
  })

  it('should offer to issue a link, and say what a link is', async () => {
    // Act
    await stories.Listed.run()

    // Assert
    expect(
      within(part()).getByRole('link', { name: '共有リンクを発行する' }),
    ).toHaveAttribute('href', expect.stringMatching(/\/share-links\/new$/))
    expect(within(part()).getByText(/アカウントを持たない人/)).toBeVisible()
  })

  it('should ask for the links that come next', async () => {
    // Arrange
    await stories.More.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(stories.More.args.onMore).toHaveBeenCalledOnce()
  })

  it('should say that a file has no link, and how to issue one', async () => {
    // Act
    await stories.NoneIssued.run()

    // Assert
    expect(screen.getByText('共有リンクはありません')).toBeVisible()
    expect(screen.queryByRole('table')).toBeNull()
    expect(
      screen.getByRole('link', { name: '共有リンクを発行する' }),
    ).toBeVisible()
  })

  it('should offer to read the links again when they could not be read', async () => {
    // Arrange
    await stories.Unread.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: /もう一度/ }))

    // Assert
    expect(stories.Unread.args.onRetry).toHaveBeenCalledOnce()
  })

  it.each<[string, keyof typeof stories, RegExp]>([
    [
      'a member of the staff who shares no file',
      'NotTheirsToShare',
      /オーナー、マネージャー、管理者/,
    ],
    [
      'a file whose upload was not finished',
      'NotUploaded',
      /アップロードが済んでいない/,
    ],
  ])('should tell %s why there is nothing to issue', async (_, story, said) => {
    // Act
    await stories[story].run()

    // Assert
    expect(within(part()).getByText(said)).toBeVisible()
    expect(within(part()).queryByRole('link')).toBeNull()
    expect(within(part()).queryByRole('table')).toBeNull()
  })
})
