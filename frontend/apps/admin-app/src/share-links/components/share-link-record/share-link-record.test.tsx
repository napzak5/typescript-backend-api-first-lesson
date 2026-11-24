import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as shareLinkRecordStories from './share-link-record.stories'

const stories = composeStories(shareLinkRecordStories)

/** What the record says, term by term */
const descriptions = (name = '共有リンク'): [string, string][] =>
  within(screen.getByRole('region', { name }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

describe('ShareLinkRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say whether the link opens the file, when it ends, its downloads, its password and who issued it when', async () => {
    // Act
    await stories.Usable.run()

    // Assert
    expect(descriptions()).toEqual([
      ['状態', '使える'],
      ['有効期限', '2026年11月28日（土） 09:40'],
      ['ダウンロード', '1 回（上限 3 回）'],
      ['パスワード', 'あり'],
      ['発行した人', 'あなた'],
      ['発行日時', '2026年11月21日（土） 09:40'],
    ])
    expect(screen.getByText(/発行したときにだけ表示しました/)).toBeVisible()
  })

  it.each<[string, keyof typeof stories, string]>([
    ['gave its file as often as it may', 'UsedUp', '回数の上限に達した'],
    ['ran out', 'RanOut', '期限切れ'],
  ])('should say that a link %s', async (_, story, state) => {
    // Act
    await stories[story].run()

    // Assert
    expect(descriptions()).toContainEqual(['状態', state])
  })

  it('should ask before the link is revoked, and revoke it from the dialog', async () => {
    // Arrange
    await stories.Asking.run()
    const dialog = screen.getByRole('dialog', {
      name: '共有リンクを取り消しますか？',
    })
    expect(dialog).toHaveAccessibleDescription(/すぐに使えなくなります/)

    // Act
    await userEvent.click(
      within(dialog).getByRole('button', { name: '取り消す' }),
    )

    // Assert
    expect(stories.Asking.args.onRevoke).toHaveBeenCalledOnce()
  })

  it('should open the dialog when the button of the revocation is pressed', async () => {
    // Arrange
    await stories.Usable.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '共有リンクを取り消す' }),
    )

    // Assert
    expect(stories.Usable.args.onAsk).toHaveBeenCalledOnce()
  })

  it('should say in the dialog why the link was not revoked', async () => {
    // Act
    await stories.RevocationFailed.run()

    // Assert
    expect(
      within(screen.getByRole('dialog')).getByRole('alert'),
    ).toHaveTextContent('共有リンクを取り消せませんでした')
  })
})

describe('ShareLinkRecord on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say what is known of the link in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Usable.run()

    // Assert
    expect(descriptions('Share link')).toEqual([
      ['Status', 'Usable'],
      ['Expires', 'Sat, November 28, 2026 at 09:40'],
      ['Downloads', '1 time (limit: 3 times)'],
      ['Password', 'Set'],
      ['Issued by', 'You'],
      ['Issued', 'Sat, November 21, 2026 at 09:40'],
    ])
    expect(
      screen.getByText(
        /^The address of the link was shown only when it was issued\./,
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Revoke the share link' }),
    ).toBeVisible()
  })

  it('should ask in English before the link is revoked, and say why it was not', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.RevocationFailed.run()

    // Assert
    const dialog = screen.getByRole('dialog', {
      name: 'Revoke the share link?',
    })
    expect(dialog).toHaveAccessibleDescription(
      'The link stops working at once. A revoked share link cannot be restored.',
    )
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Could not revoke the share link. Check your connection and try again.',
    )
    expect(within(dialog).getByRole('button', { name: 'Back' })).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'Revoke' })).toBeVisible()
  })
})
