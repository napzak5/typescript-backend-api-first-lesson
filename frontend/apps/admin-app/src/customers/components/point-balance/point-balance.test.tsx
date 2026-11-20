import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as pointBalanceStories from './point-balance.stories'

const stories = composeStories(pointBalanceStories)

describe('PointBalance', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show the balance, and lead to the recording of points', async () => {
    // Act
    await stories.Balance.run()

    // Assert
    const part = screen.getByRole('region', { name: '残高' })
    expect(within(part).getByText('2,700 ポイント')).toBeVisible()
    expect(
      within(part).getByRole('link', { name: 'ポイントを記録する' }),
    ).toHaveAttribute('href', stories.Balance.args.entryHref)
  })

  it('should show a balance of none as 0 points', async () => {
    // Act
    await stories.Nothing.run()

    // Assert
    expect(screen.getByText('0 ポイント')).toBeVisible()
  })
})
