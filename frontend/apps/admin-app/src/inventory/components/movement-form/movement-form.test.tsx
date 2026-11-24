import { languageStore } from '@beauty-salon-frontend/io'
import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as formStories from './movement-form.stories'

const stories = composeStories(formStories)

const kinds = (): HTMLElement =>
  screen.getByRole('radiogroup', { name: '区分' })
const way = (): HTMLElement | null =>
  screen.queryByRole('radiogroup', { name: '向き' })
const text = (name: RegExp | string): HTMLElement =>
  screen.getByRole('textbox', { name })

/** The values the form hands over when it is sent */
const sentBy = async (
  story: keyof typeof stories,
  act: () => Promise<void>,
): Promise<[string, FormDataEntryValue][]> => {
  const received: [string, FormDataEntryValue][][] = []
  await stories[story].run({
    args: {
      ...stories[story].args,
      onSubmit: vi.fn((values: FormData) => {
        received.push(Array.from(values.entries()))
      }),
    },
  })
  await act()
  await userEvent.click(screen.getByRole('button', { name: '記録する' }))

  return received.flat()
}

describe('MovementForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.ForAKeeper, () =>
    screen.getByRole('textbox', { name: '数量' }),
  )

  it('should offer every kind to one who keeps the stock, with none chosen, and say the stock of the row', async () => {
    // Act
    await stories.ForAKeeper.run()

    // Assert
    expect(
      within(kinds())
        .getAllByRole('radio')
        .map((radio) => [
          radio.getAttribute('value'),
          radio.closest('label')?.textContent,
        ]),
    ).toEqual([
      ['purchase', '仕入れ'],
      ['use', '施術で使用'],
      ['sale', '店頭販売'],
      ['return', '返品'],
      ['adjustment', '在庫の調整'],
      ['disposal', '廃棄'],
      ['transfer', 'サロン間の移動'],
    ])
    expect(within(kinds()).queryByRole('radio', { checked: true })).toBeNull()
    expect(way()).toBeNull()
    expect(
      screen.getByText(
        'ヘアカラー ナチュラルブラウン（ロット LOT-2026-041）。いまの在庫数は 12 本、そのうち使える数は 12 本 です。',
      ),
    ).toBeVisible()
    expect(text(/^数量/)).toBeRequired()
    expect(text(/^数量/)).toHaveAccessibleDescription(
      '本 で数えます。小数は 2 桁まで。',
    )
    expect(text('単価（円）')).not.toBeRequired()
    expect(text('理由')).not.toBeRequired()
  })

  it('should name a row of a product the salon removed by its lot, and count its quantity in no unit', async () => {
    // Act
    await stories.OfARemovedProduct.run()

    // Assert
    expect(
      screen.getByText(
        '削除した商品（ロット LOT-2026-041）。いまの在庫数は 12、そのうち使える数は 12 です。',
      ),
    ).toBeVisible()
    expect(text(/^数量/)).toHaveAccessibleDescription('小数は 2 桁まで。')
  })

  it('should offer a stylist the kinds of every day, and say who records the others', async () => {
    // Act
    await stories.ForAStylist.run()

    // Assert
    expect(
      within(kinds())
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('value')),
    ).toEqual(['purchase', 'use', 'sale', 'return'])
    expect(kinds()).toHaveAccessibleDescription(
      '在庫の調整、廃棄、サロン間の移動は、オーナーとマネージャーが記録します。',
    )
    expect(
      screen.getByText(
        'プロフェッショナル シャンプー 500ml。いまの在庫数は 8 本、そのうち使える数は 6 本 です。',
      ),
    ).toBeVisible()
  })

  it('should ask which way and why for an adjustment, and send what it holds', async () => {
    // Act
    const sent = await sentBy('ForAKeeper', async () => {
      await userEvent.click(screen.getByRole('radio', { name: '在庫の調整' }))
      expect(way()).toHaveAccessibleDescription(
        '帳簿の在庫数を、実際の数に合わせます。',
      )
      expect(text(/^理由/)).toBeRequired()
      expect(text(/^理由/)).toHaveAccessibleDescription(
        '在庫数を変える理由を、次に数える人のために書きます。',
      )
      await userEvent.click(screen.getByRole('radio', { name: '在庫が減る' }))
      await userEvent.type(text(/^数量/), '1.5')
      await userEvent.type(text(/^理由/), '数え直したら少なかった')
    })

    // Assert
    expect(sent).toEqual([
      ['transactionType', 'adjustment'],
      ['direction', 'out'],
      ['quantity', '1.5'],
      ['unitCost', ''],
      ['reason', '数え直したら少なかった'],
    ])
  })

  it('should ask no way for a purchase, and send its cost', async () => {
    // Act
    const sent = await sentBy('ForAKeeper', async () => {
      await userEvent.click(screen.getByRole('radio', { name: '仕入れ' }))
      await userEvent.type(text(/^数量/), '10')
      await userEvent.type(text('単価（円）'), '1200')
    })

    // Assert
    expect(way()).toBeNull()
    expect(sent).toEqual([
      ['transactionType', 'purchase'],
      ['quantity', '10'],
      ['unitCost', '1200'],
      ['reason', ''],
    ])
  })

  it.each<[string, string]>([
    ['返品', '仕入先に返すと減り、お客様から戻ると増えます。'],
    [
      'サロン間の移動',
      'ほかのサロンへ送ると減り、ほかのサロンから受け取ると増えます。受け取ったサロンでも、記録します。',
    ],
  ])('should say which way %s goes', async (kind, description) => {
    // Arrange
    await stories.ForAKeeper.run()

    // Act
    await userEvent.click(screen.getByRole('radio', { name: kind }))

    // Assert
    expect(way()).toHaveAccessibleDescription(description)
    expect(text('理由')).not.toBeRequired()
  })

  it('should say what is wrong at each control, and take the focus to the first', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(kinds()).toHaveAccessibleDescription('区分を選んでください。')
    expect(within(kinds()).getAllByRole('radio')[0]).toHaveFocus()
    expect(text(/^数量/)).toHaveAccessibleDescription(
      '本 で数えます。小数は 2 桁まで。 数量は、0.01 から 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。',
    )
    expect(text('単価（円）')).toHaveAttribute('aria-invalid', 'true')
  })

  it('should say why the API refused the account above the form', async () => {
    // Act
    await stories.Refused.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'このアカウントでは、この在庫の移動を記録できません。',
    )
  })
})

describe('MovementForm on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should offer the kinds, and say the stock of the row, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.ForAKeeper.run()

    // Assert
    const offered = screen.getByRole('radiogroup', { name: 'Kind' })
    expect(
      within(offered)
        .getAllByRole('radio')
        .map((radio) => radio.closest('label')?.textContent),
    ).toEqual([
      'Purchase',
      'Used in a treatment',
      'Retail sale',
      'Return',
      'Adjustment',
      'Disposal',
      'Transfer between salons',
    ])
    expect(
      screen.getByRole('group', { name: 'Stock movements' }),
    ).toHaveAccessibleDescription(
      'ヘアカラー ナチュラルブラウン (lot LOT-2026-041). In stock now: 12 本, of which 12 本 available.',
    )
    expect(text(/^Quantity/)).toHaveAccessibleDescription(
      'Counted in 本. Up to 2 decimal places.',
    )
    expect(text('Unit cost (yen)')).toHaveAccessibleDescription(
      'Optional. The amount is the unit cost × the quantity, rounded to whole yen.',
    )
    expect(text('Reason')).toHaveAccessibleDescription('Optional.')
  })

  it('should ask which way and why for an adjustment in English', async () => {
    // Arrange
    languageStore.choose('en')
    await stories.ForAKeeper.run()

    // Act
    await userEvent.click(screen.getByRole('radio', { name: 'Adjustment' }))

    // Assert
    const direction = screen.getByRole('radiogroup', { name: 'Direction' })
    expect(direction).toHaveAccessibleDescription(
      'Sets the stock on the books to the actual count.',
    )
    expect(
      within(direction)
        .getAllByRole('radio')
        .map((radio) => radio.closest('label')?.textContent),
    ).toEqual(['Stock goes up', 'Stock goes down'])
    expect(text(/^Reason/)).toHaveAccessibleDescription(
      'Write why the stock changes, for the next person who counts it.',
    )
  })

  it('should say who records the other kinds, what is wrong and why the account was refused, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.ForAStylist.run()

    // Assert
    expect(
      screen.getByRole('radiogroup', { name: 'Kind' }),
    ).toHaveAccessibleDescription(
      'Adjustments, disposals and transfers between salons are recorded by owners and managers.',
    )

    // Act
    await stories.WithErrors.run()

    // Assert
    expect(
      screen.getByRole('radiogroup', { name: 'Kind' }),
    ).toHaveAccessibleDescription('Choose the kind.')
    expect(text(/^Quantity/)).toHaveAccessibleDescription(
      'Counted in 本. Up to 2 decimal places. Enter the quantity as a number from 0.01 to 99,999,999.99 (up to 2 decimal places).',
    )

    // Act
    await stories.Refused.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This account cannot record this stock movement.',
    )
  })
})
