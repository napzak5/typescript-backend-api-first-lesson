import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as noteStories from './note.stories'

const stories = composeStories(noteStories)

describe('Note', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say what it says as a paragraph, quietly', async () => {
    // Act
    await stories.Default.run()

    // Assert
    const note = screen.getByText(
      '直近 90 日の予約を、新しいものから表示しています。',
    )
    expect(note.localName).toBe('p')
    expect(note).toHaveClass('note')
    expect(note).not.toHaveClass('small')
  })

  it('should say in small letters what supports a control', async () => {
    // Act
    await stories.Small.run()

    // Assert
    expect(
      screen.getByText('曜日ごとに、開店と閉店の時刻を入れてください。'),
    ).toHaveClass('note', 'small')
  })

  it('should hand what else it is given to the paragraph', async () => {
    // Act
    await stories.Default.run({
      args: { ...stories.Default.args, id: 'reading', className: 'placed' },
    })

    // Assert
    const note = screen.getByText(
      '直近 90 日の予約を、新しいものから表示しています。',
    )
    expect(note).toHaveAttribute('id', 'reading')
    expect(note).toHaveClass('note', 'placed')
  })
})
