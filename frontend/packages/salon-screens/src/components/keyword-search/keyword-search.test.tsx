import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories, composeStory } from '@storybook/react-vite'
import { useState } from 'react'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { KeywordSearch, type KeywordSearchProps } from './keyword-search'
import * as keywordSearchStories from './keyword-search.stories'

const stories = composeStories(keywordSearchStories)

const keyword = (): HTMLElement =>
  screen.getByRole('searchbox', { name: 'キーワード' })

type UnderAnAddressProps = KeywordSearchProps & {
  /** The keyword of the address that the button leads to */
  other: string | undefined
}

/**
 * The form on a screen whose address changes under it: the button stands
 * for the user who goes back.
 */
const UnderAnAddress = ({ other, ...props }: UnderAnAddressProps) => {
  const [keywordOfAddress, setKeyword] = useState(props.keyword)

  return (
    <>
      <KeywordSearch {...props} keyword={keywordOfAddress} />
      <button type='button' onClick={() => setKeyword(other)}>
        別の検索のアドレスへ
      </button>
    </>
  )
}

const underAnAddress = (other: string | undefined) =>
  composeStory(
    {
      ...keywordSearchStories.WithKeyword,
      render: (args) => <UnderAnAddress {...args} other={other} />,
    },
    keywordSearchStories.default,
  )

describe('KeywordSearch', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should be the search of the page by its label, with no keyword yet', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    // The element `search`: the testing library does not know its role yet,
    // the browser test asserts the landmark
    expect(keyword().closest('search')).toHaveAttribute(
      'aria-label',
      'サロンを探す',
    )
    expect(keyword()).toHaveValue('')
    expect(keyword()).toHaveAccessibleDescription(
      'サロンの名前か紹介文にある言葉。空欄のときは、すべてのサロンを並べます。',
    )
    expect(keyword()).toHaveAttribute('maxLength', '100')
    expect(screen.queryByRole('link', { name: '条件を外す' })).toBeNull()
  })

  it('should hand over what was typed when it is sent', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Empty.run({
      args: {
        ...stories.Empty.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })

    // Act
    await userEvent.type(keyword(), '表参道{Enter}')

    // Assert
    expect(received).toEqual([[['keyword', '表参道']]])
  })

  it('should show the keyword that is searched for, and the way to the screen without it', async () => {
    // Act
    await stories.WithKeyword.run()

    // Assert
    expect(keyword()).toHaveValue('表参道')
    expect(screen.getByRole('link', { name: '条件を外す' })).toHaveAttribute(
      'href',
      '/',
    )
  })

  it('should show the keyword of another address when the address changes under it, and drop what was typed', async () => {
    // Arrange
    await underAnAddress('銀座').run()
    await userEvent.type(keyword(), 'と、書きかけの言葉')

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '別の検索のアドレスへ' }),
    )

    // Assert
    expect(keyword()).toHaveValue('銀座')
  })

  it('should keep what is typed while the address stays as it is', async () => {
    // Arrange
    await underAnAddress('表参道').run()
    await userEvent.type(keyword(), '駅前')

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '別の検索のアドレスへ' }),
    )

    // Assert
    expect(keyword()).toHaveValue('表参道駅前')
  })
})
