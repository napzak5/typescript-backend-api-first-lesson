import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { fireEvent, screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as reviewReportStories from './review-report.stories'

const stories = composeStories(reviewReportStories)

const TITLE = 'レビューを通報する'

const dialog = () => screen.getByRole('dialog', { name: TITLE })
const reasons = () =>
  within(dialog()).getByRole('radiogroup', { name: '通報の理由' })
const reason = (name: string) => within(dialog()).getByRole('radio', { name })
const details = () =>
  within(dialog()).getByRole('textbox', { name: '詳しい内容' })
const reportButton = () =>
  within(dialog()).getByRole('button', { name: '通報する' })
const buttons = (): (string | null)[] =>
  within(dialog())
    .getAllByRole('button')
    .map((button) => button.textContent)

type Sent = [string, FormDataEntryValue][]

/** A callback that keeps what the form was sent with. */
const keeping = (received: Sent[]) =>
  vi.fn((values: FormData) => {
    received.push(Array.from(values.entries()))
  })

describe('ReviewReport', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should name the review, and say who looks at the report and that the review stays until then', async () => {
    // Act
    await stories.Asking.run()

    // Assert
    expect(dialog()).toHaveAttribute('open')
    expect(dialog()).toHaveAccessibleDescription(
      '「思ったとおりの色になりました」（2026年11月10日 投稿）のレビューを、運営に通報します。運営が内容を確かめ、規則に反するレビューは削除します。確かめが済むまで、レビューは掲載されたままです。',
    )
    expect(within(dialog()).queryByRole('alert')).toBeNull()
  })

  it('should ask nothing while it is closed', async () => {
    // Act
    await stories.Closed.run()

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('should offer the reasons the API takes, in one order, with none chosen, and ask for one', async () => {
    // Act
    await stories.Asking.run()

    // Assert
    expect(
      within(reasons())
        .getAllByRole('radio')
        .map((option) => [
          option.getAttribute('value'),
          option.closest('label')?.textContent,
          option.matches(':checked'),
        ]),
    ).toEqual([
      ['inappropriate', '不適切な表現（暴言、差別的な表現など）', false],
      ['false_information', '事実と違う内容', false],
      ['personal_information', '個人情報（氏名や連絡先など）', false],
      ['spam', '宣伝や、来店と関係のない内容', false],
      ['other', 'その他', false],
    ])
    expect(reason('その他')).toBeRequired()
  })

  it('should take what there is to say in no more characters than the API takes, and say when it has to be said', async () => {
    // Act
    await stories.Asking.run()

    // Assert
    expect(details()).toHaveAttribute('maxlength', '2000')
    expect(details()).not.toBeRequired()
    expect(details()).toHaveAccessibleDescription(
      'どこが問題かを、2000 文字以内でご記入ください。理由が「その他」のときは、必ずご記入ください。',
    )
  })

  it('should hold its buttons in the order they are read, the one that changes nothing first', async () => {
    // Act
    await stories.Asking.run()

    // Assert
    expect(buttons()).toEqual(['戻る', '通報する'])
  })

  it('should hand over the reason and what was said about it when the form is sent', async () => {
    // Arrange
    const received: Sent[] = []
    await stories.Asking.run({
      args: { ...stories.Asking.args, onReport: keeping(received) },
    })

    // Act
    await userEvent.click(reason('事実と違う内容'))
    await userEvent.type(details(), '来店した日が違います')
    await userEvent.click(reportButton())

    // Assert
    expect(received).toEqual([
      [
        ['reason', 'false_information'],
        ['details', '来店した日が違います'],
      ],
    ])
  })

  it('should hand over a form without a reason as it is: its caller says what is missing', async () => {
    // Arrange
    const received: Sent[] = []
    await stories.Asking.run({
      args: { ...stories.Asking.args, onReport: keeping(received) },
    })

    // Act
    await userEvent.click(reportButton())

    // Assert
    expect(received).toEqual([[['details', '']]])
  })

  it('should choose a reason with the keyboard', async () => {
    // Arrange
    const received: Sent[] = []
    await stories.Asking.run({
      args: { ...stories.Asking.args, onReport: keeping(received) },
    })
    reason('不適切な表現（暴言、差別的な表現など）').focus()

    // Act
    await userEvent.keyboard(' {ArrowDown}{ArrowDown}')
    await userEvent.click(reportButton())

    // Assert
    expect(received).toEqual([
      [
        ['reason', 'personal_information'],
        ['details', ''],
      ],
    ])
  })

  it('should send nothing, and say that it is to be closed, when the button that changes nothing is pressed', async () => {
    // Arrange
    await stories.Asking.run()

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '戻る' }),
    )

    // Assert
    expect(stories.Asking.args.onClose).toHaveBeenCalledTimes(1)
    expect(stories.Asking.args.onReport).not.toHaveBeenCalled()
  })

  it('should tell its caller when the Escape key closes it', async () => {
    // Arrange
    await stories.Asking.run()

    // Act
    fireEvent(dialog(), new Event('cancel'))

    // Assert
    expect(stories.Asking.args.onClose).toHaveBeenCalledTimes(1)
  })

  it('should show that the report is on its way, and not send it a second time', async () => {
    // Arrange
    await stories.Pending.run()
    await userEvent.click(reason('その他'))

    // Act
    await userEvent.click(reportButton())
    fireEvent.submit(details())

    // Assert
    expect(reportButton()).toHaveAttribute('aria-busy', 'true')
    expect(stories.Pending.args.onReport).not.toHaveBeenCalled()
  })

  it('should say in the dialog what went wrong with the attempt, and keep the form', async () => {
    // Act
    await stories.WithMessage.run()

    // Assert
    expect(within(dialog()).getByRole('alert')).toHaveTextContent(
      '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(reportButton()).toBeEnabled()
    expect(details()).toBeVisible()
  })

  it('should say at the reasons that one is missing, and move the focus to the first of them, when the form was sent', async () => {
    // Act
    await stories.WithoutReason.run()

    // Assert
    expect(reasons()).toHaveAttribute('aria-invalid', 'true')
    expect(reasons()).toHaveAccessibleDescription(
      '通報の理由を選んでください。',
    )
    expect(reason('不適切な表現（暴言、差別的な表現など）')).toHaveFocus()
    expect(details()).not.toHaveAttribute('aria-invalid')
  })

  it('should say at the details what is missing, and move the focus there, when the form was sent', async () => {
    // Act
    await stories.WithoutDetails.run()

    // Assert
    expect(details()).toHaveAttribute('aria-invalid', 'true')
    expect(details()).toHaveAccessibleDescription(
      'どこが問題かを、2000 文字以内でご記入ください。理由が「その他」のときは、必ずご記入ください。 「その他」を選んだときは、何が問題かを入力してください。',
    )
    expect(details()).toHaveFocus()
    expect(reasons()).not.toHaveAttribute('aria-invalid')
  })

  it('should say that the review was reported before, in place of the form, and move the focus to what it says', async () => {
    // Act
    await stories.ReportedBefore.run()

    // Assert
    expect(within(dialog()).getByRole('status')).toHaveTextContent(
      'このレビューは、すでに通報しています。1 つのレビューを通報できるのは、1 回です。',
    )
    expect(within(dialog()).queryByRole('radiogroup')).toBeNull()
    expect(within(dialog()).queryByRole('textbox')).toBeNull()
    expect(buttons()).toEqual(['閉じる'])
    expect(within(dialog()).getByRole('status').parentElement).toHaveFocus()
  })

  it('should say that it is to be closed when the way out of a report that was made before is pressed', async () => {
    // Arrange
    await stories.ReportedBefore.run()

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '閉じる' }),
    )

    // Assert: the form was sent once, by the story
    expect(stories.ReportedBefore.args.onClose).toHaveBeenCalledTimes(1)
    expect(stories.ReportedBefore.args.onReport).toHaveBeenCalledTimes(1)
  })
})
