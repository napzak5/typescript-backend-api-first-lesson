import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as fieldRowStories from './field-row.stories'

const stories = composeStories(fieldRowStories)

/** The row a control stands in: the parent of the root of its field */
const rowOf = (control: HTMLElement) =>
  control.closest('div[class~="row"]') ?? undefined

describe('FieldRow', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should put two controls side by side where there is room', async () => {
    // Act
    await stories.Two.run()

    // Assert
    const row = rowOf(screen.getByRole('textbox', { name: 'セイ' }))
    expect(row).toHaveClass('row two', { exact: true })
    expect(row).toContainElement(screen.getByRole('textbox', { name: 'メイ' }))
  })

  it('should put three controls side by side where there is room', async () => {
    // Act
    await stories.Three.run()

    // Assert
    const row = rowOf(screen.getByRole('textbox', { name: '仕入れ値' }))
    expect(row).toHaveClass('row three', { exact: true })
    expect(row?.children).toHaveLength(3)
  })
})
