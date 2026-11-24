import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as profileFormStories from './profile-form.stories'

const stories = composeStories(profileFormStories)

describe('ProfileForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should open with the profile as it is, and send what it holds', async () => {
    // Arrange
    const received: FormData[] = []
    await stories.AsItIs.run({
      args: {
        ...stories.AsItIs.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(values)
        }),
      },
    })

    // Act
    await userEvent.type(
      screen.getByRole('textbox', { name: '専門' }),
      '、パーマ',
    )
    await userEvent.click(screen.getByRole('button', { name: '保存する' }))

    // Assert
    expect(received.map((values) => values.get('specialties'))).toEqual([
      'カット、カラー、パーマ',
    ])
    expect(screen.getByRole('textbox', { name: '資格' })).toHaveValue(
      '美容師免許',
    )
  })

  it('should say above the controls what went wrong', async () => {
    // Act
    await stories.Failed.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'プロフィールを保存できませんでした。',
    )
  })
})

describe('ProfileForm on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name its controls and its button, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.AsItIs.run()

    // Assert
    expect(screen.getByRole('textbox', { name: 'Specialties' })).toHaveValue(
      'カット, カラー',
    )
    expect(screen.getByRole('button', { name: 'Save' })).toBeVisible()
  })

  it('should say what is wrong under the control and what went wrong above the controls, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithErrors.run()

    // Assert
    expect(
      screen.getByRole('textbox', { name: 'Photo URL' }),
    ).toHaveAccessibleDescription(
      expect.stringContaining('Enter a URL that begins with http://'),
    )

    // Act
    await stories.Failed.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not save the profile. Check your connection and try again.',
    )
  })
})
