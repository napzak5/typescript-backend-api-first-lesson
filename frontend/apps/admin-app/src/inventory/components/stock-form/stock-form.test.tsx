import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import { colour, gloves } from '../../../products/components/examples'
import * as formStories from './stock-form.stories'

const stories = composeStories(formStories)

const text = (name: RegExp | string): HTMLElement =>
  screen.getByRole('textbox', { name })
const product = (): HTMLElement =>
  screen.getByRole('combobox', { name: /商品/ })
const lot = (): HTMLElement =>
  screen.getByRole('textbox', { name: /ロット番号/ })
const noLot = (): HTMLElement | null =>
  screen.queryByRole('textbox', { name: /ロット番号/ })
const expiry = (): HTMLElement => screen.getByLabelText('使用期限')

/** The values the form hands over when it is sent */
const sentBy = async (
  story: keyof typeof stories,
  act: () => Promise<void>,
  submitLabel: string,
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
  await userEvent.click(screen.getByRole('button', { name: submitLabel }))

  return received.flat()
}

describe('StockForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should offer the products given, and ask for no lot before one kept by lots is chosen', async () => {
    // Act
    await stories.New.run()

    // Assert
    expect(
      within(product())
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual([
      '選んでください',
      'ヘアカラー ナチュラルブラウン（COLOR001）',
      'プロフェッショナル シャンプー 500ml（SHMP001）',
      'ニトリル手袋 M（SUP-GLOVE）',
    ])
    expect(product()).toBeRequired()
    expect(noLot()).toBeNull()
    expect(
      screen.getByText(
        '在庫数 0 の行として足します。在庫数は、入庫と棚卸しで変わります。',
      ),
    ).toBeVisible()
    expect(expiry()).toHaveAttribute('min', '1900-01-01')
    expect(expiry()).toHaveAttribute('max', '2999-12-31')
  })

  it('should ask for the lot of a product kept by lots, and send what it holds', async () => {
    // Act
    const sent = await sentBy(
      'New',
      async () => {
        await userEvent.selectOptions(
          product(),
          'ヘアカラー ナチュラルブラウン（COLOR001）',
        )
        expect(lot()).toBeRequired()
        expect(lot()).toHaveAccessibleDescription(
          '100 文字まで。この商品のほかの在庫の行と同じロット番号は使えません。',
        )
        await userEvent.type(lot(), 'LOT-2026-050')
        await userEvent.type(expiry(), '2027-06-30')
        await userEvent.type(text('保管場所'), 'バックヤード')
        await userEvent.type(text('棚'), 'B-3')
      },
      '足す',
    )

    // Assert
    expect(sent).toEqual([
      ['productId', colour.id],
      ['lotNumber', 'LOT-2026-050'],
      ['expiryDate', '2027-06-30'],
      ['location', 'バックヤード'],
      ['shelf', 'B-3'],
      ['notes', ''],
    ])
  })

  it('should take the lot away when a product without lots is chosen instead', async () => {
    // Act
    const sent = await sentBy(
      'New',
      async () => {
        await userEvent.selectOptions(
          product(),
          'ヘアカラー ナチュラルブラウン（COLOR001）',
        )
        await userEvent.selectOptions(product(), 'ニトリル手袋 M（SUP-GLOVE）')
      },
      '足す',
    )

    // Assert
    expect(noLot()).toBeNull()
    expect(sent).toEqual([
      ['productId', gloves.id],
      ['expiryDate', ''],
      ['location', ''],
      ['shelf', ''],
      ['notes', ''],
    ])
  })

  it('should open with what a row keeps, its product named and not to be chosen', async () => {
    // Act
    await stories.Recorded.run()

    // Assert
    expect(screen.queryByRole('combobox')).toBeNull()
    expect(
      screen.getByText('ヘアカラー ナチュラルブラウン（COLOR001）'),
    ).toBeVisible()
    expect(lot()).toHaveValue('LOT-2026-041')
    expect(lot()).toBeRequired()
    expect(expiry()).toHaveValue('2027-03-31')
    expect(text('保管場所')).toHaveValue('バックヤード')
    expect(text('棚')).toHaveValue('B-2')
    expect(text('メモ')).toHaveValue('')
  })

  it('should have no lot for a row of a product without lots', async () => {
    // Act
    await stories.WithoutLots.run()

    // Assert
    expect(noLot()).toBeNull()
    expect(text('メモ')).toHaveValue(
      '箱を開けたものから使う。\n店頭の見本は数えない。',
    )
  })

  it('should let the lot of a product no longer kept by lots be cleared, and not ask for it', async () => {
    // Act
    await stories.LotToClear.run()

    // Assert
    expect(lot()).toHaveValue('LOT-2026-041')
    expect(lot()).not.toBeRequired()
    expect(lot()).toHaveAccessibleDescription(
      'この商品は、在庫をロット番号で分けません。ロット番号は、消すことだけができます。',
    )
  })

  it('should say what is wrong at each control, and take the focus to the first', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(product()).toHaveAccessibleDescription(
      '取り扱い中の商品です。ロット番号で分ける商品を選ぶと、ロット番号を入力します。 商品を選んでください。',
    )
    expect(product()).toHaveFocus()
    expect(expiry()).toHaveAccessibleDescription(
      '使用期限のないものは、空にします。 使用期限は、1900年1月1日から2999年12月31日までの日付で入力してください。',
    )
    expect(text('棚')).toHaveAttribute('aria-invalid', 'true')
  })

  it('should say why the API refused the account above the form', async () => {
    // Act
    await stories.Refused.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'このサロンの在庫は、変えられません。',
    )
  })
})
