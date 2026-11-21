import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import { PIXEL } from '../examples'
import * as sharedFileRecordStories from './shared-file-record.stories'

const stories = composeStories(sharedFileRecordStories)

const part = () => screen.getByRole('region', { name: 'ファイル' })

/** The terms of what is known of the file, each with its description */
const facts = () =>
  within(part())
    .getAllByRole('term')
    .map((term) => [term.textContent, term.nextElementSibling?.textContent])

describe('SharedFileRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say what the file is, and that loading it counts as a download, before it is loaded', async () => {
    // Act
    await stories.NotLoaded.run()

    // Assert
    expect(facts()).toEqual([
      ['種類', 'PNG 画像'],
      ['サイズ', '340 KB（348,160 バイト）'],
    ])
    expect(part()).toHaveTextContent(
      'ファイルを読み込むたびに、ダウンロードを 1 回と数えます。',
    )
    expect(within(part()).queryByRole('img')).toBeNull()
    expect(within(part()).queryByRole('link')).toBeNull()
    expect(within(part()).queryByRole('alert')).toBeNull()
  })

  it('should say that the button was pressed when the file is to be loaded', async () => {
    // Arrange
    await stories.NotLoaded.run()

    // Act
    await userEvent.click(
      within(part()).getByRole('button', { name: 'ファイルを読み込む' }),
    )

    // Assert
    expect(stories.NotLoaded.args.onLoad).toHaveBeenCalledTimes(1)
  })

  it('should show that the file is being loaded on its button', async () => {
    // Act
    await stories.Loading.run()

    // Assert
    expect(
      within(part()).getByRole('button', { name: 'ファイルを読み込む' }),
    ).toHaveAttribute('aria-busy', 'true')
  })

  it('should say that a file the storage did not answer with was counted, and offer to load it again', async () => {
    // Act
    await stories.NotFetched.run()

    // Assert
    expect(within(part()).getByRole('alert')).toHaveTextContent(
      'ファイルを読み込めませんでした。ダウンロードの回数は 1 回と数えられています。もう一度読み込むと、もう 1 回と数えます。',
    )
    expect(
      within(part()).getByRole('button', { name: 'もう一度読み込む' }),
    ).toBeVisible()
  })

  it('should show an image the page holds under its name, and open it in a tab of its own or save it under its name', async () => {
    // Act
    await stories.LoadedImage.run()

    // Assert
    expect(
      within(part()).getByRole('img', { name: '施術後のスタイル_正面.png' }),
    ).toHaveAttribute('src', PIXEL)
    const links = within(
      within(part()).getByRole('list', { name: 'ファイルを開く' }),
    )
    const opening = links.getByRole('link', { name: '新しいタブで開く' })
    expect(opening).toHaveAttribute('href', PIXEL)
    expect(opening).toHaveAttribute('target', '_blank')
    expect(opening).toHaveAttribute('rel', 'noopener noreferrer')
    const saving = links.getByRole('link', { name: '保存する' })
    expect(saving).toHaveAttribute('href', PIXEL)
    expect(saving).toHaveAttribute('download', '施術後のスタイル_正面.png')
    expect(within(part()).queryByRole('button')).toBeNull()
  })

  it('should not show a PDF, and open it or save it under its name', async () => {
    // Act
    await stories.LoadedPdf.run()

    // Assert
    expect(within(part()).queryByRole('img')).toBeNull()
    expect(
      within(part()).getByRole('link', { name: '保存する' }),
    ).toHaveAttribute('download', 'カラー同意書_田中様.pdf')
    expect(facts()).toEqual([
      ['種類', 'PDF'],
      ['サイズ', '512 バイト'],
    ])
  })
})
