import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as writtenTextStories from './written-text.stories'

const stories = composeStories(writtenTextStories)

describe('WrittenText', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should keep the lines and the spaces as they were written', async () => {
    // Act
    await stories.Default.run()

    // Assert
    const written = screen.getByText(/前回と同じ長さでお願いします。/)
    expect(written.localName).toBe('p')
    expect(written.textContent).toBe(
      '前回と同じ長さでお願いします。\n\n前髪は  眉にかかるくらいに。',
    )
    expect(written).toHaveClass('writtenText')
  })

  it('should say that nothing was recorded, when nothing was written', async () => {
    // Act
    await stories.NotWritten.run()

    // Assert
    expect(screen.getByText('記録なし')).toHaveClass('notRecorded')
    expect(document.querySelector('p')).toBeNull()
  })

  it('should hand what else it is given to the paragraph', async () => {
    // Act
    await stories.Default.run({
      args: { ...stories.Default.args, className: 'placed' },
    })

    // Assert
    expect(screen.getByText(/前回と同じ長さでお願いします。/)).toHaveClass(
      'writtenText',
      'placed',
    )
  })
})
