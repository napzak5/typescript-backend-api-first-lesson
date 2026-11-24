import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { act } from 'react'
import { screen, userEvent } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as notificationStories from './notifications.stories'

const stories = composeStories(notificationStories)

describe('Notifications', () => {
  itShouldBeAccessibleInEveryStory(stories)

  afterEach(() => {
    localStorage.clear()
  })

  it('should show nothing that a screen without the frame of an application notifies', async () => {
    // Act
    await stories.Alone.run()

    // Assert
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.queryByText('予約を確定しました。')).toBeNull()
  })

  it('should have an empty status region before anything is notified', async () => {
    // Act
    await stories.NothingToSay.run()

    // Assert
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.queryByRole('button', { name: '閉じる' })).toBeNull()
    expect(screen.getByRole('status').parentElement).not.toHaveClass(
      'notification',
    )
  })

  it('should put what is notified into the status region that was already there', async () => {
    // Arrange
    await stories.NothingToSay.run()
    const region = screen.getByRole('status')

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '予約を確定する' }),
    )

    // Assert
    expect(screen.getByRole('status')).toBe(region)
    expect(region).toHaveTextContent(/^予約を確定しました。$/)
  })

  it.each([
    {
      story: stories.Success,
      tone: 'success',
      message: '予約を確定しました。',
    },
    {
      story: stories.Info,
      tone: 'info',
      message: '次回の予約は 12 月 3 日（木）です。',
    },
    {
      story: stories.Warning,
      tone: 'warning',
      message: '予約を確定しました。確認のメールは送信できませんでした。',
    },
    {
      story: stories.Danger,
      tone: 'danger',
      message: '予約を確定できませんでした。',
    },
  ])(
    'should show the message and carry the class of the $tone tone',
    async ({ story, tone, message }) => {
      // Act
      await story.run()

      // Assert
      expect(screen.getByRole('status').parentElement).toHaveClass(
        'notification',
        tone,
      )
      expect(screen.getByRole('status')).toHaveTextContent(message)
    },
  )

  it('should be closed with the keyboard, by its button', async () => {
    // Arrange
    await stories.Success.run()
    screen.getByRole('button', { name: '閉じる' }).focus()

    // Act
    await userEvent.keyboard('{Enter}')

    // Assert
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    expect(screen.queryByRole('button', { name: '閉じる' })).toBeNull()
  })

  it('should show a new notification in place of the one before', async () => {
    // Arrange
    await stories.Success.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '一覧を更新する' }),
    )

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(
      /^予約の一覧を更新しました。$/,
    )
    expect(screen.getByRole('status').parentElement).toHaveClass('info')
    expect(screen.getByRole('status').parentElement).not.toHaveClass('success')
  })

  it('should put the same message in anew when it is notified again, so that it is announced again', async () => {
    // Arrange
    await stories.Success.run()
    const first = screen.getByText('予約を確定しました。')

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '予約を確定する' }),
    )

    // Assert
    expect(screen.getByText('予約を確定しました。')).not.toBe(first)
    expect(first).not.toBeInTheDocument()
  })

  it('should say the message and name the button that closes it in English on a page in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Success.run()

    // Assert
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(
      /^Confirmed the booking\.$/,
    )
  })

  it('should say a message that is written in every language in Japanese on a page in Japanese', async () => {
    // Act
    await stories.NothingChanged.run()

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(
      /^変更された項目はありません。$/,
    )
  })

  it('should say a message that is written in every language in English on a page in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.NothingChanged.run()

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(
      /^Nothing was changed\.$/,
    )
  })

  it('should say the message it shows anew when another language is chosen', async () => {
    // Arrange
    await stories.NothingChanged.run()

    // Act
    act(() => {
      languageStore.choose('en')
    })

    // Assert
    expect(screen.getByRole('status')).toHaveTextContent(
      /^Nothing was changed\.$/,
    )
    expect(screen.getByRole('button', { name: 'Close' })).toBeVisible()
  })
})
