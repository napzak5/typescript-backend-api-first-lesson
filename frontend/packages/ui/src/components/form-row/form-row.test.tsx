import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { createRef } from 'react'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as formRowStories from './form-row.stories'

const stories = composeStories(formRowStories)

describe('FormRow', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should name its controls by the row they are in', async () => {
    // Act
    await stories.Default.run()

    // Assert
    const row = screen.getByRole('group', { name: '1 件目の施術' })
    expect(row).toHaveClass('row')
    expect(within(row).getByRole('textbox', { name: '施術' })).toBeVisible()
    expect(within(row).getByLabelText('施術日')).toBeVisible()
    expect(within(row).getByRole('button', { name: '外す' })).toBeVisible()
  })

  it('should stand its rows one below the other in their part', async () => {
    // Act
    await stories.InAPart.run()

    // Assert
    const part = screen.getByRole('group', { name: '過去の施術' })
    expect(
      within(part)
        .getAllByRole('group')
        .map((row) => row.querySelector('legend')?.textContent),
    ).toEqual(['1 件目の施術', '2 件目の施術'])
  })

  it('should hand its fieldset to a form that moves the focus into it', async () => {
    // Arrange
    const ref = createRef<HTMLFieldSetElement>()

    // Act
    await stories.Default.run({ args: { ...stories.Default.args, ref } })

    // Assert
    expect(ref.current).toBe(
      screen.getByRole('group', { name: '1 件目の施術' }),
    )
  })
})
