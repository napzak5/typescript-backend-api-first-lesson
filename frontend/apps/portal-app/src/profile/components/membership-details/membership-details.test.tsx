import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import { profile } from '../examples'
import * as membershipDetailsStories from './membership-details.stories'

const stories = composeStories(membershipDetailsStories)

/** The names and the values, as the list shows them. */
const details = (): Record<string, string | null> =>
  Object.fromEntries(
    screen
      .getAllByRole('term')
      .map((term) => [
        term.textContent,
        term.nextElementSibling?.textContent ?? null,
      ]),
  )

describe('MembershipDetails', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say the rank, the points, the visits, the code and what a salon wrote down of the hair', async () => {
    // Act
    await stories.Member.run()

    // Assert
    expect(details()).toEqual({
      会員ランク: 'ゴールド',
      ポイント: '2,500 ポイント',
      来店回数: '12 回',
      初めての来店: '2023年4月8日',
      最後の来店: '2026年11月9日',
      紹介コード: 'HANAKO-2026',
      髪質: 'ウェーブ',
      髪の太さ: 'ふつう',
      頭皮の状態: '乾燥',
    })
  })

  it('should say what is missing for somebody who has not come yet, and leave no name without a value', async () => {
    // Act
    await stories.New.run()

    // Assert
    expect(details()).toEqual({
      会員ランク: 'レギュラー',
      ポイント: '0 ポイント',
      来店回数: '0 回',
      初めての来店: 'まだ来店がありません',
      最後の来店: 'まだ来店がありません',
      紹介コード: '未発行',
      髪質: '記録なし',
      髪の太さ: '記録なし',
      頭皮の状態: '記録なし',
    })
  })

  it('should group the digits of large numbers', async () => {
    // Act
    await stories.WithManyPoints.run()

    // Assert
    expect(details()).toMatchObject({
      会員ランク: 'VIP',
      ポイント: '1,234,567 ポイント',
      来店回数: '1,024 回',
    })
  })
})

describe('MembershipDetails on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say the rank, the points, the visits and the hair in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Member.run()

    // Assert
    expect(details()).toEqual({
      'Membership rank': 'Gold',
      Points: '2,500 points',
      Visits: '12 visits',
      'First visit': 'April 8, 2023',
      'Last visit': 'November 9, 2026',
      'Referral code': 'HANAKO-2026',
      'Hair type': 'Wavy',
      'Hair thickness': 'Medium',
      'Scalp condition': 'Dry',
    })
  })

  it('should say in English what is missing for somebody who has not come yet', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.New.run()

    // Assert
    expect(details()).toEqual({
      'Membership rank': 'Regular',
      Points: '0 points',
      Visits: '0 visits',
      'First visit': 'No visits yet',
      'Last visit': 'No visits yet',
      'Referral code': 'Not issued',
      'Hair type': 'Not recorded',
      'Hair thickness': 'Not recorded',
      'Scalp condition': 'Not recorded',
    })
  })

  it('should count one point and one visit in the singular', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Member.run({
      args: {
        profile: {
          ...profile,
          loyaltyPoints: 1,
          visitCount: 1,
        },
      },
    })

    // Assert
    expect(details()).toMatchObject({ Points: '1 point', Visits: '1 visit' })
  })
})
