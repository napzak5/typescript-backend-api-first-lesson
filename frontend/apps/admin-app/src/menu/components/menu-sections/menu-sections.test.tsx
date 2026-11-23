import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import { aDiscountedColour, aPackage, aService } from '../examples'
import * as menuSectionsStories from './menu-sections.stories'

const stories = composeStories(menuSectionsStories)

describe('MenuSections', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the services by category, in the order of the menu, and the services of none last', async () => {
    // Act
    await stories.Found.run()

    // Assert
    expect(
      screen
        .getAllByRole('table')
        .map((table) => [
          table.querySelector('caption')?.textContent,
          rowsOf(table),
        ]),
    ).toEqual([
      ['カット', [['カット', '60 分', '￥5,500・税込', '受ける', '有効']]],
      [
        'カラー',
        [
          [
            'フルカラー',
            '120 分',
            '￥7,200（￥8,000 から割引）・税別・変動価格',
            '受けない',
            '有効',
          ],
        ],
      ],
      ['カラー › ハイライト', [['このカテゴリーのサービスはありません']]],
      [
        '未分類',
        [
          [
            'カットとカラー',
            '180 分',
            '￥11,000（￥12,000 から割引）・税込',
            '受ける',
            '無効・近日公開',
          ],
        ],
      ],
    ])
  })

  it('should lead from the name to the service', async () => {
    // Act
    await stories.Found.run()

    // Assert
    expect(
      screen.getAllByRole('link').map((link) => link.getAttribute('href')),
    ).toEqual(
      [aService(), aDiscountedColour(), aPackage()].map(
        ({ id }) => `/salons/${salon.id}/menu/services/${id}`,
      ),
    )
  })

  it('should have no part of the services of none when every service has a category', async () => {
    // Act
    await stories.AllInCategories.run()

    // Assert
    expect(
      screen.queryByRole('table', { name: '未分類' }),
    ).not.toBeInTheDocument()
    expect(screen.getAllByRole('table')).toHaveLength(3)
  })
})

describe('MenuSections on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name the columns, and say the times, prices and states of the services, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Found.run()

    // Assert
    const tables = screen.getAllByRole('table')
    expect(
      within(tables[0] ?? document.body)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Service', 'Duration', 'Price', 'Online booking', 'Status'])
    expect(
      tables.map((table) => [
        table.querySelector('caption')?.textContent,
        rowsOf(table),
      ]),
    ).toEqual([
      [
        'カット',
        [['カット', '60 min', '¥5,500 · Tax included', 'Accepted', 'Active']],
      ],
      [
        'カラー',
        [
          [
            'フルカラー',
            '120 min',
            '¥7,200 (discounted from ¥8,000) · Before tax · Variable price',
            'Not accepted',
            'Active',
          ],
        ],
      ],
      ['カラー › ハイライト', [['No services in this category']]],
      [
        'Uncategorized',
        [
          [
            'カットとカラー',
            '180 min',
            '¥11,000 (discounted from ¥12,000) · Tax included',
            'Accepted',
            'Inactive · Coming soon',
          ],
        ],
      ],
    ])
  })
})
