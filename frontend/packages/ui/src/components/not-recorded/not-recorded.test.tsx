import { languageStore } from '@beauty-salon-frontend/io'
import {
  changeInAnotherTab,
  itShouldBeAccessibleInEveryStory,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { act } from 'react'
import { screen } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as notRecordedStories from './not-recorded.stories'

const stories = composeStories(notRecordedStories)

describe('NotRecorded', () => {
  itShouldBeAccessibleInEveryStory(stories)

  afterEach(() => {
    localStorage.clear()
  })

  it('should say in words, quietly, that nothing was recorded', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.getByText('記録なし')).toHaveClass('notRecorded')
  })

  it('should say it in English on a page in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Default.run()

    // Assert
    expect(screen.getByText('Not recorded')).toHaveClass('notRecorded')
    expect(screen.queryByText('記録なし')).toBeNull()
  })

  it('should say it anew when another language is chosen while it is shown, and in Japanese again when that is chosen', async () => {
    // Arrange
    await stories.Default.run()

    // Act
    act(() => {
      languageStore.choose('en')
    })
    const inEnglish = screen.getByText('Not recorded')
    act(() => {
      languageStore.choose('ja')
    })

    // Assert
    expect(inEnglish).toHaveTextContent('記録なし')
    expect(screen.queryByText('Not recorded')).toBeNull()
  })

  it('should say it anew when another tab chooses another language', async () => {
    // Arrange
    await stories.Default.run()

    // Act
    act(() => {
      changeInAnotherTab('beauty-salon:language', 'en')
    })

    // Assert
    expect(screen.getByText('Not recorded')).toBeVisible()
  })

  it('should say it in Japanese when the browser keeps a language that is none of the page', async () => {
    // Arrange
    localStorage.setItem('beauty-salon:language', 'fr')

    // Act
    await stories.Default.run()

    // Assert
    expect(screen.getByText('記録なし')).toBeVisible()
  })
})
