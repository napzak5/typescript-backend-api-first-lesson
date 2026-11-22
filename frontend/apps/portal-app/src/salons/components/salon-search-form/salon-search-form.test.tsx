import {
  itShouldBeAccessibleInEveryStory,
  setWindowWidth,
} from '@beauty-salon-frontend/testing'
import { optionsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories, composeStory } from '@storybook/react-vite'
import { useState } from 'react'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import type { SalonConditions } from '../../salon-search'
import { SalonSearchForm, type SalonSearchFormProps } from './salon-search-form'
import * as salonSearchFormStories from './salon-search-form.stories'

const stories = composeStories(salonSearchFormStories)

const keyword = (): HTMLElement =>
  screen.getByRole('searchbox', { name: 'キーワード' })
const prefecture = (): HTMLElement =>
  screen.getByRole('textbox', { name: '都道府県' })
const city = (): HTMLElement =>
  screen.getByRole('textbox', { name: '市区町村' })
const minRating = (): HTMLElement =>
  screen.getByRole('combobox', { name: '評価' })

type UnderAnAddressProps = SalonSearchFormProps & {
  /** The conditions of the address that the button leads to */
  other: SalonConditions
}

/**
 * The form on a screen whose address changes under it: the button stands
 * for the visitor who goes back, or follows a link to another search.
 */
const UnderAnAddress = ({ other, ...props }: UnderAnAddressProps) => {
  const [conditions, setConditions] = useState(props.conditions)

  return (
    <>
      <SalonSearchForm {...props} conditions={conditions} />
      <button type='button' onClick={() => setConditions(other)}>
        別の検索のアドレスへ
      </button>
    </>
  )
}

const underAnAddress = (other: SalonConditions) =>
  composeStory(
    {
      ...salonSearchFormStories.WithConditions,
      render: (args) => <UnderAnAddress {...args} other={other} />,
    },
    salonSearchFormStories.default,
  )

describe('SalonSearchForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should be the search of the page, with a control for every condition', async () => {
    // Act
    await stories.WithoutConditions.run()

    // Assert
    // The element `search`: the testing library does not know its role yet,
    // the browser test asserts the landmark
    expect(keyword().closest('search')).toHaveAttribute(
      'aria-label',
      'サロンを探す',
    )
    expect(keyword()).toHaveValue('')
    expect(prefecture()).toHaveValue('')
    expect(city()).toHaveValue('')
    expect(minRating()).toHaveValue('')
    expect(optionsOf(minRating())).toEqual([
      '指定なし',
      '3.0 以上',
      '3.5 以上',
      '4.0 以上',
      '4.5 以上',
    ])
  })

  it('should say that a place is found by the spelling the salon registered', async () => {
    // Act
    await stories.WithoutConditions.run()

    // Assert
    expect(prefecture()).toHaveAccessibleDescription(
      'サロンが登録した表記と同じもの（例: 東京都）',
    )
    expect(city()).toHaveAccessibleDescription(
      'サロンが登録した表記と同じもの（例: 渋谷区）',
    )
  })

  it('should take no more characters than the API takes', async () => {
    // Act
    await stories.WithoutConditions.run()

    // Assert
    expect(keyword()).toHaveAttribute('maxlength', '100')
    expect(prefecture()).toHaveAttribute('maxlength', '50')
    expect(city()).toHaveAttribute('maxlength', '100')
  })

  it('should start from the conditions it is given', async () => {
    // Act
    await stories.WithConditions.run()

    // Assert
    expect(keyword()).toHaveValue('こもれび')
    expect(prefecture()).toHaveValue('東京都')
    expect(city()).toHaveValue('渋谷区')
    expect(minRating()).toHaveValue('4')
  })

  it('should hand over what its controls hold, under the names of the conditions, when its button is pressed', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.WithoutConditions.run({
      args: {
        ...stories.WithoutConditions.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })
    await userEvent.type(keyword(), 'カラー')
    await userEvent.type(city(), '渋谷区')
    await userEvent.selectOptions(minRating(), '4.5 以上')

    // Act
    await userEvent.click(screen.getByRole('button', { name: '探す' }))

    // Assert
    expect(received).toEqual([
      [
        ['keyword', 'カラー'],
        ['prefecture', ''],
        ['city', '渋谷区'],
        ['minRating', '4.5'],
      ],
    ])
  })

  it('should keep the focus on its button after it is sent', async () => {
    // Arrange
    await stories.WithoutConditions.run()
    const send = screen.getByRole('button', { name: '探す' })

    // Act
    await userEvent.click(send)

    // Assert
    expect(send).toHaveFocus()
  })

  it('should show the conditions of another address when the address changes under it, and drop what was typed', async () => {
    // Arrange
    await underAnAddress({ prefecture: '大阪府', minRating: 3.5 }).run()
    await userEvent.type(keyword(), 'と、書きかけの言葉')

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '別の検索のアドレスへ' }),
    )

    // Assert
    expect(keyword()).toHaveValue('')
    expect(prefecture()).toHaveValue('大阪府')
    expect(city()).toHaveValue('')
    expect(minRating()).toHaveValue('3.5')
  })

  it('should keep what is typed while the address stays as it is', async () => {
    // Arrange: the same conditions, in another object
    await underAnAddress({
      minRating: 4,
      city: '渋谷区',
      prefecture: '東京都',
      keyword: 'こもれび',
    }).run()
    await userEvent.type(keyword(), 'と、書きかけの言葉')

    // Act
    await userEvent.click(
      screen.getByRole('button', { name: '別の検索のアドレスへ' }),
    )

    // Assert
    expect(keyword()).toHaveValue('こもれびと、書きかけの言葉')
  })

  it('should be sent by the Enter key in a control', async () => {
    // Arrange
    await stories.WithoutConditions.run()

    // Act
    await userEvent.type(keyword(), 'カット{Enter}')

    // Assert
    expect(stories.WithoutConditions.args.onSubmit).toHaveBeenCalledTimes(1)
  })

  it('should offer to drop the conditions only when there are some', async () => {
    // Act
    await stories.WithoutConditions.run()

    // Assert
    expect(screen.queryByRole('link', { name: '条件を外す' })).toBeNull()
  })

  it('should lead to the search without a condition', async () => {
    // Act
    await stories.WithConditions.run()

    // Assert
    expect(screen.getByRole('link', { name: '条件を外す' })).toHaveAttribute(
      'href',
      '/',
    )
  })

  it('should count on its button the conditions of the sheet that narrow the salons, on a narrow screen', async () => {
    // Arrange
    setWindowWidth(390)

    // Act
    await stories.WithConditions.run()

    // Assert
    expect(screen.getByRole('button', { name: '条件（3）' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    )
  })
})
