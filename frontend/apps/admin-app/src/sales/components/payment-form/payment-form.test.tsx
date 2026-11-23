import { languageStore } from '@beauty-salon-frontend/io'
import {
  itShouldBeAccessibleInEveryStory,
  itShouldBeSentByTheEnterKey,
} from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { paymentMethods } from '../examples'
import * as paymentFormStories from './payment-form.stories'

const stories = composeStories(paymentFormStories)

const methods = (): HTMLElement =>
  screen.getByRole('radiogroup', { name: '支払い方法' })

const amount = (): HTMLElement => screen.getByRole('textbox', { name: '金額' })

describe('PaymentForm', () => {
  itShouldBeAccessibleInEveryStory(stories)

  itShouldBeSentByTheEnterKey(stories.Owed, () =>
    screen.getByRole('textbox', { name: '金額' }),
  )

  it('should offer the methods the salon uses with what they take at once, and the whole of what is left to pay', async () => {
    // Act
    await stories.Owed.run()

    // Assert
    const offered = within(methods()).getAllByRole('radio')
    expect(offered).toEqual(
      [
        '現金',
        'クレジットカード（￥1,000から）',
        '交通系 IC（￥20,000まで）',
      ].map((name) => within(methods()).getByRole('radio', { name })),
    )
    expect(within(methods()).queryByRole('radio', { checked: true })).toBeNull()
    expect(amount()).toHaveValue('5500')
    expect(amount()).toHaveAccessibleDescription(
      '円の整数で入れます。未払い残額は￥5,500です。分けて受け取るときは、受け取った分を入れます。',
    )
    expect(
      screen.queryByRole('textbox', { name: 'カードの下 4 桁' }),
    ).toBeNull()
  })

  it('should start from what is left to pay', async () => {
    // Act
    await stories.Rest.run()

    // Assert
    expect(amount()).toHaveValue('2500')
  })

  it('should ask for the card while a card is chosen, and hand it over', async () => {
    // Arrange
    const received: [string, FormDataEntryValue][][] = []
    await stories.Owed.run({
      args: {
        ...stories.Owed.args,
        onSubmit: vi.fn((values: FormData) => {
          received.push(Array.from(values.entries()))
        }),
      },
    })

    // Act
    await userEvent.click(
      screen.getByRole('radio', { name: 'クレジットカード（￥1,000から）' }),
    )
    await userEvent.type(
      screen.getByRole('textbox', { name: 'カードの下 4 桁' }),
      '4242',
    )
    await userEvent.type(
      screen.getByRole('textbox', { name: 'カードのブランド' }),
      'VISA',
    )
    await userEvent.click(
      screen.getByRole('button', { name: '支払いを記録する' }),
    )

    // Assert
    expect(received).toEqual([
      [
        ['paymentMethodId', paymentMethods[1]?.id],
        ['amount', '5500'],
        ['cardLastFour', '4242'],
        ['cardBrand', 'VISA'],
      ],
    ])
  })

  it('should leave the card out when another method is chosen after it', async () => {
    // Arrange
    await stories.Owed.run()
    await userEvent.click(
      screen.getByRole('radio', { name: 'クレジットカード（￥1,000から）' }),
    )

    // Act
    await userEvent.click(screen.getByRole('radio', { name: '現金' }))

    // Assert
    expect(
      screen.queryByRole('textbox', { name: 'カードの下 4 桁' }),
    ).toBeNull()
    expect(
      screen.queryByRole('textbox', { name: 'カードのブランド' }),
    ).toBeNull()
  })

  it('should say what is wrong at the controls, and take the focus to the first', async () => {
    // Act
    await stories.WithErrors.run()

    // Assert
    expect(methods()).toHaveAccessibleDescription(
      expect.stringContaining('支払い方法を選んでください。'),
    )
    expect(amount()).toHaveAccessibleDescription(
      expect.stringContaining(
        '金額は、未払い残額（￥5,500）以下にしてください。',
      ),
    )
    expect(screen.getByRole('radio', { name: '現金' })).toHaveFocus()
  })
})

describe('PaymentForm on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should offer the methods with what they take at once, and the whole of what is left to pay, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Owed.run()

    // Assert
    const offered = screen.getByRole('radiogroup', { name: 'Payment method' })
    expect(offered).toHaveAccessibleDescription(
      'In brackets: what the method takes at a time.',
    )
    expect(
      within(offered)
        .getAllByRole('radio')
        .map((radio) => radio.closest('label')?.textContent),
    ).toEqual([
      '現金',
      'クレジットカード (¥1,000 or more)',
      '交通系 IC (up to ¥20,000)',
    ])
    expect(
      screen.getByRole('textbox', { name: 'Amount' }),
    ).toHaveAccessibleDescription(
      'A whole number of yen. ¥5,500 is left to pay. To take it in parts, enter what was received.',
    )
    expect(
      screen.getByRole('button', { name: 'Record the payment' }),
    ).toBeVisible()
  })

  it('should ask for the card in English while a card is chosen', async () => {
    // Arrange
    languageStore.choose('en')
    await stories.Owed.run()

    // Act
    await userEvent.click(
      screen.getByRole('radio', { name: 'クレジットカード (¥1,000 or more)' }),
    )

    // Assert
    expect(
      screen.getByRole('textbox', { name: 'Last four digits of the card' }),
    ).toHaveAccessibleDescription(
      'Only when known. Never the number of the card itself.',
    )
    expect(
      screen.getByRole('textbox', { name: 'Card brand' }),
    ).toHaveAccessibleDescription(
      'Only when known (VISA, Mastercard, JCB and so on).',
    )
  })

  it('should say what is wrong at the controls in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithErrors.run()

    // Assert
    expect(
      screen.getByRole('radiogroup', { name: 'Payment method' }),
    ).toHaveAccessibleDescription(
      expect.stringContaining('Choose a payment method.'),
    )
    expect(
      screen.getByRole('textbox', { name: 'Amount' }),
    ).toHaveAccessibleDescription(
      expect.stringContaining(
        'The amount can be at most what is left to pay (¥5,500).',
      ),
    )
  })
})
