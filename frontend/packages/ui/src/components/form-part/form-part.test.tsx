import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as formPartStories from './form-part.stories'

const stories = composeStories(formPartStories)

describe('FormPart', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should name its controls as a group', async () => {
    // Act
    await stories.Default.run()

    // Assert
    const part = screen.getByRole('group', { name: '連絡先' })
    expect(
      within(part).getByRole('textbox', { name: 'メールアドレス' }),
    ).toBeVisible()
    expect(
      within(part).getByRole('textbox', { name: '電話番号' }),
    ).toBeVisible()
    expect(part).toHaveClass('part')
  })

  it('should say what it says of all its controls before them', async () => {
    // Act
    await stories.WithNote.run()

    // Assert
    const note = screen.getByText(
      'どちらか一つは入れてください。予約の確認に使います。',
    )
    expect(note).toHaveClass('note')
    expect(note.nextElementSibling).toContainElement(
      screen.getByRole('textbox', { name: 'メールアドレス' }),
    )
  })

  it('should say nothing before its controls when it is given no note', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(
      screen.getByRole('group', { name: '連絡先' }).querySelector('p'),
    ).toBeNull()
  })

  it('should hand what else a fieldset takes to its fieldset', async () => {
    // Act
    await stories.Disabled.run()

    // Assert
    expect(screen.getByRole('textbox', { name: '電話番号' })).toBeDisabled()
  })

  it('should stand in a form with the other parts, each under its name', async () => {
    // Act
    await stories.InAForm.run()

    // Assert
    expect(
      screen.getAllByRole('group').map((part) => part.textContent),
    ).toEqual([
      expect.stringMatching(/^お名前/),
      expect.stringMatching(/^連絡先/),
    ])
  })
})
