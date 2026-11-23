import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { fireEvent, screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as reviewRemovalStories from './review-removal.stories'

const stories = composeStories(reviewRemovalStories)

const QUESTION = 'レビューを削除しますか？'

const dialog = () => screen.getByRole('dialog', { name: QUESTION })
const removeButton = () =>
  within(dialog()).getByRole('button', { name: '削除する' })

describe('ReviewRemoval', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should ask whether to remove, name the review, and say what goes with it and that the visit can be written about again', async () => {
    // Act
    await stories.Asking.run()

    // Assert
    expect(dialog()).toHaveAttribute('open')
    expect(dialog()).toHaveAccessibleDescription(
      'Beauty Salon Tokyo（2026年11月10日 投稿）のレビューを削除します。削除したレビューは、サロンからの返信とともに消え、元に戻せません。この来店のレビューは、もう一度書けます。',
    )
    expect(within(dialog()).queryByRole('alert')).toBeNull()
  })

  it('should ask nothing while it is closed', async () => {
    // Act
    await stories.Closed.run()

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('should hold its buttons in the order they are read, the one that changes nothing first', async () => {
    // Act
    await stories.Asking.run()

    // Assert
    expect(
      within(dialog())
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['戻る', '削除する'])
  })

  it('should say that the customer confirmed when the button that removes is pressed', async () => {
    // Arrange
    await stories.Asking.run()

    // Act
    await userEvent.click(removeButton())

    // Assert
    expect(stories.Asking.args.onRemove).toHaveBeenCalledTimes(1)
    expect(stories.Asking.args.onClose).not.toHaveBeenCalled()
  })

  it('should remove nothing, and say that it is to be closed, when the button that changes nothing is pressed', async () => {
    // Arrange
    await stories.Asking.run()

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '戻る' }),
    )

    // Assert
    expect(stories.Asking.args.onClose).toHaveBeenCalledTimes(1)
    expect(stories.Asking.args.onRemove).not.toHaveBeenCalled()
  })

  it('should tell its caller when the Escape key closes it', async () => {
    // Arrange
    await stories.Asking.run()

    // Act
    fireEvent(dialog(), new Event('cancel'))

    // Assert
    expect(stories.Asking.args.onClose).toHaveBeenCalledTimes(1)
  })

  it('should show that the removal is on its way, and not ask for it a second time', async () => {
    // Arrange
    await stories.Pending.run()

    // Act
    await userEvent.click(removeButton())

    // Assert
    expect(removeButton()).toHaveAttribute('aria-busy', 'true')
    expect(stories.Pending.args.onRemove).not.toHaveBeenCalled()
  })

  it('should say in the dialog what went wrong, and keep the button that tries again', async () => {
    // Act
    await stories.WithMessage.run()

    // Assert
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(removeButton()).toBeEnabled()
  })
})

describe('ReviewRemoval on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should ask in English whether to remove, and name the review', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Asking.run()

    // Assert
    const asking = screen.getByRole('dialog', { name: 'Delete the review?' })
    expect(asking).toHaveAccessibleDescription(
      'This deletes your review of Beauty Salon Tokyo (posted November 10, 2026). A deleted review is gone for good, together with the reply of the salon. You can write a review of this visit again.',
    )
    expect(
      within(asking)
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Back', 'Delete'])
  })

  it('should say in English what went wrong', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithMessage.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'It could not be sent. Check your connection and try again.',
    )
  })
})
