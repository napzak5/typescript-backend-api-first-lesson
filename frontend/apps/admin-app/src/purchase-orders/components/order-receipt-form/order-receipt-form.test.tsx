import { languageStore } from '@beauty-salon-frontend/io'
import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { colourLot, shampooRow } from '../../../inventory/components/examples'
import * as orderReceiptFormStories from './order-receipt-form.stories'

const stories = composeStories(orderReceiptFormStories)

const COLOUR = 'COLOR001 ヘアカラー ナチュラルブラウン'
const SHAMPOO = 'SHMP001 プロフェッショナル シャンプー 500ml'

const box = (name: string): HTMLElement => screen.getByRole('textbox', { name })

describe('OrderReceiptForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.Shipped, () => box(COLOUR))

  it('should give every item whose row is there the quantity ordered, and name the item whose row was removed', async () => {
    // Act
    await stories.Shipped.run()

    // Assert
    const quantities = screen.getByRole('group', { name: '届いた数量' })
    expect(
      within(quantities)
        .getAllByRole('textbox')
        .map((control) => control.getAttribute('name')),
    ).toEqual([`received.${colourLot.id}`, `received.${shampooRow.id}`])
    expect(box(COLOUR)).toHaveValue('12')
    expect(box(COLOUR)).toHaveAccessibleDescription('発注 12 本')
    expect(box(SHAMPOO)).toHaveValue('2.5')
    expect(box(SHAMPOO)).toHaveAccessibleDescription('発注 2.5 本')
    expect(
      within(quantities).getByText(
        'WAX001 スタイリングワックス 80g: 在庫の行が削除されたので、入荷できません。',
      ),
    ).toBeVisible()
    expect(
      within(quantities).getByText(/届かなかった明細は空にします。/),
    ).toBeVisible()
  })

  it('should open with the notes of the delivery the order holds', async () => {
    // Act
    await stories.Shipped.run()

    // Assert
    expect(box('納品のメモ')).toHaveValue('午前中に、裏口へ')
    expect(box('納品のメモ')).toHaveAccessibleDescription(
      '任意。届いたときのこと（欠品や破損など）。書き換えると、発注の納品のメモが変わります。',
    )
  })

  it('should open with empty notes for an order that has none', async () => {
    // Act
    await stories.WithoutNotes.run()

    // Assert
    expect(box('納品のメモ')).toHaveValue('')
    expect(screen.queryByText(/入荷できません。$/)).toBeNull()
  })

  it('should hand over what the controls hold', async () => {
    // Arrange
    await stories.Shipped.run()

    // Act
    await userEvent.clear(box(COLOUR))
    await userEvent.type(box(COLOUR), '10')
    await userEvent.clear(box(SHAMPOO))
    await userEvent.type(box('納品のメモ'), '。2 本は後日')
    await userEvent.click(
      screen.getByRole('button', { name: '入荷を記録する' }),
    )

    // Assert
    const handed = vi
      .mocked(stories.Shipped.args.onSubmit ?? (() => undefined))
      .mock.calls.map(([values]) => Object.fromEntries(values.entries()))
    expect(handed).toEqual([
      {
        [`received.${colourLot.id}`]: '10',
        [`received.${shampooRow.id}`]: '',
        deliveryNotes: '午前中に、裏口へ。2 本は後日',
      },
    ])
  })

  it('should say what is wrong at the controls, and move the focus to the first', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(box(COLOUR)).toHaveAccessibleDescription(
      expect.stringContaining('発注した 12 本 までの数'),
    )
    expect(box('納品のメモ')).toHaveAccessibleDescription(
      expect.stringContaining('入荷では消せません。'),
    )
    expect(box(COLOUR)).toHaveFocus()
  })

  it('should say above the form that the order was read anew', async () => {
    // Act
    await stories.RowsChanged.run()

    // Assert
    expect(
      screen.getByText(/その間に削除されました。発注を読み直しました。/),
    ).toBeVisible()
  })

  it('should show that the receipt is on its way', async () => {
    // Act
    await stories.Sending.run()

    // Assert
    expect(
      screen.getByRole('button', { name: '入荷を記録する' }),
    ).toHaveAttribute('aria-busy', 'true')
  })
})

describe('OrderReceiptForm on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name its controls and what each item ordered, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Shipped.run()

    // Assert
    expect(
      screen.getByRole('group', { name: 'Quantities received' }),
    ).toBeVisible()
    expect(box(COLOUR)).toHaveAccessibleDescription('Ordered 12 本')
    expect(
      screen.getByRole('textbox', { name: 'Delivery notes' }),
    ).toHaveAccessibleDescription(
      'Optional. What happened on arrival (such as missing or damaged goods). Changing it changes the delivery notes of the order.',
    )
  })

  it('should say what is wrong under the controls, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithErrors.run()

    // Assert
    expect(
      screen.getByRole('textbox', { name: 'Delivery notes' }),
    ).toHaveAccessibleDescription(
      expect.stringContaining(
        'The delivery notes cannot be cleared when the receipt is recorded. Keep them, or write others.',
      ),
    )
  })
})
