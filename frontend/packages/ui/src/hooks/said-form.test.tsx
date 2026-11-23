import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import {
  answerMessages,
  fieldMessages,
} from '@beauty-salon-shared/i18n/messages/ui'
import { composeStories } from '@storybook/react-vite'
import { act } from 'react'
import { screen } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as saidFormStories from './said-form.stories'

const stories = composeStories(saidFormStories)

const email = () => screen.getByRole('textbox', { name: 'メールアドレス' })
const phone = () => screen.getByRole('textbox', { name: '電話番号' })

describe('useSaidForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  afterEach(() => {
    localStorage.clear()
  })

  it('should say the message about the attempt in Japanese on a page of no choice', async () => {
    // Act
    await stories.Unsent.run()

    // Assert
    expect(screen.getByRole('alert').textContent).toBe(
      answerMessages.notSent.ja,
    )
  })

  it('should say the message about the attempt in English on a page in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Unsent.run()

    // Assert
    expect(screen.getByRole('alert').textContent).toBe(
      answerMessages.notSent.en,
    )
  })

  it('should say the error at its control, and nothing at a control that has none', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(email()).toHaveAccessibleDescription(fieldMessages.emailMalformed.ja)
    expect(email()).toHaveFocus()
    expect(phone()).toHaveAccessibleDescription('')
    expect(phone()).not.toHaveAttribute('aria-invalid', 'true')
  })

  it('should say the errors anew in another language, and leave the focus where it is', async () => {
    // Arrange
    await stories.WithErrors.run()
    phone().focus()

    // Act
    act(() => {
      languageStore.choose('en')
    })

    // Assert
    expect(email()).toHaveAccessibleDescription(fieldMessages.emailMalformed.en)
    expect(phone()).toHaveFocus()
  })
})
