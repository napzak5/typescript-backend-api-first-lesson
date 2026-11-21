import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
  setWindowWidth,
} from '@beauty-salon-frontend/testing'
import { composeStories, composeStory } from '@storybook/react-vite'
import { useState } from 'react'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import type { ProductConditions } from '../../product-ledger'
import { ProductFilter, type ProductFilterProps } from './product-filter'
import * as productFilterStories from './product-filter.stories'

const stories = composeStories(productFilterStories)

const keyword = (): HTMLElement =>
  screen.getByRole('searchbox', { name: 'キーワード' })
const barcode = (): HTMLElement =>
  screen.getByRole('textbox', { name: 'バーコード' })
const category = (): HTMLElement =>
  screen.getByRole('combobox', { name: 'カテゴリー' })
const carried = (): HTMLElement =>
  screen.getByRole('combobox', { name: '取り扱い' })
const use = (): HTMLElement => screen.getByRole('combobox', { name: '用途' })

const optionsOf = (select: HTMLElement): (string | null)[] =>
  within(select)
    .getAllByRole('option')
    .map((option) => option.textContent)

type UnderAnAddressProps = ProductFilterProps & { other: ProductConditions }

/** The filter on a screen whose address changes under it: the user went back. */
const UnderAnAddress = ({ other, ...props }: UnderAnAddressProps) => {
  const [conditions, setConditions] = useState(props.conditions)

  return (
    <>
      <ProductFilter {...props} conditions={conditions} />
      <button type='button' onClick={() => setConditions(other)}>
        別のアドレスへ
      </button>
    </>
  )
}

describe('ProductFilter', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.Everything, () =>
    screen.getByRole('textbox', { name: 'バーコード' }),
  )

  it('should offer every condition the ledger is narrowed by, with nothing chosen', async () => {
    // Act
    await stories.Everything.run()

    // Assert
    // The element `search`: the testing library does not know its role yet
    expect(keyword().closest('search')).toHaveAttribute(
      'aria-label',
      '商品を探す',
    )
    expect(keyword()).toHaveValue('')
    expect(keyword()).toHaveAccessibleDescription(
      '商品名、商品コード、ブランドの一部。',
    )
    expect(barcode()).toHaveAccessibleDescription(
      'バーコードのすべて。読み取り機で入力できます。',
    )
    expect(optionsOf(category())).toEqual([
      'すべて',
      'スタイリング',
      'ヘアカラー',
      'ヘアケア',
    ])
    expect(optionsOf(carried())).toEqual([
      'すべて',
      '取り扱い中',
      '取り扱いをやめた',
    ])
    expect(optionsOf(use())).toEqual(['すべて', '店頭で販売する', '施術で使う'])
    expect(screen.queryByRole('link', { name: '条件を外す' })).toBeNull()
  })

  it('should show the conditions that narrow the ledger, and the way back to all of it', async () => {
    // Act
    await stories.Narrowed.run()

    // Assert
    expect(keyword()).toHaveValue('シャンプー')
    expect(barcode()).toHaveValue('4901234567894')
    expect(category()).toHaveValue('ヘアケア')
    expect(carried()).toHaveValue('carried')
    expect(use()).toHaveValue('sale')
    expect(screen.getByRole('link', { name: '条件を外す' })).toHaveAttribute(
      'href',
      '?',
    )
  })

  it('should hand over what its controls hold, under the names of the conditions', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Everything.run({
      args: {
        ...stories.Everything.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })
    await userEvent.type(keyword(), 'カラー')
    await userEvent.selectOptions(category(), 'ヘアカラー')
    await userEvent.selectOptions(carried(), '取り扱いをやめた')
    await userEvent.selectOptions(use(), '施術で使う')

    // Act
    await userEvent.click(screen.getByRole('button', { name: '探す' }))

    // Assert
    expect(received).toEqual([
      [
        ['keyword', 'カラー'],
        ['barcode', ''],
        ['category', 'ヘアカラー'],
        ['carried', 'dropped'],
        ['use', 'treatment'],
      ],
    ])
  })

  it('should say what is wrong at the control, and take the focus there', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(keyword()).toHaveAccessibleDescription(
      '商品名、商品コード、ブランドの一部。 キーワードは 100 文字以内で入力してください。',
    )
    expect(keyword()).toHaveAttribute('aria-invalid', 'true')
    expect(keyword()).toHaveFocus()
  })

  it('should show the conditions of another address when the address changes under it', async () => {
    // Arrange
    const Moving = composeStory(
      {
        ...productFilterStories.Narrowed,
        render: (args) => (
          <UnderAnAddress {...args} other={{ category: 'スタイリング' }} />
        ),
      },
      productFilterStories.default,
    )
    await Moving.run()
    await userEvent.type(keyword(), 'ズ')

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '別のアドレスへ' }),
    )

    // Assert
    expect(keyword()).toHaveValue('')
    expect(barcode()).toHaveValue('')
    expect(category()).toHaveValue('スタイリング')
    expect(carried()).toHaveValue('')
    expect(use()).toHaveValue('')
  })

  it('should count on its button the conditions of the sheet that narrow the products, on a narrow screen', async () => {
    // Arrange
    setWindowWidth(390)

    // Act
    await stories.Narrowed.run()

    // Assert
    expect(screen.getByRole('button', { name: '条件（4）' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    )
  })
})
