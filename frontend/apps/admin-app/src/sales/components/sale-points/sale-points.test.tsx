import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import { aSale, customers, salon } from '../examples'
import * as salePointsStories from './sale-points.stories'

const stories = composeStories(salePointsStories)

const POINTS = `/salons/${salon.id}/customers/${customers[0]?.id ?? ''}/points/new`

describe('SalePoints', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say what the points of the sale are for, and lead to the form with the sale and what each button records', async () => {
    // Act
    await stories.Points.run()

    // Assert
    const part = screen.getByRole('region', { name: 'ポイント' })
    expect(part).toHaveTextContent(
      'お会計で使ったポイントと、付与するポイントを、この売上に結びつけて、お客様のポイントに記録します。',
    )
    expect(
      within(part).getByRole('link', { name: '使ったポイントを記録する' }),
    ).toHaveAttribute('href', `${POINTS}?saleId=${aSale().id}&kind=used`)
    expect(
      within(part).getByRole('link', { name: 'ポイントを付与する' }),
    ).toHaveAttribute('href', `${POINTS}?saleId=${aSale().id}&kind=earned`)
  })
})

describe('SalePoints on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say what the points of the sale are for, and name what each button records, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Points.run()

    // Assert
    const part = screen.getByRole('region', { name: 'Points' })
    expect(
      within(part).getByText(
        'Record the points the customer used at the counter, and give the points they earn, against this sale.',
      ),
    ).toBeVisible()
    expect(
      within(part)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Record points used', 'Give points'])
  })
})
