import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { describe, expect, it } from 'vitest'
import * as receiptStories from './receipt.stories'

const stories = composeStories(receiptStories)

const receipt = (): HTMLElement =>
  screen.getByRole('article', { name: 'Salon Hikari 表参道店' })

const described = (): [string | null, string | null][] =>
  within(receipt())
    .getAllByRole('term')
    .map((term) => [
      term.textContent,
      term.nextElementSibling?.textContent ?? null,
    ])

describe('Receipt', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should show the salon, the sale, what was bought and how it was paid', async () => {
    // Act
    await stories.Paid.run()

    // Assert
    expect(
      within(receipt()).getByText('〒150-0001 東京都 渋谷区 神宮前 4-1-1'),
    ).toBeVisible()
    expect(within(receipt()).getByText('電話 03-1234-5678')).toBeVisible()
    expect(described()).toEqual([
      ['レシート番号', 'SL-2KQM-9F4H'],
      ['会計日時', '2026年11月20日（金） 11:02'],
      ['発行日時', '2026年11月20日（金） 11:10'],
      ['小計', '￥5,500'],
      ['割引', '￥0'],
      ['消費税', '￥0'],
      ['合計', '￥5,500'],
      ['お支払い（現金）', '￥3,000'],
      ['お支払い（クレジットカード VISA 下 4 桁 4242）', '￥2,500'],
    ])
    expect(
      within(screen.getByRole('table', { name: 'お買い上げの明細' }))
        .getAllByRole('row')
        .slice(1)
        .map((row) =>
          [
            ...within(row).getAllByRole('rowheader'),
            ...within(row).getAllByRole('cell'),
          ].map((cell) => cell.textContent),
        ),
    ).toEqual([['カット', '1', '￥5,500', '￥0', '￥5,500']])
  })

  it('should say what was given back, and the building of the salon', async () => {
    // Act
    await stories.Refunded.run()

    // Assert
    expect(
      within(receipt()).getByText(
        '〒150-0001 東京都 渋谷区 神宮前 4-1-1 表参道ビル 2F',
      ),
    ).toBeVisible()
    expect(described().slice(-2)).toEqual([
      ['お支払い（現金）', '￥5,500'],
      ['ご返金', '￥1,000'],
    ])
  })
})
