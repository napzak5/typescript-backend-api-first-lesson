import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { columnsOf, rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
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

describe('CustomerHistory on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should show each version, what made it, when, by whom and what it changed, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Versions.run()

    // Assert
    expect(columnsOf('Versions')).toEqual([
      'Version',
      'Operation',
      'Date and time',
      'Changed by',
      'Changed items',
    ])
    expect(rowsOf('Versions')).toEqual([
      [
        'Version 4',
        'Updated',
        'Thu, November 19, 2026 at 10:15',
        'You',
        'Phone number, Address',
      ],
      [
        'Version 3',
        'Updated',
        'Wed, November 18, 2026 at 18:00',
        'Another account',
        'None',
      ],
      [
        'Version 2',
        'Updated',
        'Wed, November 18, 2026 at 14:30',
        'The customer',
        'Favorite services, Notes on preferences',
      ],
      [
        'Version 1',
        'Start of the record',
        'Sun, November 1, 2026 at 09:00',
        '',
        '',
      ],
    ])
    expect(screen.getByRole('status').textContent).toBe('4 items')
  })
})
