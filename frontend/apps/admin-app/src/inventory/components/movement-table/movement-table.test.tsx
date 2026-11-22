import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as movementTableStories from './movement-table.stories'

const stories = composeStories(movementTableStories)

const table = (): HTMLElement =>
  screen.getByRole('table', { name: '在庫の移動' })

describe('MovementTable', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the movements, the latest first, with how they changed the stock and who recorded them', async () => {
    // Act
    await stories.Movements.run()

    // Assert
    expect(rowsOf(table())).toEqual([
      [
        '2026年11月19日（木） 18:00',
        '廃棄',
        '−1.5 本',
        '12 本',
        '記録なし',
        'キャップが割れていた',
        '佐藤 健',
      ],
      [
        '2026年11月12日（木） 12:15',
        '店頭販売',
        '−1 本',
        '13.5 本',
        '記録なし',
        '記録なし',
        '一覧にないスタッフ',
      ],
      [
        '2026年11月10日（火） 14:30',
        '施術で使用',
        '−15.5 本',
        '14.5 本',
        '記録なし',
        '記録なし',
        '田中 美咲',
      ],
      [
        '2026年10月15日（木） 10:00',
        '仕入れ',
        '+10 本',
        '30 本',
        '￥12,000',
        '発注の入荷',
        '佐藤 健',
      ],
      [
        '2026年10月1日（木） 09:00',
        '在庫の調整',
        '+20 本',
        '20 本',
        '記録なし',
        '在庫移動の記録を始めた時点の在庫数',
        '記録なし',
      ],
    ])
    expect(screen.getByRole('status').textContent).toBe('5 件')
  })

  it('should name each movement by its moment', async () => {
    // Act
    await stories.Movements.run()

    // Assert
    expect(
      within(table())
        .getAllByRole('rowheader')
        .map((header) => header.textContent),
    ).toEqual([
      '2026年11月19日（木） 18:00',
      '2026年11月12日（木） 12:15',
      '2026年11月10日（火） 14:30',
      '2026年10月15日（木） 10:00',
      '2026年10月1日（木） 09:00',
    ])
  })

  it('should say the quantities without a unit when the product was removed', async () => {
    // Act
    await stories.OfARemovedProduct.run()

    // Assert
    expect(rowsOf(table())[0]?.slice(2, 4)).toEqual(['−1.5', '12'])
  })

  it('should ask for the movements that come next', async () => {
    // Arrange
    await stories.WithMore.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(stories.WithMore.args.onMore).toHaveBeenCalledOnce()
    expect(screen.getByRole('status').textContent).toBe(
      '32 件（5 件を表示しています）',
    )
  })
})
