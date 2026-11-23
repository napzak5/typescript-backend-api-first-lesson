import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { act } from 'react'
import { screen } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as saidChoicesStories from './said-choices.stories'

const stories = composeStories(saidChoicesStories)

/** What the choice offers, with the value each option sends */
const offered = (): [string, string][] =>
  screen
    .getAllByRole('option')
    .map((option) => [
      option.getAttribute('value') ?? '',
      option.textContent ?? '',
    ])

describe('useSaidChoices', () => {
  itShouldBeAccessibleInEveryStory(stories)

  afterEach(() => {
    localStorage.clear()
  })

  it('should name the options in Japanese on a page of no choice, each with the value it sends', async () => {
    // Act
    await stories.Kinds.run()

    // Assert
    expect(offered()).toEqual([
      ['', '選ばない'],
      ['cut', 'カット'],
      ['color', 'カラー'],
    ])
  })

  it('should name the options in English on a page in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Kinds.run()

    // Assert
    expect(offered()).toEqual([
      ['', '選ばない'],
      ['cut', 'Cut'],
      ['color', 'Color'],
    ])
  })

  it('should name the options anew when another language is chosen', async () => {
    // Arrange
    await stories.Kinds.run()

    // Act
    act(() => {
      languageStore.choose('en')
    })

    // Assert
    expect(offered()).toEqual([
      ['', '選ばない'],
      ['cut', 'Cut'],
      ['color', 'Color'],
    ])
  })
})
