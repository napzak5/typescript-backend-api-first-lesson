import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
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
