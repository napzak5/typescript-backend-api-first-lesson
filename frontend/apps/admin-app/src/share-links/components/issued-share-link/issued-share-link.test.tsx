import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as issuedShareLinkStories from './issued-share-link.stories'

const stories = composeStories(issuedShareLinkStories)

/** What the part says of the link, term by term */
const descriptions = (): [string, string][] =>
  screen
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

const addressField = () => screen.getByRole('textbox', { name: '共有リンク' })

describe('IssuedShareLink', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show the address of the link once, to be chosen and copied, with what the link allows', async () => {
    // Act
    await stories.WithPassword.run()

    // Assert
    expect(addressField()).toHaveValue(stories.WithPassword.args.address)
    expect(addressField()).toHaveAttribute('readonly')
    expect(screen.getByText(/いまだけ表示します/)).toBeVisible()
    expect(descriptions()).toEqual([
      ['有効期限', '2026年11月28日（土） 09:40'],
      ['ダウンロードの回数の上限', '3 回'],
      ['パスワード', 'あり'],
    ])
    expect(screen.getByText(/リンクとは別の方法/)).toBeVisible()
    expect(
      screen.getByRole('link', { name: '共有リンクを見る' }),
    ).toHaveAttribute('href', stories.WithPassword.args.shareLinkHref)
    expect(
      screen.getByRole('link', { name: 'ファイルへ戻る' }),
    ).toHaveAttribute('href', stories.WithPassword.args.fileHref)
  })

  it('should choose the whole address when the field takes the focus', async () => {
    // Arrange
    await stories.WithPassword.run()

    // Act
    await userEvent.click(addressField())

    // Assert
    const field = addressField()
    expect(field).toHaveFocus()
    expect(field).toHaveProperty('selectionStart', 0)
    expect(field).toHaveProperty(
      'selectionEnd',
      stories.WithPassword.args.address?.length,
    )
  })

  it('should say nothing of a password that the link does not have', async () => {
    // Act
    await stories.WithoutPassword.run()

    // Assert
    expect(descriptions()).toContainEqual(['パスワード', 'なし'])
    expect(descriptions()).toContainEqual(['ダウンロードの回数の上限', '1 回'])
    expect(screen.queryByText(/リンクとは別の方法/)).toBeNull()
  })

  it('should copy the link when the button is pressed', async () => {
    // Arrange
    await stories.WithPassword.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: 'リンクをコピーする' }),
    )

    // Assert
    expect(stories.WithPassword.args.onCopy).toHaveBeenCalledOnce()
  })

  it('should say that the link was copied, in the status beside the button', async () => {
    // Act
    await stories.Copied.run()

    // Assert
    expect(screen.getByText('リンクをコピーしました。')).toHaveAttribute(
      'role',
      'status',
    )
  })

  it('should say how to copy the link when the browser did not let the page', async () => {
    // Act
    await stories.CopyFailed.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      '上の欄のアドレスを選んで、コピーしてください',
    )
  })
})
