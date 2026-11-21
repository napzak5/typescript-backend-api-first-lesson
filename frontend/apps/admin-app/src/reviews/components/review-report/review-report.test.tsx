import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as reviewReportStories from './review-report.stories'

const stories = composeStories(reviewReportStories)

describe('ReviewReport', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say what a report does, and open the dialog when its button is pressed', async () => {
    // Arrange
    await stories.Closed.run()
    const onAsk = vi.mocked(stories.Closed.args.onAsk ?? (() => undefined))
    expect(screen.getByRole('heading', { name: '運営への通報' })).toBeVisible()
    expect(
      screen.getByText(/サロンは、レビューを削除できません。/),
    ).toBeVisible()
    expect(screen.queryByRole('dialog')).toBeNull()

    // Act
    await userEvent.click(screen.getByRole('button', { name: '通報する' }))

    // Assert
    expect(onAsk).toHaveBeenCalledOnce()
  })

  it('should ask for the reason among those of the platform, and for the details', async () => {
    // Act
    await stories.Asking.run()

    // Assert
    const dialog = screen.getByRole('dialog', { name: 'レビューを通報する' })
    expect(dialog).toHaveAccessibleDescription(
      'このレビューを、運営に通報します。通報の内容を読むのは運営だけで、レビューを書いたお客様には伝わりません。確かめが済むまで、レビューは掲載されたままです。',
    )
    expect(
      within(dialog)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('value')),
    ).toEqual([
      'inappropriate',
      'false_information',
      'personal_information',
      'spam',
      'other',
    ])
    expect(
      within(dialog).getByRole('radio', { name: 'その他' }),
    ).not.toBeChecked()
    expect(
      within(dialog).getByRole('textbox', { name: '詳しい内容' }),
    ).toHaveAttribute('maxlength', '2000')
  })

  it('should hand over the reason and the details that were given', async () => {
    // Arrange
    await stories.Asking.run()
    const onReport = vi.mocked(
      stories.Asking.args.onReport ?? (() => undefined),
    )
    const dialog = screen.getByRole('dialog')

    // Act
    await userEvent.click(
      within(dialog).getByRole('radio', { name: '事実と違う内容' }),
    )
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: '詳しい内容' }),
      '来店していない日のレビューです。',
    )
    await userEvent.click(
      within(dialog).getByRole('button', { name: '通報する' }),
    )

    // Assert
    const [values] = onReport.mock.lastCall ?? []
    expect(values?.get('reason')).toBe('false_information')
    expect(values?.get('details')).toBe('来店していない日のレビューです。')
  })

  it('should say what is wrong with the details at their control', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    const details = within(screen.getByRole('dialog')).getByRole('textbox', {
      name: '詳しい内容',
    })
    expect(details).toBeInvalid()
    expect(details).toHaveAccessibleDescription(
      /「その他」を選んだときは、何が問題かを入力してください。/,
    )
  })

  it('should say that the account reported the review before, move the focus to what it says, and offer to close the dialog alone', async () => {
    // Act
    await stories.ReportedBefore.run()

    // Assert
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('status')).toHaveTextContent(
      'このアカウントでは、このレビューをもう通報しています。',
    )
    expect(within(dialog).queryByRole('radio')).toBeNull()
    expect(
      within(dialog)
        .getAllByRole('button')
        .map(({ textContent }) => textContent),
    ).toEqual(['閉じる'])
    expect(within(dialog).getByRole('status').parentElement).toHaveFocus()
  })
})
