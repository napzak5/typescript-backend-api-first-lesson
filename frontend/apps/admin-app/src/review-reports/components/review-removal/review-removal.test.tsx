import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as reviewRemovalStories from './review-removal.stories'

const stories = composeStories(reviewRemovalStories)

describe('ReviewRemoval', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say what a removal does, and open the dialog when its button is pressed', async () => {
    // Arrange
    const onAsk = vi.fn()
    await stories.Offered.run({ args: { ...stories.Offered.args, onAsk } })

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'レビューを削除する' }),
    )

    // Assert
    expect(
      screen.getByRole('region', { name: 'レビューの削除' }),
    ).toHaveTextContent(
      '削除すると、お客様の画面とサロンの画面から消え、このレビューへの通報も消えます。削除したレビューは、元に戻せません。',
    )
    expect(screen.queryByRole('alert')).toBeNull()
    expect(onAsk).toHaveBeenCalledOnce()
  })

  it('should ask before the review is removed, by its name', async () => {
    // Arrange
    const onRemove = vi.fn()
    const onClose = vi.fn()
    await stories.Asking.run({
      args: { ...stories.Asking.args, onRemove, onClose },
    })
    const dialog = screen.getByRole('dialog', {
      name: '「評価 3 のレビュー」を削除しますか？',
    })
    expect(dialog).toHaveAccessibleDescription(
      '削除したレビューは、元に戻せません。このレビューへの通報も、一緒に消えます。',
    )

    // Act
    await userEvent.click(
      within(dialog).getByRole('button', { name: '削除する' }),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '戻る' }))

    // Assert
    expect(onRemove).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('should say in the dialog what went wrong with the last attempt', async () => {
    // Act
    await stories.Failed.run()

    // Assert
    expect(
      within(screen.getByRole('dialog')).getByRole('alert'),
    ).toHaveTextContent('レビューを削除できませんでした。')
  })

  it('should say why the account removes nothing', async () => {
    // Act
    await stories.Forbidden.run()

    // Assert
    expect(
      within(screen.getByRole('region', { name: 'レビューの削除' })).getByRole(
        'alert',
      ),
    ).toHaveTextContent('このアカウントでは、このレビューを削除できません。')
  })
})

describe('ReviewRemoval on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say what a removal does, and ask before it by the name of the review, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Asking.run()

    // Assert
    expect(
      screen.getByRole('region', { name: 'Deleting the review' }),
    ).toHaveTextContent(
      'Delete a review that breaks the rules. A deleted review is gone from the screens of the customers and of the salon, with its reports. It cannot be brought back.',
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Delete “Review rated 3”?',
    })
    expect(dialog).toHaveAccessibleDescription(
      'A deleted review cannot be brought back. Its reports go with it.',
    )
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'Back' })).toBeVisible()
  })

  it('should say in English what went wrong, and why the account removes nothing', async () => {
    // Arrange
    languageStore.choose('en')
    await stories.Failed.run()

    // Assert
    expect(
      within(screen.getByRole('dialog')).getByRole('alert'),
    ).toHaveTextContent(
      'Could not delete the review. Check your connection and try again.',
    )

    // Act
    await stories.Forbidden.run()

    // Assert
    expect(
      within(
        screen.getByRole('region', { name: 'Deleting the review' }),
      ).getByRole('alert'),
    ).toHaveTextContent('This account cannot delete this review.')
  })
})
