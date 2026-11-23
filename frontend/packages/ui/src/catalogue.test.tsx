import { languageStore } from '@beauty-salon-frontend/io'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as notRecordedStories from './components/not-recorded/not-recorded.stories'

const { Default } = composeStories(notRecordedStories)

/** The story as the catalogue shows it when its toolbar names a language */
const runIn = (language: string): Promise<void> =>
  Default.run({ globals: { ...Default.globals, language } })

describe('the language of the catalogue', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should show a story in the language its toolbar names, and keep the choice where an application keeps it', async () => {
    // Act
    await runIn('en')

    // Assert
    expect(screen.getByText('Not recorded')).toBeVisible()
    expect(languageStore.read()).toBe('en')
  })

  it('should show a story in Japanese again when the toolbar names it', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await runIn('ja')

    // Assert
    expect(screen.getByText('記録なし')).toBeVisible()
    expect(languageStore.read()).toBe('ja')
  })

  it('should choose nothing for a story whose toolbar names no language: the page keeps the one it has', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await Default.run()

    // Assert
    expect(screen.getByText('Not recorded')).toBeVisible()
    expect(languageStore.read()).toBe('en')
  })

  it('should choose nothing when the toolbar names a language the page does not have', async () => {
    // Act
    await runIn('fr')

    // Assert
    expect(screen.getByText('記録なし')).toBeVisible()
    expect(localStorage.getItem('beauty-salon:language')).toBeNull()
  })
})
