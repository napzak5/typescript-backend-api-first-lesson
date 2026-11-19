import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { fireEvent, screen, userEvent } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as buttonStories from './button.stories'

const stories = composeStories(buttonStories)

describe('Button', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should call onClick when it is pressed', async () => {
    // Arrange
    await stories.Primary.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: '予約する' }))

    // Assert
    expect(stories.Primary.args.onClick).toHaveBeenCalledTimes(1)
  })

  it('should be pressed with the keyboard', async () => {
    // Arrange
    await stories.Primary.run()

    // Act
    await userEvent.tab()
    await userEvent.keyboard('{Enter}')

    // Assert
    expect(screen.getByRole('button', { name: '予約する' })).toHaveFocus()
    expect(stories.Primary.args.onClick).toHaveBeenCalledTimes(1)
  })

  it('should not submit a form unless it is given the type submit', async () => {
    // Act
    await stories.Primary.run()

    // Assert
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('should not be pressed while it is disabled', async () => {
    // Arrange
    await stories.Disabled.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: '予約する' }))

    // Assert
    expect(screen.getByRole('button', { name: '予約する' })).toBeDisabled()
    expect(stories.Disabled.args.onClick).not.toHaveBeenCalled()
  })

  it('should stay focusable and say it is busy while its action is pending', async () => {
    // Arrange
    await stories.Pending.run()
    const button = screen.getByRole('button', { name: '予約しています' })

    // Act
    await userEvent.tab()
    await userEvent.click(button)

    // Assert
    expect(button).toHaveFocus()
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(stories.Pending.args.onClick).not.toHaveBeenCalled()
  })

  it('should not submit its form while its action is pending', async () => {
    // Arrange
    await stories.Pending.run({
      args: { ...stories.Pending.args, type: 'submit' },
    })

    // Act
    const submits = fireEvent.click(screen.getByRole('button'))

    // Assert
    expect(submits).toBe(false)
  })

  it.each([
    { story: stories.Secondary, variant: 'secondary' },
    { story: stories.Primary, variant: 'primary' },
    { story: stories.Quiet, variant: 'quiet' },
    { story: stories.Danger, variant: 'danger' },
  ])(
    'should carry the class of the $variant variant',
    async ({ story, variant }) => {
      // Act
      await story.run()

      // Assert
      expect(screen.getByRole('button')).toHaveClass('button', variant)
    },
  )

  it('should keep a class its container gives it', async () => {
    // Act
    await stories.Small.run({
      args: { ...stories.Small.args, className: 'in-toolbar' },
    })

    // Assert
    expect(screen.getByRole('button')).toHaveClass(
      'button',
      'small',
      'in-toolbar',
    )
  })
})
