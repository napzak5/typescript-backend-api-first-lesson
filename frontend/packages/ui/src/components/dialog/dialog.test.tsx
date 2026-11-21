import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { fireEvent, screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as dialogStories from './dialog.stories'

const stories = composeStories(dialogStories)

const TITLE = '予約を取り消しますか？'

/** What the dialog notes on the page: how much of the window its scrollbar takes */
const noted = (): string =>
  document.documentElement.style.getPropertyValue('--scrollbar-room')

describe('Dialog', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    document.documentElement.style.removeProperty('--scrollbar-room')
  })

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

  it.each([
    { story: stories.Confirmation, size: 'medium', classes: ['dialog'] },
    { story: stories.Wide, size: 'wide', classes: ['dialog', 'wide'] },
  ])(
    'should be as wide as its $size size allows',
    async ({ story, classes }) => {
      // Act
      await story.run()

      // Assert
      expect(screen.getByRole('dialog')).toHaveClass(classes.join(' '), {
        exact: true,
      })
    },
  )

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

  it('should hold its content below its text, and its actions after both', async () => {
    // Act
    await stories.WithContent.run()
    const content = screen.getByText(
      'カット、カラー（2 時間）／担当: 佐藤 美咲',
    )

    // Assert
    expect(content.previousElementSibling).toHaveTextContent('予約の内容')
    expect(content.nextElementSibling).toBeNull()
    expect(content.parentElement?.nextElementSibling).toContainElement(
      screen.getByRole('button', { name: '閉じる' }),
    )
  })

  it('should note how much of the window the scrollbar of the page takes when it opens', async () => {
    // Arrange: the page is 15 pixels narrower than its window
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      window.innerWidth - 15,
    )

    // Act
    await stories.Confirmation.run()

    // Assert
    expect(noted()).toBe('15px')
  })

  it('should leave the note as it is when it opens above another dialog, under which the page has no scrollbar', async () => {
    // Arrange: a dialog is open, and the page behind it is as wide as its window
    const below = document.createElement('dialog')
    below.setAttribute('open', '')
    document.body.append(below)
    document.documentElement.style.setProperty('--scrollbar-room', '15px')
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      window.innerWidth,
    )

    // Act
    await stories.Confirmation.run()

    // Assert
    expect(noted()).toBe('15px')
    below.remove()
  })

  it('should not close a question on a press on the overlay: it has to be answered', async () => {
    // Arrange
    await stories.Confirmation.run()

    // Act: the overlay is the dialog element, outside its content
    await userEvent.click(screen.getByRole('dialog'))

    // Assert
    expect(screen.getByRole('dialog')).toHaveAttribute('open')
    expect(stories.Confirmation.args.onClose).not.toHaveBeenCalled()
  })

  it('should close a menu on a press on the overlay, and tell its caller once', async () => {
    // Arrange
    await stories.Menu.run()

    // Act
    await userEvent.click(screen.getByRole('dialog'))

    // Assert
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(stories.Menu.args.onClose).toHaveBeenCalledTimes(1)
  })

  it.each<[string, string]>([
    ['link', '明日の予約'],
    ['button', '閉じる'],
  ])(
    'should close a menu once one of its %ss is pressed: %s',
    async (role, name) => {
      // Arrange
      await stories.Menu.run()

      // Act
      await userEvent.click(screen.getByRole(role, { name }))

      // Assert
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(stories.Menu.args.onClose).toHaveBeenCalledTimes(1)
    },
  )

  it('should keep a menu open on a press on what is neither a link nor a button', async () => {
    // Arrange
    await stories.Menu.run()

    // Act
    await userEvent.click(
      screen.getByRole('heading', { name: '予約台帳を開く' }),
    )
    await userEvent.click(screen.getByRole('list'))

    // Assert
    expect(screen.getByRole('dialog')).toHaveAttribute('open')
    expect(stories.Menu.args.onClose).not.toHaveBeenCalled()
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
