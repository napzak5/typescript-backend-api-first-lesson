import { languageStore } from '@beauty-salon-frontend/io'
import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  colourLot,
  expiredColour,
  glovesRow,
  shampooRow,
} from '../../../inventory/components/examples'
import * as orderFormStories from './order-form.stories'

const stories = composeStories(orderFormStories)

const COLOUR_LOT = 'ヘアカラー ナチュラルブラウン（ロット LOT-2026-041）'
const EXPIRED_COLOUR = 'ヘアカラー ナチュラルブラウン（ロット LOT-2025-112）'
const SHAMPOO = 'プロフェッショナル シャンプー 500ml'
const GLOVES = 'ニトリル手袋 M'

/** A control of the group of a row */
const ofRow = (row: string, label: string): HTMLElement =>
  within(screen.getByRole('group', { name: row })).getByRole('textbox', {
    name: label,
  })

describe('OrderForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.Rows, () =>
    screen.getByRole('textbox', { name: '仕入先' }),
  )

  it('should give every row a quantity, with its stock, and a price, at what its product is bought at', async () => {
    // Act
    await stories.Rows.run()

    // Assert
    expect(
      within(screen.getByRole('group', { name: '明細' }))
        .getAllByRole('group')
        .map((group) => group.querySelector('legend')?.textContent),
    ).toEqual([EXPIRED_COLOUR, COLOUR_LOT, SHAMPOO, GLOVES])
    expect(ofRow(COLOUR_LOT, '数量')).toHaveValue('')
    expect(ofRow(COLOUR_LOT, '数量')).toHaveAccessibleDescription(
      '在庫数 12 本',
    )
    expect(ofRow(COLOUR_LOT, '単価（円）')).toHaveValue('800')
    expect(ofRow(SHAMPOO, '単価（円）')).toHaveValue('1500')
    // The gloves have no price they are bought at
    expect(ofRow(GLOVES, '単価（円）')).toHaveValue('')
    expect(screen.getByText('小計 ￥0')).toBeVisible()
  })

  it('should start with the supplier and the quantities suggested, and what they come to', async () => {
    // Act
    await stories.FromSuggestions.run()

    // Assert: 30 × 800 + 12.5 × 1,500
    expect(screen.getByRole('textbox', { name: '仕入先' })).toHaveValue(
      'ビューティーサプライ東京',
    )
    expect(ofRow(COLOUR_LOT, '数量')).toHaveValue('30')
    expect(ofRow(EXPIRED_COLOUR, '数量')).toHaveValue('')
    expect(ofRow(SHAMPOO, '数量')).toHaveValue('12.5')
    expect(ofRow(GLOVES, '数量')).toHaveValue('')
    expect(screen.getByText('小計 ￥42,750')).toBeVisible()
    expect(
      screen.getByRole('textbox', { name: '税額（円）' }),
    ).toHaveAccessibleDescription(
      '仕入先の請求に合わせて入力します。小計の 10% は ￥4,275 です（円未満切り捨て）。',
    )
  })

  it('should work out what the items come to as they are entered, and the tax at the rate of the salon', async () => {
    // Arrange
    await stories.Rows.run()

    // Act
    await userEvent.type(ofRow(COLOUR_LOT, '数量'), '12')
    await userEvent.type(ofRow(SHAMPOO, '数量'), '2.5')
    await userEvent.clear(ofRow(SHAMPOO, '単価（円）'))
    await userEvent.type(ofRow(SHAMPOO, '単価（円）'), '1499')

    // Assert: 12 × 800 + 2.5 × 1,499 rounded half up
    expect(screen.getByText('小計 ￥13,348')).toBeVisible()
    expect(
      screen.getByRole('textbox', { name: '税額（円）' }),
    ).toHaveAccessibleDescription(
      '仕入先の請求に合わせて入力します。小計の 10% は ￥1,334 です（円未満切り捨て）。',
    )
  })

  it('should hand over what was entered under the names of the rows', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Rows.run({
      args: {
        ...stories.Rows.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })
    await userEvent.type(
      screen.getByRole('textbox', { name: '仕入先' }),
      '東京ビューティーサプライ',
    )
    await userEvent.type(ofRow(GLOVES, '数量'), '10')
    await userEvent.type(ofRow(GLOVES, '単価（円）'), '1200')
    await userEvent.type(
      screen.getByRole('textbox', { name: '税額（円）' }),
      '1200',
    )
    await userEvent.type(screen.getByLabelText('納品予定日'), '2026-11-27')

    // Act
    await userEvent.click(screen.getByRole('button', { name: '発注を作る' }))

    // Assert
    expect(received).toEqual([
      [
        ['supplier', '東京ビューティーサプライ'],
        [`quantity.${expiredColour.id}`, ''],
        [`unitPrice.${expiredColour.id}`, '800'],
        [`quantity.${colourLot.id}`, ''],
        [`unitPrice.${colourLot.id}`, '800'],
        [`quantity.${shampooRow.id}`, ''],
        [`unitPrice.${shampooRow.id}`, '1500'],
        [`quantity.${glovesRow.id}`, '10'],
        [`unitPrice.${glovesRow.id}`, '1200'],
        ['taxAmount', '1200'],
        ['shippingCost', ''],
        ['expectedDelivery', '2026-11-27'],
        ['paymentTerms', ''],
        ['notes', ''],
      ],
    ])
  })

  it('should say what is wrong at the controls, and move the focus to the first', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(
      screen.getByRole('textbox', { name: '仕入先' }),
    ).toHaveAccessibleDescription(
      '発注を探すときも、この名前で探します。 仕入先を入力してください。',
    )
    expect(screen.getByRole('textbox', { name: '仕入先' })).toHaveFocus()
    expect(ofRow(COLOUR_LOT, '数量')).toHaveAccessibleDescription(
      '在庫数 12 本 数量は、0 より大きく 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。',
    )
    expect(ofRow(COLOUR_LOT, '単価（円）')).toHaveAccessibleDescription(
      '単価は、0 以上の円の整数で入力してください。',
    )
  })

  it('should say above the form that the rows were read anew', async () => {
    // Act
    await stories.RowsChanged.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      '発注する在庫の行のどれかが、その間に削除されました。',
    )
  })
})

describe('OrderForm on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name its controls and say what the items come to, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Rows.run()

    // Assert
    expect(
      screen.getByRole('textbox', { name: 'Supplier' }),
    ).toHaveAccessibleDescription('Orders are also searched for by this name.')
    const shampoo = within(
      screen.getByRole('group', {
        name: 'プロフェッショナル シャンプー 500ml',
      }),
    )
    expect(
      shampoo.getByRole('textbox', { name: 'Quantity' }),
    ).toHaveAccessibleDescription('In stock: 8 本')
    expect(
      shampoo.getByRole('textbox', { name: 'Unit price (yen)' }),
    ).toHaveValue('1500')
    expect(screen.getByText('Subtotal ¥0')).toBeVisible()
    expect(
      screen.getByRole('textbox', { name: 'Tax (yen)' }),
    ).toHaveAccessibleDescription(
      'Enter it as the bill of the supplier says. 10% of the subtotal is ¥0 (rounded down to the yen).',
    )
    expect(
      screen.getByRole('textbox', { name: 'Shipping (yen)' }),
    ).toHaveAccessibleDescription(
      'Optional. Leave it empty when there is no shipping cost.',
    )
    expect(
      screen.getByLabelText('Expected delivery'),
    ).toHaveAccessibleDescription('Optional. The day the supplier promised.')
  })

  it('should say what is wrong under the controls, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithErrors.run()

    // Assert
    expect(
      screen.getByRole('textbox', { name: 'Supplier' }),
    ).toHaveAccessibleDescription(
      expect.stringContaining('Enter the supplier.'),
    )
    expect(
      screen.getByRole('textbox', { name: 'Tax (yen)' }),
    ).toHaveAccessibleDescription(
      expect.stringContaining('Enter the tax. Enter 0 when there is none.'),
    )
  })
})
