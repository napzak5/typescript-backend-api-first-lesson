import { languageStore } from '@beauty-salon-frontend/io'
import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
  setWindowWidth,
} from '@beauty-salon-frontend/testing'
import { optionsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories, composeStory } from '@storybook/react-vite'
import { useState } from 'react'
import { screen, userEvent } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { colour, gloves } from '../../../products/components/examples'
import { StockFilter, type StockFilterProps } from './stock-filter'
import * as stockFilterStories from './stock-filter.stories'

const stories = composeStories(stockFilterStories)

const product = (): HTMLElement =>
  screen.getByRole('combobox', { name: '商品' })
const lot = (): HTMLElement =>
  screen.getByRole('textbox', { name: 'ロット番号' })
const expiry = (): HTMLElement =>
  screen.getByRole('combobox', { name: '使用期限' })

type UnderAnAddressProps = StockFilterProps & {
  other: StockFilterProps['view']
}

/** The filter on a screen whose address changes under it: the user went back. */
const UnderAnAddress = ({ other, ...props }: UnderAnAddressProps) => {
  const [view, setView] = useState(props.view)

  return (
    <>
      <StockFilter {...props} view={view} />
      <button type='button' onClick={() => setView(other)}>
        別のアドレスへ
      </button>
    </>
  )
}

/** Sends the filter of a story, and gives what it handed over. */
const sent = async (
  story: (typeof stories)['Everything'],
  fill: () => Promise<void>,
  button: string,
): Promise<[string, FormDataEntryValue][][]> => {
  const received: [string, FormDataEntryValue][][] = []
  await story.run({
    args: {
      ...story.args,
      onSubmit: vi.fn((values: FormData) => {
        received.push(Array.from(values.entries()))
      }),
    },
  })
  await fill()
  await userEvent.click(screen.getByRole('button', { name: button }))

  return received
}

describe('StockFilter', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.Everything, () =>
    screen.getByRole('textbox', { name: 'ロット番号' }),
  )

  it('should offer every product of the salon and a lot, with nothing chosen', async () => {
    // Act
    await stories.Everything.run()

    // Assert
    // The element `search`: the testing library does not know its role yet
    expect(product().closest('search')).toHaveAttribute(
      'aria-label',
      '在庫を探す',
    )
    expect(optionsOf(product())).toEqual([
      'すべて',
      'ヘアカラー ナチュラルブラウン（COLOR001）',
      'プロフェッショナル シャンプー 500ml（SHMP001）',
      'ニトリル手袋 M（SUP-GLOVE）',
      'スタイリングワックス 80g（WAX001）・取り扱いをやめた',
    ])
    expect(product()).toHaveValue('')
    expect(lot()).toHaveValue('')
    expect(lot()).toHaveAccessibleDescription(
      'ロット番号のすべて。大文字と小文字を区別します。',
    )
    // A link without an address would be no link: nothing of it is there
    expect(screen.queryByText('条件を外す')).toBeNull()
  })

  it('should show the conditions that narrow the rows, and the way back to all of them', async () => {
    // Act
    await stories.Narrowed.run()

    // Assert
    expect(product()).toHaveValue(colour.id)
    expect(lot()).toHaveValue('LOT-2026-041')
    expect(screen.getByRole('link', { name: '条件を外す' })).toHaveAttribute(
      'href',
      '?',
    )
  })

  it('should hand over the product and the lot it holds', async () => {
    // Act
    const received = await sent(
      stories.Everything,
      async () => {
        await userEvent.selectOptions(product(), 'ニトリル手袋 M（SUP-GLOVE）')
        await userEvent.type(lot(), 'LOT-1')
      },
      '探す',
    )

    // Assert
    expect(received).toEqual([
      [
        ['productId', gloves.id],
        ['lotNumber', 'LOT-1'],
      ],
    ])
  })

  it('should say what is wrong at the lot, and take the focus there', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(lot()).toHaveAccessibleDescription(
      'ロット番号のすべて。大文字と小文字を区別します。 ロット番号は、100 文字以内で入力してください。',
    )
    expect(lot()).toHaveFocus()
  })

  it('should offer the windows of the rows that expire soon, and hand over the one chosen', async () => {
    // Act
    const received = await sent(
      stories.Expiring,
      async () => {
        expect(expiry().closest('search')).toHaveAttribute(
          'aria-label',
          '使用期限で絞る',
        )
        expect(optionsOf(expiry())).toEqual([
          '今日まで',
          '7 日後まで',
          '30 日後まで',
          '90 日後まで',
        ])
        expect(expiry()).toHaveValue('7')
        expect(screen.queryByRole('combobox', { name: '商品' })).toBeNull()
        await userEvent.selectOptions(expiry(), '90 日後まで')
      },
      '表示する',
    )

    // Assert
    expect(received).toEqual([[['days', '90']]])
  })

  it('should show the conditions of another address when the address changes under it', async () => {
    // Arrange
    const Moving = composeStory(
      {
        ...stockFilterStories.Narrowed,
        render: (args) => (
          <UnderAnAddress {...args} other={{ type: 'all', lotNumber: 'X' }} />
        ),
      },
      stockFilterStories.default,
    )
    await Moving.run()
    await userEvent.type(lot(), '9')

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '別のアドレスへ' }),
    )

    // Assert
    expect(product()).toHaveValue('')
    expect(lot()).toHaveValue('X')
  })

  it('should count on its button the conditions of the sheet that narrow the rows, on a narrow screen', async () => {
    // Arrange
    setWindowWidth(390)

    // Act
    await stories.Narrowed.run()

    // Assert
    expect(screen.getByRole('button', { name: '条件（2）' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    )
  })
})

describe('StockFilter on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should offer every product of the salon and a lot, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Everything.run()

    // Assert
    const chosen = screen.getByRole('combobox', { name: 'Product' })
    expect(chosen.closest('search')).toHaveAttribute('aria-label', 'Find stock')
    expect(optionsOf(chosen)).toEqual([
      'All',
      'ヘアカラー ナチュラルブラウン (COLOR001)',
      'プロフェッショナル シャンプー 500ml (SHMP001)',
      'ニトリル手袋 M (SUP-GLOVE)',
      'スタイリングワックス 80g (WAX001), no longer carried',
    ])
    expect(
      screen.getByRole('textbox', { name: 'Lot number' }),
    ).toHaveAccessibleDescription(
      'The whole lot number. Upper and lower case are told apart.',
    )
    expect(screen.getByRole('button', { name: 'Search' })).toBeVisible()
  })

  it('should say in English what is wrong at the lot', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithErrors.run()

    // Assert
    expect(
      screen.getByRole('textbox', { name: 'Lot number' }),
    ).toHaveAccessibleDescription(
      'The whole lot number. Upper and lower case are told apart. Lot number: enter up to 100 characters.',
    )
  })

  it('should offer the windows of the rows that expire soon in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Expiring.run()

    // Assert
    const days = screen.getByRole('combobox', { name: 'Expiry date' })
    expect(days.closest('search')).toHaveAttribute(
      'aria-label',
      'Narrow by expiry date',
    )
    expect(optionsOf(days)).toEqual([
      'By today',
      'Within 7 days',
      'Within 30 days',
      'Within 90 days',
    ])
    expect(days).toHaveAccessibleDescription(
      'Stock whose expiry date comes between today and the day chosen. Stock past its expiry date is shown too.',
    )
    expect(screen.getByRole('button', { name: 'Show' })).toBeVisible()
  })
})
