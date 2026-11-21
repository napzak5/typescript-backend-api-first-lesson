import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { fireEvent, screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as statusActionsStories from './status-actions.stories'

const stories = composeStories(statusActionsStories)

const part = (): HTMLElement => screen.getByRole('region', { name: '状態' })

const buttonsOf = (): string[] =>
  within(part())
    .getAllByRole('button')
    .map((button) => button.textContent ?? '')

const dialog = (): HTMLElement => screen.getByRole('dialog')

/** What a form handed over, as pairs. */
const entriesOf = (
  handler: ((values: FormData) => void) | undefined,
): [string, FormDataEntryValue][][] =>
  vi
    .mocked(handler ?? (() => undefined))
    .mock.calls.map(([values]) => Array.from(values.entries()))

describe('StatusActions', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show the state, and the operations the booking takes', async () => {
    // Act
    await stories.Pending.run()

    // Assert
    expect(within(part()).getByText('確定待ち')).toBeVisible()
    expect(buttonsOf()).toEqual(['予約を確定する', '予約をキャンセルする'])
  })

  it('should offer every operation of a confirmed booking whose time has come', async () => {
    // Act
    await stories.Confirmed.run()

    // Assert
    expect(buttonsOf()).toEqual([
      '施術を始める',
      '完了にする',
      '無断キャンセルを記録する',
      '予約をキャンセルする',
    ])
  })

  it('should say that a closed booking cannot be changed', async () => {
    // Act
    await stories.Completed.run()

    // Assert
    expect(within(part()).queryByRole('button')).toBeNull()
    expect(
      within(part()).getByText(/この予約の状態は、もう変えられません。/),
    ).toBeVisible()
  })

  it('should confirm at once, without a dialog', async () => {
    // Arrange
    await stories.Pending.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '予約を確定する' }),
    )

    // Assert
    expect(stories.Pending.args.onAct).toHaveBeenCalledWith('confirm')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('should begin the treatment at once', async () => {
    // Arrange
    await stories.Confirmed.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name: '施術を始める' }))

    // Assert
    expect(stories.Confirmed.args.onAct).toHaveBeenCalledWith('start')
  })

  it('should show that the confirmation is on its way, and not send it again', async () => {
    // Arrange
    await stories.Confirming.run()
    const button = screen.getByRole('button', { name: '予約を確定する' })

    // Act
    await userEvent.click(button)

    // Assert
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(stories.Confirming.args.onAct).not.toHaveBeenCalled()
  })

  it.each([
    ['完了にする', 'complete'],
    ['無断キャンセルを記録する', 'noShow'],
    ['予約をキャンセルする', 'cancel'],
  ])('should ask first when %s is pressed', async (name, action) => {
    // Arrange
    await stories.Confirmed.run()

    // Act
    await userEvent.click(screen.getByRole('button', { name }))

    // Assert
    expect(stories.Confirmed.args.onAsk).toHaveBeenCalledWith(action)
  })

  it('should ask for the times the treatment actually took, on the clock of the salon', async () => {
    // Act
    await stories.AskingCompletion.run()

    // Assert
    expect(
      within(dialog()).getByRole('heading', { name: '予約を完了にしますか？' }),
    ).toBeVisible()
    expect(dialog()).toHaveAccessibleDescription(
      '2026年11月20日（金） 10:00〜11:00の予約を完了にします。完了にした予約は、元に戻せません。',
    )
    const start = within(dialog()).getByLabelText('実際の開始')
    expect(start).toHaveAttribute('type', 'datetime-local')
    expect(start).toHaveAccessibleDescription(
      'サロンの時計の日時。空欄のときは、施術を始めたときに記録した日時（2026年11月20日（金） 10:05）のままです。',
    )
    expect(within(dialog()).getByLabelText('実際の終了')).toHaveAttribute(
      'type',
      'datetime-local',
    )
  })

  it('should hand over the times that were filled in', async () => {
    // Arrange
    await stories.AskingCompletion.run()
    fireEvent.change(within(dialog()).getByLabelText('実際の終了'), {
      target: { value: '2026-11-20T11:10' },
    })

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '完了にする' }),
    )

    // Assert
    expect(entriesOf(stories.AskingCompletion.args.onComplete)).toEqual([
      [
        ['actualStartTime', ''],
        ['actualEndTime', '2026-11-20T11:10'],
      ],
    ])
  })

  it('should say what is wrong with a time at its field', async () => {
    // Act
    await stories.CompletionRefused.run()

    // Assert
    const end = within(dialog()).getByLabelText('実際の終了')
    expect(end).toBeInvalid()
    expect(end).toHaveAccessibleDescription(
      expect.stringContaining('終了は、開始より後の時刻にしてください。'),
    )
  })

  it('should hand over the reason of a cancellation', async () => {
    // Arrange
    await stories.AskingCancellation.run()
    await userEvent.type(
      within(dialog()).getByLabelText('キャンセルの理由'),
      'お客様から電話で連絡',
    )

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: 'キャンセルを確定する' }),
    )

    // Assert
    expect(entriesOf(stories.AskingCancellation.args.onCancel)).toEqual([
      [['cancellationReason', 'お客様から電話で連絡']],
    ])
  })

  it('should say in the dialog what went wrong with the cancellation', async () => {
    // Act
    await stories.CancellationUnsent.run()

    // Assert
    expect(within(dialog()).getByRole('alert').textContent).toBe(
      '予約をキャンセルできませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
  })

  it('should not send a cancellation that is on its way again, with the button or the form', async () => {
    // Arrange
    await stories.Cancelling.run()
    const button = within(dialog()).getByRole('button', {
      name: 'キャンセルを確定する',
    })

    // Act
    await userEvent.click(button)
    fireEvent.submit(within(dialog()).getByLabelText('キャンセルの理由'))

    // Assert
    expect(button).toHaveAttribute('aria-busy', 'true')
    expect(stories.Cancelling.args.onCancel).not.toHaveBeenCalled()
  })

  it('should leave the completion as it is while a cancellation is on its way', async () => {
    // Act
    await stories.AskingCompletion.run({
      args: { ...stories.AskingCompletion.args, pending: 'cancel' },
    })

    // Assert
    expect(
      within(dialog()).getByRole('button', { name: '完了にする' }),
    ).not.toHaveAttribute('aria-busy')
  })

  it('should show the completion as on its way while it is', async () => {
    // Act
    await stories.AskingCompletion.run({
      args: { ...stories.AskingCompletion.args, pending: 'complete' },
    })

    // Assert
    expect(
      within(dialog()).getByRole('button', { name: '完了にする' }),
    ).toHaveAttribute('aria-busy', 'true')
  })

  it('should record that nobody came, after asking', async () => {
    // Arrange
    await stories.AskingNoShow.run()
    expect(dialog()).toHaveAccessibleDescription(
      '2026年11月20日（金） 10:00〜11:00の予約に、お客様が来店しなかったことを記録します。記録した予約は、元に戻せません。',
    )

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '記録する' }),
    )

    // Assert
    expect(stories.AskingNoShow.args.onNoShow).toHaveBeenCalledTimes(1)
  })

  it('should change nothing when its dialog is left', async () => {
    // Arrange
    await stories.AskingNoShow.run()

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '戻る' }),
    )

    // Assert
    expect(stories.AskingNoShow.args.onClose).toHaveBeenCalledTimes(1)
    expect(stories.AskingNoShow.args.onNoShow).not.toHaveBeenCalled()
  })
})
