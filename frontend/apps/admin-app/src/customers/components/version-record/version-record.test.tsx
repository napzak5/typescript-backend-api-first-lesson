import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { columnsOf, rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as versionRecordStories from './version-record.stories'

const stories = composeStories(versionRecordStories)

describe('VersionRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say what made the version, and show what it changed beside what was there before', async () => {
    // Act
    await stories.Update.run()
    const changed = screen.getByRole('table', { name: '前の版から変えた項目' })

    // Assert
    expect(
      screen.getByText('版 4・更新・2026年11月18日（水） 14:30・あなた'),
    ).toBeVisible()
    expect(rowsOf(changed)).toEqual([
      ['電話番号', '090-1234-5678', '080-3333-4444'],
      ['住所', '記録なし', '〒150-0001 東京都渋谷区神宮前 4-1-1'],
      ['紹介元', 'なし', '紹介したお客様'],
    ])
    expect(
      within(screen.getByRole('region', { name: 'この版の台帳' })).getByText(
        '080-3333-4444',
      ),
    ).toBeVisible()
  })

  it('should say that an update changed no value', async () => {
    // Act
    await stories.Unchanged.run()

    // Assert
    expect(screen.getByText('前の版から、値は変わっていません。')).toBeVisible()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('should show only the values of a version that is the whole record, and name nobody for the values the history began with', async () => {
    // Act
    await stories.Registration.run()

    // Assert
    expect(
      screen.getByText('版 1・登録・2026年11月18日（水） 14:30・あなた'),
    ).toBeVisible()
    expect(screen.queryByRole('table')).toBeNull()

    // Act
    await stories.Baseline.run()

    // Assert
    expect(
      screen.getByText('版 1・記録の開始・2026年11月18日（水） 14:30'),
    ).toBeVisible()
  })
})

describe('VersionRecord on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say what made the version and what it changed, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Update.run()

    // Assert
    expect(
      screen.getByText(
        'Version 4 · Updated · Wed, November 18, 2026 at 14:30 · You',
      ),
    ).toBeVisible()
    expect(columnsOf('Items changed from the version before')).toEqual([
      'Item',
      'Version before',
      'This version',
    ])
    expect(rowsOf('Items changed from the version before')).toEqual([
      ['Phone number', '090-1234-5678', '080-3333-4444'],
      ['Address', 'Not recorded', '150-0001 東京都 渋谷区 神宮前 4-1-1'],
      ['Referred by', 'None', 'Referring customer'],
    ])
    expect(
      screen.getByRole('region', { name: 'The record in this version' }),
    ).toBeVisible()
  })

  it('should say in English that an update changed no value, and name nobody for the start', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Unchanged.run()

    // Assert
    expect(
      screen.getByText('No value changed from the version before.'),
    ).toBeVisible()
  })
})
