import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as referrerDialogStories from './referrer-dialog.stories'

const stories = composeStories(referrerDialogStories)

const keyword = (): HTMLElement =>
  screen.getByRole('searchbox', { name: 'キーワード' })

describe('ReferrerDialog', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say what is chosen, and search the ledger', async () => {
    // Act
    await stories.BeforeASearch.run()

    // Assert
    expect(
      screen.getByRole('dialog', { name: '紹介元を選ぶ' }),
    ).toHaveAccessibleDescription(
      'このお客様を紹介したお客様を、台帳から探して選びます。',
    )
    expect(keyword()).toHaveValue('')
    expect(keyword().closest('search')).toHaveAttribute(
      'aria-label',
      '紹介元を探す',
    )
  })

  it.each<[string, string, string | undefined]>([
    ['a keyword, without the spaces around it', ' 山田 ', '山田'],
    ['no keyword', '   ', undefined],
  ])(
    'should search for %s by the Enter key',
    async (_case, typed, searched) => {
      // Arrange
      const onSearch = vi.fn()
      await stories.BeforeASearch.run({
        args: { ...stories.BeforeASearch.args, onSearch },
      })

      // Act
      await userEvent.type(keyword(), `${typed}{Enter}`)

      // Assert
      expect(onSearch).toHaveBeenCalledOnce()
      expect(onSearch).toHaveBeenCalledWith(searched)
    },
  )

  it('should show the keyword that was searched for, and what it found', async () => {
    // Act
    await stories.Found.run()

    // Assert
    expect(keyword()).toHaveValue('山田')
    expect(
      screen.getByRole('table', { name: '見つかったお客様' }),
    ).toBeVisible()
  })

  it('should close when it is given up', async () => {
    // Arrange
    const onClose = vi.fn()
    await stories.Found.run({ args: { ...stories.Found.args, onClose } })

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'やめる' }))

    // Assert
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('ReferrerDialog on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should say what is chosen and how the ledger is searched, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.BeforeASearch.run()

    // Assert
    const dialog = screen.getByRole('dialog', { name: 'Choose the referrer' })
    expect(dialog).toHaveAccessibleDescription(
      'Search the ledger for the customer who referred this one, and choose them.',
    )
    const search = within(dialog).getByRole('searchbox', { name: 'Keyword' })
    expect(search.closest('search')).toHaveAttribute(
      'aria-label',
      'Search for the referrer',
    )
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeVisible()
  })
})
