import { languageStore } from '@beauty-salon-frontend/io'
import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { optionsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as shareLinkFormStories from './share-link-form.stories'

const stories = composeStories(shareLinkFormStories)

/** The values the form handed over when it was sent */
const sentValues = (): [string, FormDataEntryValue][][] =>
  vi
    .mocked(stories.Empty.args.onSubmit ?? (() => undefined))
    .mock.calls.map(([values]) => [...values.entries()])

describe('ShareLinkForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.Empty, () =>
    screen.getByRole('textbox', { name: 'ダウンロードの回数の上限' }),
  )

  it('should start with seven days, no limit and no password, and offer the periods the API takes', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    expect(screen.getByText(/「カラー同意書_田中様.pdf」を/)).toBeVisible()
    const period = screen.getByRole('combobox', { name: '有効期間' })
    expect(period).toHaveValue('7')
    expect(period).toBeRequired()
    expect(optionsOf(period)).toEqual([
      '1 日',
      '3 日',
      '7 日',
      '14 日',
      '30 日',
    ])
    const limit = screen.getByRole('textbox', {
      name: 'ダウンロードの回数の上限',
    })
    expect(limit).toHaveValue('')
    expect(limit).toHaveAttribute('inputmode', 'numeric')
    const password = screen.getByLabelText('パスワード', { selector: 'input' })
    expect(password).toHaveValue('')
    expect(password).not.toBeRequired()
    expect(password).toHaveAttribute('autocomplete', 'new-password')
  })

  it('should hand over the period, the limit and the password under the names of the request', async () => {
    // Arrange
    await stories.Empty.run()

    // Act
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: '有効期間' }),
      '30 日',
    )
    await userEvent.type(
      screen.getByRole('textbox', { name: 'ダウンロードの回数の上限' }),
      '3',
    )
    await userEvent.type(
      screen.getByLabelText('パスワード', { selector: 'input' }),
      'umi no mieru heya',
    )
    await userEvent.click(
      screen.getByRole('button', { name: '共有リンクを発行する' }),
    )

    // Assert
    expect(sentValues()).toEqual([
      [
        ['period', '30'],
        ['maxDownloads', '3'],
        ['password', 'umi no mieru heya'],
      ],
    ])
  })

  it('should say at the password what the API refused, and put the focus there', async () => {
    // Act
    await stories.PasswordGuessed.run()

    // Assert
    const password = screen.getByLabelText('パスワード', { selector: 'input' })
    expect(password).toHaveAccessibleDescription(/推測されやすいパスワードです/)
    expect(password).toBeInvalid()
  })

  it('should say why the link could not be issued', async () => {
    // Act
    await stories.Failed.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      '共有リンクを発行できませんでした',
    )
  })
})

describe('ShareLinkForm on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name its controls, describe them and offer the periods in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Empty.run()

    // Assert
    expect(
      screen.getByText(
        'Issues a link that shows “カラー同意書_田中様.pdf” to people who have no account.',
      ),
    ).toBeVisible()
    const period = screen.getByRole('combobox', { name: 'Valid for' })
    expect(optionsOf(period)).toEqual([
      '1 day',
      '3 days',
      '7 days',
      '14 days',
      '30 days',
    ])
    expect(period).toHaveAccessibleDescription(
      'Counted from the time the link is issued. Once it expires, the link no longer works.',
    )
    expect(
      screen.getByRole('textbox', { name: 'Download limit' }),
    ).toHaveAccessibleDescription(
      'How many times the file can be downloaded from the link. Left empty, there is no limit.',
    )
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      'From 8 to 128 characters. Left empty, the file is shared without a password. Tell the password in another way than the link.',
    )
    expect(
      screen.getByRole('button', { name: 'Issue a share link' }),
    ).toBeVisible()
  })

  it('should say in English what the API refused, at the password', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.PasswordGuessed.run()

    // Assert
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      expect.stringContaining('This password is easy to guess.'),
    )
  })

  it('should say in English why the link could not be issued', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Failed.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not issue the share link. Check your connection and try again.',
    )
  })
})
