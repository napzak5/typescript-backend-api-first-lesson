import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as executedRequestsStories from './executed-requests.stories'

const stories = composeStories(executedRequestsStories)

describe('ExecutedRequests', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list when each request was received and became due, in the time zone of the device, with its reason', async () => {
    // Act
    await stories.Carried.run()

    // Assert
    const table = screen.getByRole('table', { name: '実行した依頼' })
    expect(
      screen.getAllByRole('rowheader').map((header) => header.textContent),
    ).toEqual(['2026年11月5日（木） 10:30', '2026年11月6日（金） 14:10'])
    expect(table).toHaveTextContent(
      '2026年11月20日（金） 14:10本人が来店して依頼した。 本人であることは、運転免許証で確かめた。',
    )
  })
})

describe('ExecutedRequests on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should list the requests carried out, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Carried.run()

    // Assert
    expect(
      screen.getByRole('table', { name: 'Requests carried out' }),
    ).toBeVisible()
    expect(
      screen.getAllByRole('columnheader').map((header) => header.textContent),
    ).toEqual(['Taken', 'Scheduled erasure', 'Reason for the request'])
    expect(
      screen.getAllByRole('rowheader').map((header) => header.textContent),
    ).toEqual([
      'Thu, November 5, 2026 at 10:30',
      'Fri, November 6, 2026 at 14:10',
    ])
  })
})
