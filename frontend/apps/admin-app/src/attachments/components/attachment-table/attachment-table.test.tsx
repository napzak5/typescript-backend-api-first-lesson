import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as attachmentTableStories from './attachment-table.stories'

const stories = composeStories(attachmentTableStories)

describe('AttachmentTable', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list each file with its kind, its size, who uploaded it and when, the latest first', async () => {
    // Act
    await stories.Files.run()

    // Assert
    const table = screen.getByRole('table', { name: 'ファイル' })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual([
      'ファイル名',
      '種類',
      'サイズ',
      'アップロードした人',
      'アップロード日時',
    ])
    const rows = within(table).getAllByRole('row').slice(1)
    expect(
      rows.map((row) => [
        within(row).getByRole('rowheader').textContent,
        ...within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      ]),
    ).toEqual([
      [
        'カラー同意書_田中様.pdf',
        'PDF',
        '340 KB',
        '佐藤 美咲',
        '2026年11月21日（土） 09:31',
      ],
      [
        '施術前.jpg',
        'JPEG 画像',
        '1.2 MB',
        'あなた',
        '2026年11月20日（金） 10:01',
      ],
      [
        'logo.png',
        'PNG 画像',
        '912 バイト',
        'ほかのアカウント',
        '2026年11月19日（木） 15:00',
      ],
    ])
    expect(
      within(rows[0] ?? table).getByRole('link', {
        name: 'カラー同意書_田中様.pdf',
      }),
    ).toHaveAttribute(
      'href',
      '/salons/3b8e2f4a-6c1d-4e9b-8a7f-2d5c9e1b4a60/files/3c7f4d0e-6a8b-4e1c-8b5f-9c4a6d8e0f23',
    )
  })

  it('should count the files, and offer those that come next', async () => {
    // Act
    await stories.More.run()

    // Assert
    expect(screen.getByText('23 件（2 件を表示しています）')).toBeVisible()
    expect(screen.getByRole('button', { name: 'さらに表示' })).toBeVisible()
  })
})
