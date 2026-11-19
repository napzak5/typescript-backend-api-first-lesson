import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as tagListStories from './tag-list.stories'

const stories = composeStories(tagListStories)

const wordsOf = (list: HTMLElement): (string | null)[] =>
  within(list)
    .getAllByRole('listitem')
    .map((item) => item.textContent)

describe('TagList', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should be a list that is named after what its words say about', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(wordsOf(screen.getByRole('list', { name: '特徴' }))).toEqual([
      '個室あり',
      'キッズスペース',
      '駐車場',
    ])
  })

  it('should show a word that is repeated once, where it came first', async () => {
    // Act
    await stories.Repeated.run()

    // Assert
    expect(wordsOf(screen.getByRole('list', { name: '特徴' }))).toEqual([
      'Wi-Fi',
      'ドリンクサービス',
    ])
  })

  it('should keep a class its container gives it', async () => {
    // Act
    await stories.Default.run({
      args: { ...stories.Default.args, className: 'in-card' },
    })

    // Assert
    expect(screen.getByRole('list', { name: '特徴' })).toHaveClass(
      'tagList',
      'in-card',
    )
  })
})
