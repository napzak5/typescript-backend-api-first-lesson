import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as recordStories from './payment-method-record.stories'

const stories = composeStories(recordStories)

/** What the record says, term by term. */
const terms = (name = '支払い方法'): [string, string][] =>
  within(screen.getByRole('region', { name }))
    .getAllByRole('term')
    .map((term) => [
      term.textContent ?? '',
      term.nextElementSibling?.textContent ?? '',
    ])

describe('PaymentMethodRecord', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should say everything the salon keeps of a method', async () => {
    // Act
    await stories.Recorded.run()

    // Assert
    expect(terms()).toEqual([
      ['表示名', 'クレジットカード（端末 1）'],
      ['種類', 'クレジットカード'],
      [
        '説明',
        'VISA、Mastercard、JCB、American Express。\n分割払いは受け付けません。',
      ],
      ['1 回の金額', '￥1,000から'],
      ['手数料率', '3.24%'],
      ['決済代行会社', '決済代行の例'],
      ['使う場所', '店頭、オンライン'],
      ['状態', '使っている'],
      ['並び順', '2'],
    ])
  })

  it('should say what is not recorded, and that the method is used no more', async () => {
    // Act
    await stories.NotUsed.run()

    // Assert
    expect(terms()).toEqual(
      expect.arrayContaining([
        ['説明', '記録なし'],
        ['手数料率', '記録なし'],
        ['決済代行会社', '記録なし'],
        ['使う場所', 'オンライン'],
        ['状態', '使っていない'],
      ]),
    )
  })
})

describe('PaymentMethodRecord on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should name the terms and write the values of a method, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Recorded.run()

    // Assert
    expect(terms('Payment method')).toEqual([
      ['Display name', 'クレジットカード（端末 1）'],
      ['Type', 'Credit card'],
      [
        'Description',
        'VISA、Mastercard、JCB、American Express。\n分割払いは受け付けません。',
      ],
      ['Amount at a time', '¥1,000 or more'],
      ['Fee rate', '3.24%'],
      ['Payment processor', '決済代行の例'],
      ['Where used', 'In store, Online'],
      ['Status', 'In use'],
      ['Sort order', '2'],
    ])
  })

  it('should say what is not recorded, and that the method is used no more, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.NotUsed.run()

    // Assert
    expect(terms('Payment method')).toEqual(
      expect.arrayContaining([
        ['Amount at a time', '¥10,000 to ¥500,000'],
        ['Fee rate', 'Not recorded'],
        ['Where used', 'Online'],
        ['Status', 'Not in use'],
      ]),
    )
  })
})
