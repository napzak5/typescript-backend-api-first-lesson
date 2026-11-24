import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

  it('should say at the details how long they may be', async () => {
    // Act
    await stories.Asking.run()

    // Assert
    expect(
      screen.getByRole('textbox', { name: '詳しい内容' }),
    ).toHaveAccessibleDescription(
      'どこが規則に反するかを、2,000 文字以内で書いてください。理由が「その他」のときは、必ず書いてください。',
    )
  })
})

describe('ReviewReport on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say what a report does, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Closed.run()

    // Assert
    expect(
      screen.getByRole('heading', {
        name: 'Report to the team that runs the site',
      }),
    ).toBeVisible()
    expect(screen.getByText(/A salon cannot delete a review/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Report' })).toBeVisible()
  })

  it('should ask for the reason and the details in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Asking.run()

    // Assert
    const dialog = screen.getByRole('dialog', { name: 'Report the review' })
    expect(dialog).toHaveAccessibleDescription(
      'This reports the review to the team that runs the site. Only the team reads the report: the customer who wrote the review is not told. Until the team has checked it, the review stays listed.',
    )
    expect(
      within(dialog).getByRole('radiogroup', { name: 'Reason for the report' }),
    ).toBeVisible()
    expect(
      [
        'Inappropriate language (abuse, discrimination and the like)',
        'Something that is not true',
        'Personal information (names, contact details and the like)',
        'Advertising, or something that has nothing to do with a visit',
        'Other',
      ].map((name) =>
        within(dialog).getByRole('radio', { name }).getAttribute('value'),
      ),
    ).toEqual([
      'inappropriate',
      'false_information',
      'personal_information',
      'spam',
      'other',
    ])
    expect(
      within(dialog).getByRole('textbox', { name: 'Details' }),
    ).toHaveAccessibleDescription(
      'Say how the review breaks the rules, in up to 2,000 characters. When the reason is “Other”, this is required.',
    )
  })

  it('should say in English what is wrong with the details, and that the account reported the review before', async () => {
    // Arrange
    languageStore.choose('en')
    await stories.WithErrors.run()

    // Assert
    expect(
      within(screen.getByRole('dialog')).getByRole('textbox', {
        name: 'Details',
      }),
    ).toHaveAccessibleDescription(
      /When you choose “Other”, say what the problem is\./,
    )

    // Act
    await stories.ReportedBefore.run()

    // Assert
    expect(
      within(screen.getByRole('dialog')).getByRole('status'),
    ).toHaveTextContent(
      'This account has reported this review already. A review can be reported once.',
    )
  })
})
