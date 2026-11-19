import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { fireEvent, screen, userEvent, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as dialogStories from './dialog.stories'

const stories = composeStories(dialogStories)

const TITLE = '予約を取り消しますか？'

describe('Dialog', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should be a dialog named by its title and described by its description', async () => {
    // Act
    await stories.Confirmation.run()
    const dialog = screen.getByRole('dialog', { name: TITLE })

    // Assert
    expect(dialog).toHaveAttribute('open')
    expect(dialog).toHaveAccessibleDescription(
      '12 月 3 日（木）10:00 のカットの予約を取り消します。この操作は元に戻せません。',
    )
    expect(
      within(dialog).getByRole('heading', { level: 2, name: TITLE }),
    ).toBeVisible()
  })

  it('should have no description when it is given none', async () => {
    // Act
    await stories.TitleOnly.run()

    // Assert
    expect(
      screen.getByRole('dialog', { name: 'サインアウトしますか？' }),
    ).not.toHaveAttribute('aria-describedby')
  })

  it('should hold its actions in the order they are given, the harmless one first', async () => {
    // Act
    await stories.Confirmation.run()

    // Assert
    expect(
      within(screen.getByRole('dialog'))
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['戻る', '予約を取り消す'])
  })

  it('should hold its content between its text and its actions', async () => {
    // Act
    await stories.WithContent.run()
    const content = screen.getByText(
      'カット、カラー（2 時間）／担当: 佐藤 美咲',
    )

    // Assert
    expect(content.previousElementSibling).toHaveTextContent('予約の内容')
    expect(content.nextElementSibling).toContainElement(
      screen.getByRole('button', { name: '閉じる' }),
    )
  })

  it('should not be shown while it is closed', async () => {
    // Act
    await stories.Closed.run()

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText(TITLE).closest('dialog')).not.toHaveAttribute(
      'open',
    )
  })

  it('should tell its caller once, and at once, when the Escape key closes it', async () => {
    // Arrange: the browser fires `cancel`, closes the dialog, and fires
    // `close` in a task of its own
    await stories.Confirmation.run()
    const dialog = screen.getByText(TITLE).closest('dialog')

    // Act
    fireEvent(screen.getByRole('dialog'), new Event('cancel'))

    // Assert: told at once
    expect(stories.Confirmation.args.onClose).toHaveBeenCalledTimes(1)

    // Act
    dialog?.close()

    // Assert: and only once
    expect(stories.Confirmation.args.onClose).toHaveBeenCalledTimes(1)
  })

  it('should tell its caller when the browser has closed it without a cancel', async () => {
    // Arrange
    await stories.Confirmation.run()

    // Act
    screen.getByText(TITLE).closest('dialog')?.close()

    // Assert
    expect(stories.Confirmation.args.onClose).toHaveBeenCalledTimes(1)
  })

  it('should take a close that comes while it is open for one of before', async () => {
    // Arrange: closed with the Escape key and opened again, before the
    // browser fired `close`
    await stories.Confirmation.run()

    // Act
    fireEvent(screen.getByRole('dialog'), new Event('close'))

    // Assert
    expect(stories.Confirmation.args.onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toHaveAttribute('open')
  })

  it('should open when its caller says so', async () => {
    // Arrange
    await stories.OpenedByButton.run()
    const closedAtFirst = screen.queryByRole('dialog') === null

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '予約を取り消す…' }),
    )

    // Assert
    expect(closedAtFirst).toBe(true)
    expect(screen.getByRole('dialog', { name: TITLE })).toHaveAttribute('open')
  })

  it('should be closed before the screen around it moves the focus out of it, in the same commit', async () => {
    // Arrange: the page behind a modal dialog is inert, so the focus can
    // leave the dialog once it is closed; jsdom does not make it inert, so
    // where the focus was when it closed is noted. A browser shows the rest
    // (frontend/e2e/src/admin-bookings.e2e.test.ts)
    await stories.ClosedByItsAnswer.run()
    const focusedWhenClosed: (Element | null)[] = []
    const noteTheFocus = (): void => {
      focusedWhenClosed.push(document.activeElement)
    }
    document.addEventListener('close', noteTheFocus, { capture: true })
    const answer = screen.getByRole('button', { name: '予約を取り消す' })

    // Act
    await userEvent.click(answer)
    document.removeEventListener('close', noteTheFocus, { capture: true })

    // Assert
    expect(focusedWhenClosed).toEqual([answer])
    expect(screen.getByRole('heading', { name: '予約の状態' })).toHaveFocus()
    expect(stories.ClosedByItsAnswer.args.onClose).toHaveBeenCalledTimes(1)
  })

  it('should close when its caller says so, and tell it once that it has closed', async () => {
    // Arrange
    await stories.OpenedByButton.run()
    await userEvent.click(
      screen.getByRole('button', { name: '予約を取り消す…' }),
    )

    // Act
    await userEvent.click(screen.getByRole('button', { name: '戻る' }))

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(stories.OpenedByButton.args.onClose).toHaveBeenCalledTimes(1)
  })
})
