import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as customerHistoryStories from './customer-history.stories'

const stories = composeStories(customerHistoryStories)

describe('CustomerHistory', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show each version, what made it, when, by whom and the items of the ledger it changed', async () => {
    // Act
    await stories.Versions.run()
    const table = screen.getByRole('table', { name: '版の一覧' })

    // Assert
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((header) => header.textContent),
    ).toEqual(['版 4', '版 3', '版 2', '版 1'])
    expect(rowsOf(table)).toEqual([
      [
        '版 4',
        '更新',
        '2026年11月19日（木） 10:15',
        'あなた',
        '電話番号、住所',
      ],
      [
        '版 3',
        '更新',
        '2026年11月18日（水） 18:00',
        'ほかのアカウント',
        'なし',
      ],
      [
        '版 2',
        '更新',
        '2026年11月18日（水） 14:30',
        'お客様ご本人',
        '好みのメニュー、好みについてのメモ',
      ],
      ['版 1', '記録の開始', '2026年11月1日（日） 09:00', '', ''],
    ])
    expect(screen.getByText('4 件')).toBeVisible()
    expect(screen.getByRole('link', { name: '版 3' })).toHaveAttribute(
      'href',
      stories.Versions.args.versionHref?.(3),
    )
  })

  it('should ask for the versions that come next', async () => {
    // Arrange
    await stories.More.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(stories.More.args.onMore).toHaveBeenCalledTimes(1)
  })
})
