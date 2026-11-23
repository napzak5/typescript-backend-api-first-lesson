import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { columnsOf, rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as customerChoicesStories from './customer-choices.stories'

const stories = composeStories(customerChoicesStories)

describe('CustomerChoices', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the customers by name, kana, phone number and address, each name leading on', async () => {
    // Act
    await stories.Customers.run()

    // Assert
    expect(rowsOf('見つかったお客様')).toEqual([
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

describe('CustomerChoices on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should list the customers found, name the one the screen is about, and count them, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithTheCustomerThemselves.run()

    // Assert
    expect(columnsOf('Customers found')).toEqual([
      'Name',
      'Phonetic name',
      'Phone number',
      'Email address',
    ])
    expect(screen.getByText('山田 花子 (this customer)')).toBeVisible()
    expect(screen.getByRole('status').textContent).toBe('3 people')
  })
})
