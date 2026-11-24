import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as attachmentRecordStories from './attachment-record.stories'

const stories = composeStories(attachmentRecordStories)

/** What the record says, term by term */
const descriptions = (): [string, string][] =>
  screen
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

describe('AttachmentRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show an image, offer to open it in a tab of its own and to save it, and say what is known of it', async () => {
    // Act
    await stories.Photo.run()

    // Assert
    expect(screen.getByRole('img', { name: '施術前.jpg' })).toHaveAttribute(
      'src',
      stories.Photo.args.links?.type === 'issued'
        ? stories.Photo.args.links.open
        : '',
    )
    const links = within(screen.getByRole('list', { name: 'ファイルを開く' }))
    expect(
      links.getByRole('link', { name: '新しいタブで開く' }),
    ).toHaveAttribute('target', '_blank')
    expect(
      links.getByRole('link', { name: '新しいタブで開く' }),
    ).toHaveAttribute('rel', 'noopener noreferrer')
    expect(links.getByRole('link', { name: '保存する' })).toHaveAttribute(
      'href',
      expect.stringMatching(/#save$/),
    )
    expect(descriptions()).toEqual([
      ['ファイル名', '施術前.jpg'],
      ['種類', 'JPEG 画像'],
      ['サイズ', '1.2 MB（1,258,291 バイト）'],
      ['アップロードした人', 'あなた'],
      ['アップロード日時', '2026年11月20日（金） 10:01'],
    ])
  })

  it('should show no image of a PDF, and tell an account that may not remove the file who may', async () => {
    // Act
    await stories.DocumentOfAnother.run()

    // Assert
    expect(screen.queryByRole('img')).toBeNull()
    expect(
      screen.getByRole('link', { name: '新しいタブで開く' }),
    ).toHaveAttribute(
      'href',
      'https://storage.salon.example/consent.pdf?inline',
    )
    expect(
      screen.queryByRole('button', { name: 'ファイルを削除する' }),
    ).toBeNull()
    expect(
      screen.getByText(
        'このファイルを削除できるのは、アップロードした人と、サロンのオーナー、マネージャー、管理者です。',
      ),
    ).toBeVisible()
  })

  it('should offer to read the URLs again when they could not be read', async () => {
    // Arrange
    await stories.Unread.run()
    const onRetryLinks = vi.mocked(
      stories.Unread.args.onRetryLinks ?? (() => undefined),
    )
    expect(screen.queryByRole('link')).toBeNull()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'もう一度読み込む' }),
    )

    // Assert
    expect(onRetryLinks).toHaveBeenCalledOnce()
  })

  it('should open the dialog when the button of the removal is pressed', async () => {
    // Arrange
    await stories.Photo.run()
    const onAsk = vi.mocked(stories.Photo.args.onAsk ?? (() => undefined))

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'ファイルを削除する' }),
    )

    // Assert
    expect(onAsk).toHaveBeenCalledOnce()
  })

  it('should say in the dialog what the removal does, and remove or change nothing as asked', async () => {
    // Arrange
    await stories.Asking.run()
    const { onRemove, onClose } = stories.Asking.args
    const dialog = screen.getByRole('dialog', {
      name: 'ファイルを削除しますか？',
    })
    expect(dialog).toHaveAccessibleDescription(
      '「施術前.jpg」を、サロンのファイルから削除します。削除したファイルは元に戻せません。このファイルの共有リンクも、使えなくなります。',
    )

    // Act
    await userEvent.click(within(dialog).getByRole('button', { name: '戻る' }))
    await userEvent.click(
      within(dialog).getByRole('button', { name: '削除する' }),
    )

    // Assert
    expect(vi.mocked(onClose ?? (() => undefined))).toHaveBeenCalled()
    expect(vi.mocked(onRemove ?? (() => undefined))).toHaveBeenCalledOnce()
  })

  it('should say in the dialog that the removal could not be sent', async () => {
    // Act
    await stories.RemovalFailed.run()

    // Assert
    expect(
      within(screen.getByRole('dialog')).getByText(
        'ファイルを削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
      ),
    ).toBeVisible()
  })
})

describe('AttachmentRecord on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should offer to open and save the file, and say what is known of it, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Photo.run()

    // Assert
    expect(screen.getByRole('heading', { name: 'File' })).toBeVisible()
    const links = within(screen.getByRole('list', { name: 'Open the file' }))
    expect(
      links.getByRole('link', { name: 'Open in a new tab' }),
    ).toHaveAttribute('target', '_blank')
    expect(links.getByRole('link', { name: 'Save' })).toBeVisible()
    expect(descriptions()).toEqual([
      ['File name', '施術前.jpg'],
      ['Type', 'JPEG image'],
      ['Size', '1.2 MB (1,258,291 bytes)'],
      ['Uploaded by', 'You'],
      ['Uploaded', 'Fri, November 20, 2026 at 10:01'],
    ])
    expect(
      screen.getByRole('button', { name: 'Delete the file' }),
    ).toBeVisible()
  })

  it('should tell in English an account that may not remove the file who may', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.DocumentOfAnother.run()

    // Assert
    expect(
      screen.getByText(
        'Only the person who uploaded this file, the owners and managers of the salon and administrators can delete it.',
      ),
    ).toBeVisible()
  })

  it('should ask in English before the file is removed, and say why it was not', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.RemovalFailed.run()

    // Assert
    const dialog = screen.getByRole('dialog', { name: 'Delete the file?' })
    expect(dialog).toHaveAccessibleDescription(
      'Deletes “施術前.jpg” from the files of the salon. A deleted file cannot be restored. The share links of this file stop working too.',
    )
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Could not delete the file. Check your connection and try again.',
    )
    expect(within(dialog).getByRole('button', { name: 'Back' })).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeVisible()
  })

  it('should say in English that the URLs could not be read', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Unread.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      /the address that opens the file/,
    )
  })
})
