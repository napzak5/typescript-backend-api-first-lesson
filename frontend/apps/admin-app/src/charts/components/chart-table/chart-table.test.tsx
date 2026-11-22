import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it } from 'vitest'
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
