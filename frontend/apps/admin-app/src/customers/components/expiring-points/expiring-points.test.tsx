import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { columnsOf, rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as expiringPointsStories from './expiring-points.stories'

const stories = composeStories(expiringPointsStories)

const part = (): HTMLElement =>
  screen.getByRole('region', { name: '期限が近いポイント' })

describe('ExpiringPoints', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say how many points expire soon and when first, and list the points given they are left of, those that are past too', async () => {
    // Act
    await stories.Expiring.run()

    // Assert
    expect(
      within(part()).getByText(
        '30 日以内に期限が来るポイントは、700 ポイントです。最も早い期限は、2026年11月19日（木）です。',
      ),
    ).toBeVisible()
    expect(
      within(part()).getByText(
        '期限を過ぎたポイントも、失効させるまでは使えます。',
      ),
    ).toBeVisible()
    expect(rowsOf(part())).toEqual([
      [
        '2026年11月19日（木）（期限切れ）',
        '付与',
        '200 ポイント',
        '2026年5月19日（火） 11:00',
        '紹介のお礼',
      ],
      [
        '2026年12月10日（木）',
        '付与',
        '500 ポイント',
        '2026年11月10日（火） 12:00',
        'カットのお会計',
      ],
    ])
  })

  it('should say nothing of past points when none is', async () => {
    // Act
    await stories.Soon.run()

    // Assert
    expect(
      within(part()).queryByText(
        '期限を過ぎたポイントも、失効させるまでは使えます。',
      ),
    ).toBeNull()
    expect(within(part()).queryByText(/期限切れ/)).toBeNull()
  })

  it('should leave the day of a point without an expiry date empty, and not take it for past', async () => {
    // Act
    await stories.Undated.run()

    // Assert
    expect(rowsOf(part())).toEqual([
      [
        '',
        '付与',
        '500 ポイント',
        '2026年11月10日（火） 12:00',
        'カットのお会計',
      ],
    ])
    expect(
      within(part()).queryByText(
        '期限を過ぎたポイントも、失効させるまでは使えます。',
      ),
    ).toBeNull()
  })

  it('should say that no point expires within the days', async () => {
    // Act
    await stories.None.run()

    // Assert
    expect(
      within(part()).getByText('30 日以内に期限が来るポイントはありません。'),
    ).toBeVisible()
    expect(within(part()).queryByRole('table')).toBeNull()
  })
})

describe('ExpiringPoints on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say how many points expire soon and list them, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Expiring.run()

    // Assert
    const expiring = screen.getByRole('region', {
      name: 'Points expiring soon',
    })
    expect(
      within(expiring).getByText(
        'Points expiring within 30 days: 700 points. The earliest expiry date is Thu, November 19, 2026.',
      ),
    ).toBeVisible()
    expect(
      within(expiring).getByText(
        'Points past their expiry date can still be used until they are expired.',
      ),
    ).toBeVisible()
    expect(columnsOf('Breakdown of the points expiring soon')).toEqual([
      'Expiry date',
      'Kind',
      'Points',
      'Date and time',
      'Description',
    ])
    expect(rowsOf(expiring)).toEqual([
      [
        'Thu, November 19, 2026 (expired)',
        'Given',
        '200 points',
        'Tue, May 19, 2026 at 11:00',
        '紹介のお礼',
      ],
      [
        'Thu, December 10, 2026',
        'Given',
        '500 points',
        'Tue, November 10, 2026 at 12:00',
        'カットのお会計',
      ],
    ])
    expect(
      within(expiring).getByText(
        'The points in the table are the numbers given (or moved by a merge), not the numbers left unused.',
      ),
    ).toBeVisible()
  })

  it('should say in English that no point expires within the days', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.None.run()

    // Assert
    expect(screen.getByText('No points expire within 30 days.')).toBeVisible()
  })
})
