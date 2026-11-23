import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
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
        '予約する',
        '1 時間',
        '￥5,500（税込）',
      ],
      ['キッズカット（小学生まで）', '予約する', '30 分', '￥2,500（税込）'],
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
        '予約する',
        '1 時間 30 分',
        '通常 ￥8,000￥7,200（税込）',
      ],
      [
        'ハイライト',
        '髪の長さと本数で、料金が変わります',
        '要カウンセリング',
        '予約する',
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

  it('should lead from a service to the screen where it is booked, by a link that names the service', async () => {
    // Act
    await stories.Default.run()

    // Assert
    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.getAttribute('aria-label'))).toEqual([
      'レディースカットを予約する',
      'キッズカット（小学生まで）を予約する',
      'フルカラーを予約する',
      'ハイライトを予約する',
    ])
    expect(links.map((link) => link.textContent)).toEqual([
      '予約する',
      '予約する',
      '予約する',
      '予約する',
    ])
    expect(
      screen.getByRole('link', { name: 'レディースカットを予約する' }),
    ).toHaveAttribute(
      'href',
      '/salons/0b7f5c1e-3a52-4d8e-9c41-6f2e8d1a7b90/services/1a3c5e7f-9b20-4d46-8e68-0a2c4e6f8b79/booking',
    )
  })

  it('should lead to no booking of a service that cannot be booked online', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(
      within(screen.getByRole('list', { name: 'その他' })).queryByRole('link'),
    ).toBeNull()
  })

  it('should lead to no booking at all when the salon takes none', async () => {
    // Act
    await stories.NotTakingBookings.run()

    // Assert
    expect(screen.queryByRole('link')).toBeNull()
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

describe('ServiceMenu on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say the length, the price and the tax of a service in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Default.run()

    // Assert
    expect(servicesOf('カラー')).toEqual([
      [
        'フルカラー',
        '根元から毛先まで染めます。',
        'Book',
        '1 hr 30 min',
        'Regularly ¥8,000¥7,200(tax included)',
      ],
      [
        'ハイライト',
        '髪の長さと本数で、料金が変わります',
        'Consultation required',
        'Book',
        '2 hr',
        'From ¥12,000(plus tax)',
      ],
    ])
    expect(
      screen.getByRole('link', { name: 'Book レディースカット' }),
    ).toHaveTextContent('Book')
  })

  it('should name the services without a category, and what cannot be booked, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Default.run()

    // Assert
    expect(servicesOf('Other')).toEqual([
      [
        'ブライダルヘアセット',
        '打ち合わせのうえ、内容と料金を決めます。',
        'No online booking',
        '2 hr 30 min',
        'Price on consultation',
      ],
    ])
  })
})
