import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import { aCustomer, salon } from '../../../bookings/components/examples'
import * as chartTableStories from './chart-table.stories'

const stories = composeStories(chartTableStories)

describe('ChartTable', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the charts by their customers, with what to take care of, the products and when they were written', async () => {
    // Act
    await stories.Found.run()

    // Assert
    expect(rowsOf('カルテ')).toEqual([
      [
        '山田 花子 様',
        '頭皮が乾燥しやすく、かゆみが出ることがあります。',
        'オーガニックシャンプー、無香料のオイル',
        '香りの強い整髪料',
        '2026年11月18日（水） 14:30',
      ],
      [
        '台帳から削除されたお客様',
        '記録なし',
        'なし',
        'ジアミンを含むカラー剤',
        '2026年11月10日（火） 09:00',
      ],
    ])
    expect(screen.getByRole('status').textContent).toBe('2 件')
  })

  it('should lead from the customer to their chart, and not from one who left the ledger', async () => {
    // Act
    await stories.Found.run()

    // Assert
    expect(
      screen.getAllByRole('link').map((link) => link.getAttribute('href')),
    ).toEqual([`/salons/${salon.id}/customers/${aCustomer().id}/chart`])
  })

  it('should say how many there are, and ask for more', async () => {
    // Arrange
    await stories.More.run()
    expect(screen.getByRole('status').textContent).toBe(
      '42 件（2 件を表示しています）',
    )

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(stories.More.args.onMore).toHaveBeenCalledOnce()
  })
})

describe('ChartTable on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should list the charts by their customers, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Found.run()

    // Assert
    expect(
      screen.getAllByRole('columnheader').map((header) => header.textContent),
    ).toEqual([
      'Customer',
      'Medical conditions',
      'Preferred products',
      'Products to avoid',
      'Last written',
    ])
    // The caption is the screen's, said by it
    expect(rowsOf('カルテ')).toEqual([
      [
        '山田 花子',
        '頭皮が乾燥しやすく、かゆみが出ることがあります。',
        'オーガニックシャンプー, 無香料のオイル',
        '香りの強い整髪料',
        'Wed, November 18, 2026 at 14:30',
      ],
      [
        'Removed from the ledger',
        'Not recorded',
        'None',
        'ジアミンを含むカラー剤',
        'Tue, November 10, 2026 at 09:00',
      ],
    ])
    expect(screen.getByRole('status').textContent).toBe('2 items')
  })
})
