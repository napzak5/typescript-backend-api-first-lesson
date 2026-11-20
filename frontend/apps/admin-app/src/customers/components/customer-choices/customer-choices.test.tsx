import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as customerChoicesStories from './customer-choices.stories'

const stories = composeStories(customerChoicesStories)

describe('CustomerChoices', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the customers by name, kana, phone number and address, each name leading on', async () => {
    // Act
    await stories.Customers.run()

    // Assert
    const rows = within(screen.getByRole('table', { name: '見つかったお客様' }))
      .getAllByRole('row')
      .slice(1)
    expect(
      rows.map((row) =>
        [
          ...within(row).getAllByRole('rowheader'),
          ...within(row).getAllByRole('cell'),
        ].map((cell) => cell.textContent),
      ),
    ).toEqual([
      ['山田 花子', 'ヤマダ ハナコ', '090-1234-5678', 'hanako@example.com'],
      ['鈴木 一郎', 'スズキ イチロウ', '090-1234-5678', 'ichiro@example.com'],
      ['山田 花子', '', '080-2222-3333', 'hanako.yamada@example.com'],
    ])
    expect(
      screen.getAllByRole('link', { name: '山田 花子' }).at(-1),
    ).toHaveAttribute(
      'href',
      '?customerId=f4c27a8d-9b1e-4d3f-8a6c-2e5b7d9f1a03',
    )
    expect(screen.getByRole('status').textContent).toBe('3 人')
  })

  it('should hand the customer whose name was pressed over, when a button chooses', async () => {
    // Arrange
    const onChoose = vi.fn()
    await stories.ByButton.run({
      args: {
        ...stories.ByButton.args,
        choose: { type: 'button', onChoose, excluded: undefined },
      },
    })

    // Act
    await userEvent.click(
      screen.getAllByRole('button', { name: '山田 花子' })[1] ?? document.body,
    )

    // Assert
    expect(screen.queryAllByRole('link')).toEqual([])
    expect(onChoose).toHaveBeenCalledOnce()
    expect(onChoose).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'f4c27a8d-9b1e-4d3f-8a6c-2e5b7d9f1a03' }),
    )
  })

  it('should name the customer the form is about without a button', async () => {
    // Act
    await stories.WithTheCustomerThemselves.run()

    // Assert
    expect(
      screen.getAllByRole('button').map((button) => button.textContent),
    ).toEqual(['山田 花子', '鈴木 一郎'])
    expect(screen.getByText('山田 花子（このお客様）')).toBeVisible()
  })

  it('should lead on from every customer but the one the screen is about', async () => {
    // Act
    await stories.ByLinkWithTheCustomerThemselves.run()

    // Assert
    expect(
      screen.getAllByRole('link').map((link) => link.getAttribute('href')),
    ).toEqual([
      expect.stringMatching(/^\?with=/),
      expect.stringMatching(/^\?with=/),
    ])
    expect(screen.getByText('山田 花子（このお客様）')).toBeVisible()
  })

  it('should say how many of the customers are shown', async () => {
    // Act
    await stories.WithMore.run()

    // Assert
    expect(screen.getByRole('status').textContent).toBe(
      '42 人（3 人を表示しています）',
    )
    expect(screen.getByRole('button', { name: 'さらに表示' })).toBeVisible()
  })
})
