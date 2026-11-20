import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
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
    expect(
      within(part())
        .getAllByRole('row')
        .slice(1)
        .map((row) =>
          [
            ...within(row).getAllByRole('rowheader'),
            ...within(row).getAllByRole('cell'),
          ].map((cell) => cell.textContent),
        ),
    ).toEqual([
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
