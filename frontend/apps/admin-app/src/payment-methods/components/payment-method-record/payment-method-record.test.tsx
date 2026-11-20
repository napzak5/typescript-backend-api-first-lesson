import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as recordStories from './payment-method-record.stories'

const stories = composeStories(recordStories)

/** What the record says, term by term. */
const terms = (): [string, string][] =>
  within(screen.getByRole('region', { name: '支払い方法' }))
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
