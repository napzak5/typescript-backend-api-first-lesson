import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as summaryStories from './alert-summary.stories'

const stories = composeStories(summaryStories)

/** The severities and how many alerts there are of each */
const terms = (): [string | null, string | null][] =>
  screen
    .queryAllByRole('term')
    .map((term) => [
      term.textContent,
      term.nextElementSibling?.textContent ?? null,
    ])

describe('AlertSummary', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say how many alerts nobody saw to, then how many there are of each severity', async () => {
    // Act
    await stories.Alerts.run()

    // Assert
    expect(
      screen.getByText(
        '今出ているアラートは 2 件で、そのうち 1 件が未確認です。',
      ),
    ).toBeVisible()
    expect(terms()).toEqual([
      ['緊急', '2 件'],
      ['注意', '0 件'],
      ['情報', '0 件'],
    ])
  })

  it('should say that somebody saw to every alert', async () => {
    // Act
    await stories.AllAcknowledged.run()

    // Assert
    expect(
      screen.getByText('今出ているアラートは 2 件で、どれも確認済みです。'),
    ).toBeVisible()
  })

  it('should say that there are no alerts, without counting the severities', async () => {
    // Act
    await stories.NoAlerts.run()

    // Assert
    expect(screen.getByText('今出ているアラートはありません。')).toBeVisible()
    expect(terms()).toEqual([])
  })
})

describe('AlertSummary on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say how many alerts nobody saw to, and how many there are of each severity, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Alerts.run()

    // Assert
    expect(
      screen.getByText('Alerts raised now: 2, of which 1 not acknowledged.'),
    ).toBeVisible()
    expect(terms()).toEqual([
      ['Critical', '2 alerts'],
      ['Warning', '0 alerts'],
      ['Info', '0 alerts'],
    ])
  })

  it('should say in English that somebody saw to every alert, and that there are none', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.AllAcknowledged.run()

    // Assert
    expect(
      screen.getByText('Alerts raised now: 2, all of them acknowledged.'),
    ).toBeVisible()

    // Act
    await stories.NoAlerts.run()

    // Assert
    expect(screen.getByText('No alerts are raised now.')).toBeVisible()
  })
})
