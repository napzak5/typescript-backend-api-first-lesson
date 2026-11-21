import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as periodSwitchStories from './period-switch.stories'

const stories = composeStories(periodSwitchStories)

const linksOf = (name: string): (string | null)[][] =>
  within(screen.getByRole('navigation', { name }))
    .getAllByRole('link')
    .map((link) => [link.textContent, link.getAttribute('href')])

describe('PeriodSwitch', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should lead to the day before, today and the day after, in that order', async () => {
    // Act
    await stories.Days.run()

    // Assert
    expect(linksOf('予約の日')).toEqual([
      ['前の日', '?date=2026-11-19'],
      ['今日', '?date=2026-11-20'],
      ['次の日', '?date=2026-11-21'],
    ])
  })

  it('should name the weeks as weeks', async () => {
    // Act
    await stories.Weeks.run()

    // Assert
    expect(linksOf('シフトの週')).toEqual([
      ['前の週', '?week=2026-11-09'],
      ['今週', '?'],
      ['次の週', '?week=2026-11-23'],
    ])
  })

  it('should leave out the link to a period that cannot be shown', async () => {
    // Act
    await stories.WithoutAfter.run()

    // Assert
    expect(linksOf('ほかの日')).toEqual([
      ['前の日', '?date=2026-11-19'],
      ['今日', '?date=2026-11-20'],
    ])
    expect(
      screen.getByRole('navigation', { name: 'ほかの日' }),
    ).not.toHaveTextContent('次の日')
  })

  it('should leave out the link to the day before the first that is counted', async () => {
    // Act
    await stories.WithoutBefore.run()

    // Assert
    expect(linksOf('ほかの日')).toEqual([
      ['今日', '?date=2026-11-20'],
      ['次の日', '?date=2026-11-21'],
    ])
    expect(
      screen.getByRole('navigation', { name: 'ほかの日' }),
    ).not.toHaveTextContent('前の日')
  })
})
