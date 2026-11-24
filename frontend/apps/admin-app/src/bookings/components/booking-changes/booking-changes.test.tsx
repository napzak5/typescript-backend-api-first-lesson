import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { fireEvent, screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as bookingChangesStories from './booking-changes.stories'

const stories = composeStories(bookingChangesStories)

const dialog = (): HTMLElement =>
  screen.getByRole('dialog', { name: '予約を削除しますか？' })

const removeButton = (): HTMLElement =>
  within(dialog()).getByRole('button', { name: '削除する' })

describe('BookingChanges', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should lead to the move, to a line that is added and to the change of the notes, and offer the removal', async () => {
    // Act
    await stories.Offered.run()

    // Assert
    expect(
      screen
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      ['日時と担当を変える', '/salons/1/bookings/2/reschedule'],
      ['施術明細を追加する', '/salons/1/bookings/2/services/new'],
      ['要望とメモを変える', '/salons/1/bookings/2/edit'],
    ])
    expect(screen.queryByRole('dialog')).toBeNull()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '予約を削除する' }),
    )

    // Assert
    expect(stories.Offered.args.onOpen).toHaveBeenCalledTimes(1)
  })

  it('should offer neither the move nor a line for a booking that takes neither', async () => {
    // Act
    await stories.Closed.run()

    // Assert
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual(
      ['要望とメモを変える'],
    )
  })

  it('should offer no removal to an account that may not remove', async () => {
    // Act
    await stories.NotRemovable.run()

    // Assert
    expect(
      screen.getByRole('link', { name: '要望とメモを変える' }),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: '予約を削除する' })).toBeNull()
  })

  it('should say what is removed, what a removal is for and that it cannot be undone, and remove when it is confirmed', async () => {
    // Arrange
    await stories.Confirming.run()
    expect(dialog()).toHaveAccessibleDescription(
      '2026年11月20日（金） 10:00〜11:00の予約を、施術明細とともに台帳から取り除きます。誤って入れた予約や、重複した予約を取り除くためのものです。行われない予約は、削除せずにキャンセルしてください。削除した予約は、元に戻せません。',
    )

    // Act
    await userEvent.click(removeButton())

    // Assert
    expect(stories.Confirming.args.onRemove).toHaveBeenCalledTimes(1)
  })

  it('should remove nothing, and say that it is to be closed, when the button that changes nothing is pressed', async () => {
    // Arrange
    await stories.Confirming.run()

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '戻る' }),
    )

    // Assert
    expect(stories.Confirming.args.onClose).toHaveBeenCalledTimes(1)
    expect(stories.Confirming.args.onRemove).not.toHaveBeenCalled()
  })

  it('should tell its caller when the Escape key closes it', async () => {
    // Arrange
    await stories.Confirming.run()

    // Act
    fireEvent(dialog(), new Event('cancel'))

    // Assert
    expect(stories.Confirming.args.onClose).toHaveBeenCalledTimes(1)
  })

  it('should show that the removal is on its way, and not send it a second time', async () => {
    // Arrange
    await stories.Removing.run()

    // Act
    await userEvent.click(removeButton())

    // Assert
    expect(removeButton()).toHaveAttribute('aria-busy', 'true')
    expect(stories.Removing.args.onRemove).not.toHaveBeenCalled()
  })

  it('should say in the dialog why the removal did not come through', async () => {
    // Act
    await stories.Unremoved.run()

    // Assert
    expect(
      within(dialog()).getByText(
        '予約を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeVisible()
  })

  it('should open from its button and close from the button that changes nothing', async () => {
    // Arrange
    await stories.OpenedByButton.run()
    const opener = screen.getByRole('button', { name: '予約を削除する' })

    // Act
    await userEvent.click(opener)

    // Assert
    expect(dialog()).toBeVisible()

    // Act
    await userEvent.click(
      within(dialog()).getByRole('button', { name: '戻る' }),
    )

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('BookingChanges on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should offer the changes, and ask before the booking is removed, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Unremoved.run()

    // Assert
    expect(
      screen.getByRole('link', { name: 'Change the date, time and staff' }),
    ).toHaveAttribute('href', '/salons/1/bookings/2/reschedule')
    expect(screen.getByRole('link', { name: 'Add a line' })).toHaveAttribute(
      'href',
      '/salons/1/bookings/2/services/new',
    )
    expect(
      screen.getByRole('link', { name: 'Edit the requests and notes' }),
    ).toHaveAttribute('href', '/salons/1/bookings/2/edit')
    expect(
      screen.getByRole('button', { name: 'Remove the booking' }),
    ).toBeVisible()
    const asking = screen.getByRole('dialog', { name: 'Remove the booking?' })
    expect(asking).toHaveAccessibleDescription(
      'The booking of Fri, November 20, 2026, 10:00–11:00 will be taken out of the ledger with its lines. This is for a booking made by mistake or made twice. Cancel a booking that will not take place instead of removing it. A removed booking cannot be brought back.',
    )
    expect(
      within(asking).getByText(
        'The booking could not be removed. Check your connection and try again.',
      ),
    ).toBeVisible()
    expect(within(asking).getByRole('button', { name: 'Back' })).toBeVisible()
    expect(within(asking).getByRole('button', { name: 'Remove' })).toBeVisible()
  })
})
