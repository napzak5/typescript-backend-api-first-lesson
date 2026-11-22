import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as salonChoicesStories from './salon-choices.stories'

const stories = composeStories(salonChoicesStories)

describe('SalonChoices', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the salons, each leading to its bookings', async () => {
    // Act
    await stories.Salons.run()

    // Assert
    expect(rowsOf('サロン')).toEqual([
      ['Salon Hikari 表参道店', '東京都 渋谷区 神宮前 4-1-1', '受付中'],
      ['Salon Hikari 銀座店', '東京都 中央区 銀座 5-2-1 銀座ビル 3F', '停止中'],
    ])
    expect(
      screen.getByRole('link', { name: 'Salon Hikari 銀座店' }),
    ).toHaveAttribute(
      'href',
      '/salons/4c9f3a5b-7d2e-4fac-9b80-3e6d0f2c5b71/bookings',
    )
    expect(screen.getByRole('status').textContent).toBe('2 件')
  })

  it('should say how many of the salons are shown', async () => {
    // Act
    await stories.WithMore.run()

    // Assert
    expect(screen.getByRole('status').textContent).toBe(
      '24 件（2 件を表示しています）',
    )
    expect(screen.getByRole('button', { name: 'さらに表示' })).toBeVisible()
  })
})
