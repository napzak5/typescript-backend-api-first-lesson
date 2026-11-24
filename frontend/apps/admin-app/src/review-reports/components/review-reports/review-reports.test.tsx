import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as reviewReportsStories from './review-reports.stories'

const stories = composeStories(reviewReportsStories)

describe('ReviewReports', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say what the reports are, and list them', async () => {
    // Act
    await stories.Reports.run()

    // Assert
    const part = screen.getByRole('region', { name: '通報' })
    expect(part).toHaveTextContent(
      'レビューが規則に反していなければ、通報を却下します。反していれば、「レビューの削除」から、レビューを削除します。',
    )
    expect(
      within(part).getByRole('table', { name: 'このレビューへの通報' }),
    ).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(part).not.toHaveTextContent('ほかの管理者が却下しました')
  })

  it('should ask before a report is dismissed, saying that a dismissal is not undone', async () => {
    // Arrange
    const onDismiss = vi.fn()
    const onClose = vi.fn()
    await stories.Asking.run({
      args: { ...stories.Asking.args, onDismiss, onClose },
    })
    const dialog = screen.getByRole('dialog', { name: '通報を却下しますか？' })
    expect(dialog).toHaveAccessibleDescription(
      '2026年11月20日（金） 10:30に受け付けた通報を却下します。却下した通報は未処理の通報から外れ、レビューは、そのまま掲載されます。却下は、取り消せません。',
    )

    // Act
    await userEvent.click(
      within(dialog).getByRole('button', { name: '却下する' }),
    )
    await userEvent.click(within(dialog).getByRole('button', { name: '戻る' }))

    // Assert
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('should say in the dialog what went wrong with the last attempt', async () => {
    // Act
    await stories.Failed.run()

    // Assert
    expect(
      within(screen.getByRole('dialog')).getByRole('alert'),
    ).toHaveTextContent('通報を却下できませんでした。')
  })

  it('should say above the reports why the last dismissal changed nothing', async () => {
    // Act
    await stories.DismissedMeanwhile.run()

    // Assert
    expect(
      within(screen.getByRole('region', { name: '通報' }))
        .getAllByRole('status')
        .map(({ textContent }) => textContent),
    ).toContain(
      'この通報は、その間に、ほかの管理者が却下しました。却下は、1 つの通報に 1 回です。',
    )
  })
})

describe('ReviewReports on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should ask in English before a report is dismissed, by when it was received', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Failed.run()

    // Assert
    expect(screen.getByRole('region', { name: 'Reports' })).toHaveTextContent(
      'When the review breaks no rule, dismiss them. When it does, delete it under “Deleting the review”.',
    )
    const dialog = screen.getByRole('dialog', { name: 'Dismiss the report?' })
    expect(dialog).toHaveAccessibleDescription(
      'This dismisses the report received on Fri, November 20, 2026 at 10:30. A dismissed report is no longer pending, and the review stays listed as it is. A dismissal cannot be undone.',
    )
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Could not dismiss the report. Check your connection and try again.',
    )
    expect(
      within(dialog).getByRole('button', { name: 'Dismiss' }),
    ).toBeVisible()
  })

  it('should say in English why the last dismissal changed nothing', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.DismissedMeanwhile.run()

    // Assert
    expect(
      within(screen.getByRole('region', { name: 'Reports' }))
        .getAllByRole('status')
        .map(({ textContent }) => textContent),
    ).toContain(
      'Meanwhile, another administrator dismissed this report. A report is dismissed once.',
    )
  })
})
