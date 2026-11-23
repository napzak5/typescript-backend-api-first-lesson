import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as salonAboutStories from './salon-about.stories'

const stories = composeStories(salonAboutStories)

const terms = (): (string | null)[] =>
  screen.getAllByRole('term').map((term) => term.textContent)

const wordsOf = (name: string): (string | null)[] =>
  within(screen.getByRole('list', { name }))
    .getAllByRole('listitem')
    .map((item) => item.textContent)

describe('SalonAbout', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show what the salon wrote about itself, and how it is reached', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(
      screen.getByText(
        '表参道駅から歩いて 3 分。髪と頭皮にやさしい薬剤だけを使う、席数 6 の小さなサロンです。',
      ),
    ).toBeVisible()
    expect(terms()).toEqual([
      '住所',
      '電話番号',
      'メールアドレス',
      'ウェブサイト',
      '特徴',
      '設備とサービス',
    ])
    expect(
      screen.getByText(
        '〒150-0001 東京都 渋谷区 神宮前 4-1-1 こもれびビル 2 階',
      ),
    ).toBeVisible()
    expect(wordsOf('特徴')).toEqual(['個室あり', 'キッズスペース', '駐車場'])
    expect(wordsOf('設備とサービス')).toEqual(['Wi-Fi', 'ドリンクサービス'])
  })

  it('should let the telephone number, the mail address and the website be followed', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.getByRole('link', { name: '03-5550-0101' })).toHaveAttribute(
      'href',
      'tel:0355500101',
    )
    expect(
      screen.getByRole('link', { name: 'omotesando@komorebi.example' }),
    ).toHaveAttribute('href', 'mailto:omotesando@komorebi.example')
    const website = screen.getByRole('link', {
      name: 'https://komorebi.example/omotesando',
    })
    expect(website).toHaveAttribute(
      'href',
      'https://komorebi.example/omotesando',
    )
    expect(website).toHaveAttribute('rel', 'noreferrer')
  })

  it('should leave out what the salon did not write', async () => {
    // Act
    await stories.OnlyWhatIsRequired.run()

    // Assert
    expect(terms()).toEqual(['住所', '電話番号', 'メールアドレス'])
    expect(screen.getByText('大阪府 大阪市浪速区 難波中 2-3-4')).toBeVisible()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('should show both telephone numbers, each with its own link', async () => {
    // Act
    await stories.WithSecondTelephone.run()

    // Assert
    expect(screen.getByRole('link', { name: '03-5550-0101' })).toBeVisible()
    expect(
      screen.getByRole('link', { name: '+81 90-5550-0103' }),
    ).toHaveAttribute('href', 'tel:+819055500103')
    expect(
      screen.getByRole('link', { name: '03-5550-0101' }).parentElement,
    ).toHaveTextContent('03-5550-0101、+81 90-5550-0103')
  })

  it('should show as text, and not as a link, a website that is no address of the web', async () => {
    // Act
    await stories.WebsiteThatIsNoAddress.run()

    // Assert
    expect(screen.getByText('javascript:alert(1)')).toBeVisible()
    expect(
      screen.queryByRole('link', { name: 'javascript:alert(1)' }),
    ).toBeNull()
  })
})

describe('SalonAbout on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name what it says of the salon in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Default.run()

    // Assert
    expect(terms()).toEqual([
      'Address',
      'Phone number',
      'Email address',
      'Website',
      'Features',
      'Amenities and services',
    ])
    expect(wordsOf('Features')).toEqual([
      '個室あり',
      'キッズスペース',
      '駐車場',
    ])
  })

  it('should write the postal code as English does, and part the telephone numbers with a comma', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithSecondTelephone.run()

    // Assert
    expect(
      screen.getByText(/^150-0001 東京都/, { selector: 'dd *, dd' }),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: '03-5550-0101' }).parentElement,
    ).toHaveTextContent('03-5550-0101, +81 90-5550-0103')
  })
})
