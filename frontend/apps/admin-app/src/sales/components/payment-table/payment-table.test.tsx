import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { columnsOf, rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import * as paymentTableStories from './payment-table.stories'

const stories = composeStories(paymentTableStories)

describe('PaymentTable', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the payments with their times on the clock of the salon, their methods and their cards', async () => {
    // Act
    await stories.Paid.run()

    // Assert
    expect(rowsOf('支払い')).toEqual([
      [
        'PT-7KQM-4F2H',
        '2026年11月20日（金） 11:05',
        '現金',
        '￥3,000',
        '記録なし',
        '受け取り',
        'なし',
      ],
      [
        'PT-9F4H-2KQM',
        '2026年11月20日（金） 11:06',
        'クレジットカード',
        '￥2,500',
        'VISA 下 4 桁 4242',
        '受け取り',
        'なし',
      ],
    ])
  })

  it('should say that nothing was received yet', async () => {
    // Act
    await stories.Empty.run()

    // Assert
    expect(rowsOf('支払い')).toEqual([['まだ支払いはありません']])
  })

  it('should name a method the salon removed, and what was recorded of the card', async () => {
    // Act
    await stories.Refunded.run()

    // Assert
    expect(rowsOf('支払い')).toEqual([
      [
        'PT-7KQM-4F2H',
        '2026年11月20日（金） 11:05',
        '一覧にない支払い方法',
        '￥3,000',
        'JCB',
        '一部返金',
        '￥1,000、2026年11月20日（金） 11:30',
      ],
    ])
    expect(screen.getByRole('term')).toHaveTextContent(
      'PT-7KQM-4F2H の返金の理由',
    )
    expect(screen.getByRole('definition')).toHaveTextContent('お釣りの渡し忘れ')
  })

  it('should link a payment that can be given back to the screen that does, named by its number', async () => {
    // Act
    await stories.GivenBackByOwner.run()

    // Assert
    expect(rowsOf('支払い').map((row) => row.slice(-2))).toEqual([
      ['返金済み', '￥3,000、2026年11月20日（金） 11:30'],
      ['受け取り', '返金する'],
    ])
    expect(screen.queryByRole('term')).toBeNull()
    expect(
      screen.getByRole('link', { name: 'PT-9F4H-2KQM を返金する' }),
    ).toHaveAttribute(
      'href',
      '/payments/7a8b9c0d-1e2f-4a3b-8c5d-6e7f80910213/refund',
    )
  })
})

describe('PaymentTable on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should list the payments with their methods and their cards in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Paid.run()

    // Assert
    expect(columnsOf('Payments')).toEqual([
      'Transaction number',
      'Time received',
      'Payment method',
      'Amount',
      'Card',
      'Status',
      'Refund',
    ])
    expect(rowsOf('Payments')).toEqual([
      [
        'PT-7KQM-4F2H',
        'Fri, November 20, 2026 at 11:05',
        '現金',
        '¥3,000',
        'Not recorded',
        'Received',
        'None',
      ],
      [
        'PT-9F4H-2KQM',
        'Fri, November 20, 2026 at 11:06',
        'クレジットカード',
        '¥2,500',
        'VISA ending in 4242',
        'Received',
        'None',
      ],
    ])
  })

  it('should say that nothing was received yet in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Empty.run()

    // Assert
    expect(rowsOf('Payments')).toEqual([['No payments yet']])
  })

  it('should say what was given back of a payment, when and why, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Refunded.run()

    // Assert
    expect(rowsOf('Payments')).toEqual([
      [
        'PT-7KQM-4F2H',
        'Fri, November 20, 2026 at 11:05',
        'Payment method not listed',
        '¥3,000',
        'JCB',
        'Partly refunded',
        '¥1,000, Fri, November 20, 2026 at 11:30',
      ],
    ])
    expect(screen.getByRole('term')).toHaveTextContent(
      'Reason for the refund of PT-7KQM-4F2H',
    )
  })

  it('should name the link that gives a payment back by its number in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.GivenBackByOwner.run()

    // Assert
    expect(
      screen.getByRole('link', { name: 'Refund PT-9F4H-2KQM' }),
    ).toHaveTextContent('Refund')
  })
})
