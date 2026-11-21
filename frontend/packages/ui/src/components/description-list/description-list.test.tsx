import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as descriptionListStories from './description-list.stories'

const stories = composeStories(descriptionListStories)

describe('DescriptionList', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show each name with its value, in order', async () => {
    // Act
    await stories.Default.run()

    // Assert
    expect(screen.getAllByRole('term').map((term) => term.textContent)).toEqual(
      ['お名前', '電話番号', 'メールアドレス'],
    )
    expect(
      screen
        .getAllByRole('definition')
        .map((definition) => definition.textContent),
    ).toEqual(['山田 花子', '090-1234-5678', 'hanako@example.com'])
  })

  it('should keep each name and its value together', async () => {
    // Act
    await stories.Default.run()

    // Assert
    for (const term of screen.getAllByRole('term')) {
      expect(term.nextElementSibling?.tagName).toBe('DD')
      expect(term.parentElement?.children).toHaveLength(2)
    }
  })

  it('should say quietly of a value that was not recorded that it was not', async () => {
    // Act
    await stories.WithOtherContent.run()

    // Assert
    const notRecorded = screen.getByText('記録なし')
    expect(notRecorded).toHaveClass('notRecorded')
    expect(notRecorded.closest('dd')).not.toBeNull()
  })

  it('should show a value that is more than text', async () => {
    // Act
    await stories.WithOtherContent.run()

    // Assert
    expect(screen.getAllByRole('definition')[0]).toContainElement(
      screen.getByText('確定'),
    )
  })

  it('should keep a class its container gives it', async () => {
    // Act
    await stories.Default.run({
      args: { ...stories.Default.args, className: 'in-card' },
    })

    // Assert
    expect(screen.getAllByRole('term')[0]?.closest('dl')).toHaveClass(
      'list',
      'in-card',
    )
  })
})
