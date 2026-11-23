import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { columnsOf, rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import * as customerTableStories from './customer-table.stories'

const stories = composeStories(customerTableStories)

const table = (): HTMLElement => screen.getByRole('table', { name: '顧客台帳' })

describe('CustomerTable', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the customers with their kana, phone numbers, ranks, states, visits and last visits', async () => {
    // Act
    await stories.Ledger.run()

    // Assert
    expect(rowsOf(table())).toEqual([
      [
        '山田 花子',
        'ヤマダ ハナコ',
        '090-1234-5678',
        'ゴールド',
        'VIP',
        '14 回',
        '2026年11月18日（水）',
      ],
      [
        '鈴木 一郎',
        'スズキ イチロウ',
        '090-1234-5678',
        'レギュラー',
        '通常',
        '0 回',
        '来店なし',
      ],
      [
        '佐藤 健',
        '',
        '080-2345-6789',
        'レギュラー',
        '利用停止',
        '0 回',
        '来店なし',
      ],
    ])
    expect(screen.getByRole('status').textContent).toBe('3 人')
  })

  it('should lead from the name to the customer', async () => {
    // Act
    await stories.Ledger.run()

    // Assert
    expect(
      within(table())
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual(
      customerTableStories.ROWS.map(
        ({ id }) => `/salons/${salon.id}/customers/${id}`,
      ),
    )
  })

  it('should offer no choice of customers unless it is given one', async () => {
    // Act
    await stories.Ledger.run()

    // Assert
    expect(within(table()).queryByRole('checkbox')).toBeNull()
    expect(
      within(table())
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).not.toContain('選ぶ')
  })

  it('should begin each row with the checkbox that chooses the customer, and still head the row by the name', async () => {
    // Act
    await stories.Choosing.run()

    // Assert
    expect(
      within(table())
        .getAllByRole('checkbox')
        .map((box) => [
          box.closest('label')?.textContent,
          box.matches(':checked'),
        ]),
    ).toEqual([
      ['山田 花子 様を選ぶ', true],
      ['鈴木 一郎 様を選ぶ', false],
      ['佐藤 健 様を選ぶ', false],
    ])
    expect(
      within(table())
        .getAllByRole('rowheader')
        .map((header) => header.textContent),
    ).toEqual(['山田 花子', '鈴木 一郎', '佐藤 健'])
    expect(within(table()).getAllByRole('columnheader')[0]?.textContent).toBe(
      '選ぶ',
    )
  })

  it('should tell which customer was chosen, and which no longer is', async () => {
    // Arrange
    const onChoose = vi.fn()
    await stories.Choosing.run({
      args: {
        ...stories.Choosing.args,
        choice: {
          chosen: new Set([customerTableStories.ROWS[0]?.id ?? '']),
          onChoose,
        },
      },
    })

    // Act
    await userEvent.click(
      screen.getByRole('checkbox', { name: '鈴木 一郎 様を選ぶ' }),
    )
    await userEvent.click(
      screen.getByRole('checkbox', { name: '山田 花子 様を選ぶ' }),
    )

    // Assert
    expect(
      onChoose.mock.calls.map(([customer, chosen]) => [
        customer.lastName,
        chosen,
      ]),
    ).toEqual([
      ['鈴木', true],
      ['山田', false],
    ])
  })

  it('should say how many customers there are and offer the rest', async () => {
    // Act
    await stories.WithMore.run()

    // Assert
    expect(screen.getByRole('status').textContent).toBe(
      '128 人（3 人を表示しています）',
    )
    expect(screen.getByRole('button', { name: 'さらに表示' })).toBeVisible()
  })
})

describe('CustomerTable on a page in English', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('should list the customers and say how many there are, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.WithMore.run({
      args: {
        ...stories.WithMore.args,
        choice: { chosen: new Set(), onChoose: vi.fn() },
      },
    })

    // Assert
    expect(columnsOf('Customer ledger')).toEqual([
      'Select',
      'Name',
      'Phonetic name',
      'Phone number',
      'Membership rank',
      'Status',
      'Visits',
      'Last visit',
    ])
    expect(rowsOf('Customer ledger')).toEqual([
      [
        'Select 山田 花子',
        '山田 花子',
        'ヤマダ ハナコ',
        '090-1234-5678',
        'Gold',
        'VIP',
        '14 visits',
        'Wed, November 18, 2026',
      ],
      [
        'Select 鈴木 一郎',
        '鈴木 一郎',
        'スズキ イチロウ',
        '090-1234-5678',
        'Regular',
        'Normal',
        '0 visits',
        'No visits',
      ],
      [
        'Select 佐藤 健',
        '佐藤 健',
        '',
        '080-2345-6789',
        'Regular',
        'Suspended',
        '0 visits',
        'No visits',
      ],
    ])
    expect(
      screen.getByRole('checkbox', { name: 'Select 山田 花子' }),
    ).not.toBeChecked()
    expect(screen.getByRole('status').textContent).toBe(
      '128 people (showing 3)',
    )
    expect(screen.getByRole('button', { name: 'Show more' })).toBeVisible()
  })
})
