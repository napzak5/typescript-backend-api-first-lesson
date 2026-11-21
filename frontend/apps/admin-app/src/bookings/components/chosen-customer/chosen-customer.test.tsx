import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as chosenCustomerStories from './chosen-customer.stories'

const stories = composeStories(chosenCustomerStories)

const terms = (): (string | null | undefined)[][] =>
  within(screen.getByRole('region', { name: 'お客様' }))
    .getAllByRole('term')
    .map((term) => [term.textContent, term.nextElementSibling?.textContent])

describe('ChosenCustomer', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say who the customer is, and lead back to the customers that were found', async () => {
    // Act
    await stories.Customer.run()

    // Assert
    expect(terms()).toEqual([
      ['お名前', '山田 花子'],
      ['フリガナ', 'ヤマダ ハナコ'],
      ['電話番号', '090-1234-5678'],
      ['メールアドレス', 'hanako@example.com'],
    ])
    expect(
      screen.getByRole('link', { name: 'お客様を選び直す' }),
    ).toHaveAttribute('href', '?date=2026-11-20&search=%E5%B1%B1%E7%94%B0')
  })

  it('should say that the kana was not given', async () => {
    // Act
    await stories.WithoutKana.run()

    // Assert
    expect(terms()).toContainEqual(['フリガナ', '記録なし'])
  })
})
