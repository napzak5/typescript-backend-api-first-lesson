import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as formStories from './payment-method-form.stories'

const stories = composeStories(formStories)

const text = (name: RegExp | string): HTMLElement =>
  screen.getByRole('textbox', { name })

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

describe('PaymentMethodForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.New, () =>
    screen.getByRole('textbox', { name: '表示名' }),
  )

  it('should open a new method used at the counter and last in the order, and send what it holds', async () => {
    // Act
    const sent = await sentBy(
      'New',
      async () => {
        await userEvent.selectOptions(
          screen.getByRole('combobox', { name: /種類/ }),
          'QR コード決済',
        )
        await userEvent.type(text(/表示名/), 'PayPay')
        await userEvent.type(text('1 回の金額の上限（円）'), '１０,０００')
        await userEvent.type(text('手数料率（%）'), '1.98')
      },
      '足す',
    )

    // Assert
    expect(sent).toEqual([
      ['method', 'qr_payment'],
      ['displayName', 'PayPay'],
      ['description', ''],
      ['minimumAmount', ''],
      ['maximumAmount', '１０,０００'],
      ['fee', '1.98'],
      ['processorName', ''],
      ['isOfflineEnabled', 'on'],
      ['sortOrder', '5'],
      ['isActive', 'on'],
    ])
  })

  it('should offer every kind of payment, none chosen at first', async () => {
    // Act
    await stories.New.run()

    // Assert
    const kind = screen.getByRole('combobox', { name: /種類/ })
    expect(kind).toHaveValue('')
    expect(
      Array.from(kind.querySelectorAll('option'), (option) => option.text),
    ).toEqual([
      '選んでください',
      '現金',
      'クレジットカード',
      'デビットカード',
      '電子マネー',
      'QR コード決済',
      '銀行振込',
      'ポイント',
    ])
  })

  it('should open with the method as it is, and show its kind without offering it', async () => {
    // Act
    await stories.Recorded.run()

    // Assert
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(
      screen.getByText(/^種類: クレジットカード。種類は変えられません。/),
    ).toBeVisible()
    expect(text(/表示名/)).toHaveValue('クレジットカード（端末 1）')
    expect(text('1 回の金額の下限（円）')).toHaveValue('1000')
    expect(text('1 回の金額の上限（円）')).toHaveValue('')
    expect(text('手数料率（%）')).toHaveValue('3.24')
    expect(text('決済代行会社')).toHaveValue('決済代行の例')
    expect(
      screen.getByRole('checkbox', { name: 'オンラインの決済で使う' }),
    ).toBeChecked()
    expect(text(/並び順/)).toHaveValue('2')
    expect(
      screen.getByRole('checkbox', { name: 'この支払い方法を使う' }),
    ).toBeChecked()
  })

  it('should say what is wrong under the control it belongs to', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(text(/表示名/)).toHaveAccessibleDescription(
      expect.stringContaining('表示名を、100 文字までで入力してください。'),
    )
    expect(
      screen.getByRole('combobox', { name: /種類/ }),
    ).toHaveAccessibleDescription(
      expect.stringContaining('種類を選んでください。'),
    )
    expect(text('1 回の金額の上限（円）')).toHaveAccessibleDescription(
      expect.stringContaining('下限と同じか、下限より大きい金額'),
    )
  })

  it('should say what went wrong with the attempt above the form', async () => {
    // Act
    await stories.Refused.run()

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(
      'このサロンの支払い方法は、変えられません。',
    )
  })
})
