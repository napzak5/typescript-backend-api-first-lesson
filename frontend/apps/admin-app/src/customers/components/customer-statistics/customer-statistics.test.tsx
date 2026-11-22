import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import { services, staff } from '../../../bookings/components/examples'
import * as customerStatisticsStories from './customer-statistics.stories'

const stories = composeStories(customerStatisticsStories)

const [cut, color] = services
const [misaki, ken] = staff

const items = (): [string | null, string | null][] =>
  screen
    .getAllByRole('term')
    .map((term) => [
      term.textContent,
      term.nextElementSibling?.textContent ?? null,
    ])

describe('CustomerStatistics', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should count what a customer did over the period, on the clock and in the currency of the salon', async () => {
    // Act
    await stories.Regular.run()

    // Assert
    expect(items()).toEqual([
      ['予約', '8 件'],
      ['利用額', '￥52,800'],
      ['予約 1 件あたりの会計', '￥7,542'],
      ['最後の来店', '2026年11月18日（水） 10:00'],
      ['キャンセル率', '12.5%'],
      ['無断キャンセル率', '0%'],
    ])
    expect(rowsOf('よく受けたメニュー')).toEqual([
      [cut?.name, '6 件'],
      [color?.name, '2 件'],
    ])
    expect(rowsOf('よく担当したスタッフ')).toEqual([
      [misaki?.displayName, '5 件'],
      [ken?.displayName, '2 件'],
    ])
  })

  it('should say that a customer who did not come in the period has no service and no member to count', async () => {
    // Act
    await stories.NoBooking.run()

    // Assert
    expect(items()).toContainEqual(['最後の来店', 'なし'])
    expect(rowsOf('よく受けたメニュー')).toEqual([
      ['この期間に完了した予約はありません'],
    ])
    expect(rowsOf('よく担当したスタッフ')).toEqual([
      ['この期間に完了した予約はありません'],
    ])
  })
})
