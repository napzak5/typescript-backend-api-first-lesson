import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as weekSwitchStories from './week-switch.stories'

const stories = composeStories(weekSwitchStories)

describe('WeekSwitch', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should lead to the week before, this week and the week after, in that order', async () => {
    // Act
    await stories.Weeks.run()

    // Assert
    const links = within(
      screen.getByRole('navigation', { name: 'シフトの週' }),
    ).getAllByRole('link')
    expect(
      links.map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['前の週', '?week=2026-11-09'],
      ['今週', '?'],
      ['次の週', '?week=2026-11-23'],
    ])
  })
})
