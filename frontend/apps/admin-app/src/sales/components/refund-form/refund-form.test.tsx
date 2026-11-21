import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { describe, expect, it, vi } from 'vitest'
import * as refundFormStories from './refund-form.stories'

const stories = composeStories(refundFormStories)

const amount = (): HTMLElement =>
  screen.getByRole('textbox', { name: '返金する金額' })

const reason = (): HTMLElement =>
  screen.getByRole('textbox', { name: '返金の理由' })

/** What the part of the payment says: each term with its description */
const described = (): Record<string, string | null> => {
  const part = screen.getByRole('region', { name: '返金する支払い' })

  return Object.fromEntries(
    within(part)
      .getAllByRole('term')
      .map((term) => [
        term.textContent,
        term.nextElementSibling?.textContent ?? null,
      ]),
  )
}

describe('RefundForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.Cash, () =>
    screen.getByRole('textbox', { name: '返金する金額' }),
  )

  it('should name the payment, and give back the whole of it at first', async () => {
    // Act
    await stories.Cash.run()

    // Assert
    expect(described()).toEqual({
      取引番号: 'PT-7KQM-4F2H',
      受けた日時: '2026年11月20日（金） 11:05',
      支払い方法: '現金',
      金額: '￥3,000',
      カード: 'なし',
    })
    expect(amount()).toHaveValue('3000')
    expect(amount()).toHaveAccessibleDescription(
      '円の整数で、1 円から支払いの金額（￥3,000）まで入れます。1 件の支払いの返金は 1 回です。一部だけ返金すると、残りは返金できず、売上も取り消せなくなります。',
    )
    expect(reason()).toBeRequired()
  })

  it('should name the card of a payment by card', async () => {
    // Act
    await stories.ByCard.run()

    // Assert
    expect(described()).toMatchObject({
      支払い方法: 'クレジットカード',
      金額: '￥2,500',
      カード: 'VISA 下 4 桁 4242',
    })
    expect(amount()).toHaveValue('2500')
  })

  it('should hand over what the controls hold', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Cash.run({
      args: {
        ...stories.Cash.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })

    // Act
    await userEvent.clear(amount())
    await userEvent.type(amount(), '500')
    await userEvent.type(reason(), 'お釣りの渡し忘れ')
    await userEvent.click(
      screen.getByRole('button', { name: '返金を記録する' }),
    )

    // Assert
    expect(received).toEqual([
      [
        ['refundAmount', '500'],
        ['refundReason', 'お釣りの渡し忘れ'],
      ],
    ])
  })

  it('should say what is wrong at the controls, and take the focus to the first', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(amount()).toHaveAccessibleDescription(
      expect.stringContaining(
        '返金する金額は、支払いの金額（￥3,000）以下にしてください。',
      ),
    )
    expect(reason()).toHaveAccessibleDescription(
      expect.stringContaining('返金の理由を入力してください。'),
    )
    expect(amount()).toHaveFocus()
  })
})
