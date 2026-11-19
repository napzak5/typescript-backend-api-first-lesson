import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as daySwitchStories from './day-switch.stories'

const stories = composeStories(daySwitchStories)

describe('DaySwitch', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should lead to the day before, today and the day after, in that order', async () => {
    // Act
    await stories.Days.run()

    // Assert
    const links = within(
      screen.getByRole('navigation', { name: '予約の日' }),
    ).getAllByRole('link')
    expect(
      links.map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['前の日', '?date=2026-11-19'],
      ['今日', '?date=2026-11-20'],
      ['次の日', '?date=2026-11-21'],
    ])
  })
})
