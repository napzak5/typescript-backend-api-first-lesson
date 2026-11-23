import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { columnsOf, rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
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
    expect(rowsOf('お買い上げの明細')).toEqual([
      ['カット', '1', '￥5,500', '￥0', '￥5,500'],
    ])
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

  it('should write the address of a salon that gave no postal code without one', async () => {
    // Act
    await stories.WithoutPostalCode.run()

    // Assert
    expect(
      within(receipt()).getByText('東京都 渋谷区 神宮前 4-1-1'),
    ).toBeVisible()
    expect(within(receipt()).queryByText(/〒/)).toBeNull()
  })
})

describe('Receipt on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should show the salon, the sale, what was bought and how it was paid in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Paid.run()

    // Assert
    expect(
      within(receipt()).getByText('150-0001 東京都 渋谷区 神宮前 4-1-1'),
    ).toBeVisible()
    expect(within(receipt()).getByText('Phone 03-1234-5678')).toBeVisible()
    expect(described()).toEqual([
      ['Receipt number', 'SL-2KQM-9F4H'],
      ['Time of sale', 'Fri, November 20, 2026 at 11:02'],
      ['Issued', 'Fri, November 20, 2026 at 11:10'],
      ['Subtotal', '¥5,500'],
      ['Discount', '¥0'],
      ['Tax', '¥0'],
      ['Total', '¥5,500'],
      ['Paid (現金)', '¥3,000'],
      ['Paid (クレジットカード VISA ending in 4242)', '¥2,500'],
    ])
    expect(columnsOf('Items purchased')).toEqual([
      'Item',
      'Quantity',
      'Unit price',
      'Discount',
      'Amount',
    ])
    expect(rowsOf('Items purchased')).toEqual([
      ['カット', '1', '¥5,500', '¥0', '¥5,500'],
    ])
    expect(
      within(receipt()).getByText('Thank you for your visit.'),
    ).toBeVisible()
  })

  it('should say what was given back in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Refunded.run()

    // Assert
    expect(described().slice(-1)).toEqual([['Refunded', '¥1,000']])
  })
})
