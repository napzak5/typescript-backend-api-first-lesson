import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import { expiredColour, shampooRow } from '../examples'
import * as resultStories from './count-result.stories'

const stories = composeStories(resultStories)

const table = (): HTMLElement =>
  screen.getByRole('table', { name: '帳簿の在庫数と差のあった行' })

describe('CountResult', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the rows that differed, with the books, the count and the difference', async () => {
    // Act
    await stories.Differed.run()

    // Assert
    expect(rowsOf(table())).toEqual([
      [
        'ヘアカラー ナチュラルブラウン（ロット LOT-2025-112）',
        '2.5 本',
        '2 本',
        '−0.5 本',
      ],
      ['プロフェッショナル シャンプー 500ml', '8 本', '9 本', '+1 本'],
    ])
    expect(within(table()).getAllByRole('rowheader')).toHaveLength(2)
  })

  it('should lead from a row that differed to its screen', async () => {
    // Act
    await stories.Differed.run()

    // Assert
    expect(
      screen.getByRole('link', {
        name: 'ヘアカラー ナチュラルブラウン（ロット LOT-2025-112）',
      }),
    ).toHaveAttribute(
      'href',
      `/salons/${salon.id}/inventory/${expiredColour.id}`,
    )
    expect(
      screen.getByRole('link', { name: 'プロフェッショナル シャンプー 500ml' }),
    ).toHaveAttribute('href', `/salons/${salon.id}/inventory/${shampooRow.id}`)
  })

  it('should say that no row differed, without a table', async () => {
    // Act
    await stories.NoneDiffered.run()

    // Assert
    expect(
      screen.getByText(
        '数えたどの行も、帳簿の在庫数と同じでした。在庫数は変わりません。',
      ),
    ).toBeVisible()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('should name the product a row was of as removed when the salon no longer carries it', async () => {
    // Act
    await stories.OfARemovedProduct.run()

    // Assert
    expect(rowsOf(table())[0]?.[0]).toBe('削除した商品（ロット LOT-2025-112）')
  })
})

describe('CountResult on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should list the rows that differed in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Differed.run()

    // Assert
    const differed = screen.getByRole('table', {
      name: 'Rows that differed from the books',
    })
    expect(
      within(differed)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Stock row', 'On the books', 'Counted', 'Difference'])
    expect(rowsOf(differed)).toEqual([
      [
        'ヘアカラー ナチュラルブラウン (lot LOT-2025-112)',
        '2.5 本',
        '2 本',
        '−0.5 本',
      ],
      ['プロフェッショナル シャンプー 500ml', '8 本', '9 本', '+1 本'],
    ])
  })

  it('should say in English that no row differed, and name a removed product', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.NoneDiffered.run()

    // Assert
    expect(
      screen.getByText(
        'Every row counted matched the books. The stock does not change.',
      ),
    ).toBeVisible()

    // Act
    await stories.OfARemovedProduct.run()

    // Assert
    expect(
      rowsOf(
        screen.getByRole('table', {
          name: 'Rows that differed from the books',
        }),
      )[0]?.[0],
    ).toBe('Removed product (lot LOT-2025-112)')
  })
})
