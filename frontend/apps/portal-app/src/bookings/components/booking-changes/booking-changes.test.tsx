import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { fireEvent, screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { booking } from '../examples'
import * as bookingChangesStories from './booking-changes.stories'

const stories = composeStories(bookingChangesStories)

const QUESTION = '予約をキャンセルしますか？'

const cancelButton = () =>
  screen.getByRole('button', { name: '予約をキャンセルする' })
const dialog = () => screen.getByRole('dialog', { name: QUESTION })
const reasonControl = () =>
  within(dialog()).getByRole('textbox', { name: 'キャンセルの理由' })
const confirmButton = () =>
  within(dialog()).getByRole('button', { name: 'キャンセルを確定する' })

type Sent = [string, FormDataEntryValue][]

/** A callback that keeps what the dialog was sent with. */
const keeping = (received: Sent[]) =>
  vi.fn((values: FormData) => {
    received.push(Array.from(values.entries()))
  })

describe('BookingChanges', () => {
  itShouldBeAccessibleInEveryStory(stories)

  describe('what is offered', () => {
    it('should lead to the screen that moves the booking, and offer to cancel it', async () => {
      // Act
      await stories.Offered.run()

      // Assert
      expect(
        screen.getByRole('link', { name: '日時を変更する' }),
      ).toHaveAttribute('href', `/bookings/${booking.id}/reschedule`)
      expect(cancelButton()).toBeEnabled()
    })

    it('should not ask anything before the button that cancels is pressed', async () => {
      // Act
      await stories.Offered.run()

      // Assert
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('should say whom to ask, and offer the cancellation alone, for a booking that the customer cannot move', async () => {
      // Act
      await stories.WithoutMove.run()

      // Assert
      expect(screen.queryByRole('link')).toBeNull()
      expect(
        screen.getByText(
          'この予約の日時の変更は、サロンにお問い合わせください。',
        ),
      ).toBeVisible()
      expect(cancelButton()).toBeEnabled()
    })

    it('should not say whom to ask where the customer can move the booking', async () => {
      // Act
      await stories.Offered.run()

      // Assert
      expect(screen.queryByText(/サロンにお問い合わせください/)).toBeNull()
    })

    it('should ask for the dialog, and cancel nothing, when the button that cancels is pressed', async () => {
      // Arrange
      await stories.Offered.run()

      // Act
      await userEvent.click(cancelButton())

      // Assert
      expect(stories.Offered.args.onOpen).toHaveBeenCalledTimes(1)
      expect(stories.Offered.args.onCancel).not.toHaveBeenCalled()
    })
  })

  describe('the dialog', () => {
    it('should ask whether to cancel, name the booking by its time and say that this cannot be undone', async () => {
      // Act
      await stories.Confirming.run()

      // Assert
      expect(dialog()).toHaveAttribute('open')
      expect(dialog()).toHaveAccessibleDescription(
        '2026年11月24日火曜日 10:30〜11:30の予約をキャンセルします。キャンセルした予約は、元に戻せません。',
      )
    })

    it('should take a reason that need not be given, and say so', async () => {
      // Act
      await stories.Confirming.run()

      // Assert
      expect(reasonControl()).not.toBeRequired()
      expect(reasonControl()).toHaveAccessibleDescription(
        'サロンに伝えたいことがあれば、ご記入ください。空欄のままでも、キャンセルできます。',
      )
    })

    it('should hold its buttons in the order they are read, the one that changes nothing first', async () => {
      // Act
      await stories.Confirming.run()

      // Assert
      expect(
        within(dialog())
          .getAllByRole('button')
          .map((button) => button.textContent),
      ).toEqual(['戻る', 'キャンセルを確定する'])
    })

    it('should hand over the reason when the cancellation is confirmed', async () => {
      // Arrange
      const received: Sent[] = []
      await stories.Confirming.run({
        args: { ...stories.Confirming.args, onCancel: keeping(received) },
      })

      // Act
      await userEvent.type(reasonControl(), '都合が悪くなりました')
      await userEvent.click(confirmButton())

      // Assert
      expect(received).toEqual([
        [['cancellationReason', '都合が悪くなりました']],
      ])
    })

    it('should hand over an empty reason when none was written', async () => {
      // Arrange
      const received: Sent[] = []
      await stories.Confirming.run({
        args: { ...stories.Confirming.args, onCancel: keeping(received) },
      })

      // Act
      await userEvent.click(confirmButton())

      // Assert
      expect(received).toEqual([[['cancellationReason', '']]])
    })

    it('should cancel nothing, and say that it is to be closed, when the button that changes nothing is pressed', async () => {
      // Arrange
      await stories.Confirming.run()

      // Act
      await userEvent.click(
        within(dialog()).getByRole('button', { name: '戻る' }),
      )

      // Assert
      expect(stories.Confirming.args.onClose).toHaveBeenCalledTimes(1)
      expect(stories.Confirming.args.onCancel).not.toHaveBeenCalled()
    })

    it('should tell its caller when the Escape key closes it', async () => {
      // Arrange
      await stories.Confirming.run()

      // Act
      fireEvent(dialog(), new Event('cancel'))

      // Assert
      expect(stories.Confirming.args.onClose).toHaveBeenCalledTimes(1)
    })

    it('should show that the cancellation is on its way, and not send it a second time', async () => {
      // Arrange
      await stories.Sending.run()

      // Act
      await userEvent.click(confirmButton())

      // Assert
      expect(confirmButton()).toHaveAttribute('aria-busy', 'true')
      expect(stories.Sending.args.onCancel).not.toHaveBeenCalled()
    })

    it('should not send it a second time when no button is pressed, either', async () => {
      // Arrange
      await stories.Sending.run()

      // Act: an extension that sends the form itself presses no button
      reasonControl().closest('form')?.requestSubmit()

      // Assert
      expect(stories.Sending.args.onCancel).not.toHaveBeenCalled()
    })

    it('should say in the dialog what went wrong, and keep what can be tried again', async () => {
      // Act
      await stories.Unsent.run()

      // Assert
      expect(within(dialog()).getByRole('alert')).toHaveTextContent(
        '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
      )
      expect(reasonControl()).toBeVisible()
      expect(confirmButton()).toBeEnabled()
    })

    it('should say nothing about an attempt before there was one', async () => {
      // Act
      await stories.Confirming.run()

      // Assert
      expect(within(dialog()).queryByRole('alert')).toBeNull()
    })
  })

  describe('as a screen uses it', () => {
    it('should open when its button is pressed, and close with the button that changes nothing', async () => {
      // Arrange
      await stories.OpenedByButton.run()
      const closedAtFirst = screen.queryByRole('dialog') === null
      await userEvent.click(cancelButton())
      const openThen = screen.queryByRole('dialog', { name: QUESTION }) !== null

      // Act
      await userEvent.click(
        within(dialog()).getByRole('button', { name: '戻る' }),
      )

      // Assert
      expect([closedAtFirst, openThen]).toEqual([true, true])
      expect(screen.queryByRole('dialog')).toBeNull()
    })

    it('should keep what was written when it is opened again', async () => {
      // Arrange
      await stories.OpenedByButton.run()
      await userEvent.click(cancelButton())
      await userEvent.type(reasonControl(), '都合が悪くなりました')
      await userEvent.click(
        within(dialog()).getByRole('button', { name: '戻る' }),
      )

      // Act
      await userEvent.click(cancelButton())

      // Assert
      expect(reasonControl()).toHaveValue('都合が悪くなりました')
    })
  })
})
