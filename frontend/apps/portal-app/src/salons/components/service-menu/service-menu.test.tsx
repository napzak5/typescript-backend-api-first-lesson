import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as serviceMenuStories from './service-menu.stories'

const stories = composeStories(serviceMenuStories)

/** The services under a category, each as the texts of its paragraphs. */
const servicesOf = (category: string): (string | null)[][] =>
  within(screen.getByRole('list', { name: category }))
    .getAllByRole('listitem')
    .map((service) =>
      within(service)
        .getAllByRole('paragraph')
        .map((paragraph) => paragraph.textContent),
    )

describe('ServiceMenu', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should put the services under the headings of their categories, in the order it is given', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['カット', 'カラー', 'その他'])
    expect(screen.getByText('シャンプーとブローを含みます。')).toBeVisible()
  })

  it('should say of a service what it is, how long it takes and what it costs', async () => {
    // Act
    await stories.Default.run()

    // Assert: the short description when there is one, and no description at all
    expect(servicesOf('カット')).toEqual([
      [
        'レディースカット',
        'シャンプー、ブロー込み',
        '1 時間',
        '￥5,500（税込）',
      ],
      ['キッズカット（小学生まで）', '30 分', '￥2,500（税込）'],
    ])
  })

  it('should show the price before a discount beside the one that is paid, and mark a price that rises', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(servicesOf('カラー')).toEqual([
      [
        'フルカラー',
        '根元から毛先まで染めます。',
        '1 時間 30 分',
        '通常 ￥8,000￥7,200（税込）',
      ],
      [
        'ハイライト',
        '髪の長さと本数で、料金が変わります',
        '要カウンセリング',
        '2 時間',
        '￥12,000〜（税別）',
      ],
    ])
  })

  it('should name no amount for a price that is agreed on, and say what cannot be booked online', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(servicesOf('その他')).toEqual([
      [
        'ブライダルヘアセット',
        '打ち合わせのうえ、内容と料金を決めます。',
        'オンライン予約不可',
        '2 時間 30 分',
        '要相談',
      ],
    ])
  })

  it('should show one category alone', async () => {
    // Act
    await stories.OneCategory.run()

    // Assert
    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(['カット'])
    expect(servicesOf('カット')).toHaveLength(2)
  })
})
