import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as languageChoiceStories from './language-choice.stories'

const stories = composeStories(languageChoiceStories)

describe('LanguageChoice', () => {
  itShouldBeAccessibleInEveryStory(stories)

  afterEach(() => {
    localStorage.clear()
  })

  it('should name each language in that language, and mark it as written in it', async () => {
    // Act
    await stories.InHeader.run()

    // Assert
    const options = within(
      screen.getByRole('combobox', { name: '言語' }),
    ).getAllByRole('option')
    expect(options.map((option) => [option.textContent, option.lang])).toEqual([
      ['English', 'en'],
      ['日本語', 'ja'],
    ])
  })

  it.each([
    ['InHeader', stories.InHeader, 'ja'],
    ['EnglishInHeader', stories.EnglishInHeader, 'en'],
  ] as const)(
    'should show the language of the page as the one chosen: %s',
    async (_name, story, language) => {
      // Act
      await story.run()

      // Assert
      expect(screen.getByRole('combobox', { name: '言語' })).toHaveValue(
        language,
      )
    },
  )

  it('should be named in the header without showing its name', async () => {
    // Act
    await stories.InHeader.run()

    // Assert: the language it shows says what it is
    expect(screen.getByRole('combobox', { name: '言語' })).toBeVisible()
    expect(screen.queryByText('言語')).toBeNull()
  })

  it('should show its name above it in the menu', async () => {
    // Act
    await stories.InMenu.run()

    // Assert
    expect(screen.getByText('言語')).toBeVisible()
    expect(screen.getByRole('combobox', { name: '言語' })).toBeVisible()
  })

  it.each([
    ['InHeader', stories.InHeader],
    ['InMenu', stories.InMenu],
  ] as const)(
    'should report the language that is chosen: %s',
    async (_name, story) => {
      // Arrange
      await story.run()

      // Act
      await userEvent.selectOptions(
        screen.getByRole('combobox', { name: '言語' }),
        'English',
      )

      // Assert
      expect(story.args.onChoose).toHaveBeenCalledExactlyOnceWith('en')
    },
  )

  it('should be named in English on a page in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.InMenu.run()

    // Assert
    expect(screen.getByRole('combobox', { name: 'Language' })).toBeVisible()
    expect(screen.getByText('Language')).toBeVisible()
  })
})
