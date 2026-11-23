import { languageStore } from '@beauty-salon-frontend/io'
import { itShouldBeAccessibleInEveryStory } from '@beauty-salon-frontend/testing'
import { rowsOf } from '@beauty-salon-frontend/testing/screens'
import { composeStories } from '@storybook/react-vite'
import { screen, userEvent, within } from 'storybook/test'
import { afterEach, describe, expect, it } from 'vitest'
import { salon } from '../../../bookings/components/examples'
import { expiredColour } from '../examples'
import * as tableStories from './alert-table.stories'

const stories = composeStories(tableStories)

const table = (): HTMLElement =>
  screen.getByRole('table', { name: '在庫のアラート' })

describe('AlertTable', () => {
  itShouldBeAccessibleInEveryStory(stories)

  it('should list the alerts, with who saw to each and when, on the clock of the salon', async () => {
    // Act
    await stories.Alerts.run()

    // Assert
    expect(rowsOf(table())).toEqual([
      [
        '緊急期限切れ',
        'ヘアカラー ナチュラルブラウン（ロット LOT-2025-112）使用期限 2025年12月31日',
        '2.5 本',
        '2026年11月20日（金） 09:30（佐藤 健）廃棄の前に、メーカーに返品できるか問い合わせる。',
      ],
      [
        '緊急在庫僅少',
        'ニトリル手袋 M（SUP-GLOVE）',
        '0 箱最低在庫数 0 箱',
        '未確認確認済みにする',
      ],
    ])
    expect(within(table()).getAllByRole('rowheader')).toHaveLength(2)
    expect(screen.getByRole('status')).toHaveTextContent('2 件')
  })

  it('should lead from an alert of a stock row to the row, and name nothing as a link for an alert of a product', async () => {
    // Act
    await stories.Alerts.run()

    // Assert
    expect(
      within(table())
        .getAllByRole('link')
        .map((link) => [link.textContent, link.getAttribute('href')]),
    ).toEqual([
      [
        'ヘアカラー ナチュラルブラウン（ロット LOT-2025-112）',
        `/salons/${salon.id}/inventory/${expiredColour.id}`,
      ],
    ])
  })

  it('should name the alert of the button that sees to it, and hand the alert over', async () => {
    // Arrange
    await stories.Alerts.run()

    // Act
    await userEvent.click(
      screen.getByRole('button', {
        name: 'ニトリル手袋 M（SUP-GLOVE）の在庫僅少を確認済みにする',
      }),
    )

    // Assert
    expect(stories.Alerts.args.onAcknowledge).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ alert: 'low_stock', productCode: 'SUP-GLOVE' }),
    )
    expect(within(table()).getAllByRole('button')).toHaveLength(1)
  })

  it('should say what each kind of alert holds the stock against', async () => {
    // Act
    await stories.OfEveryKind.run()

    // Assert
    expect(rowsOf(table()).map((row) => row.slice(0, 3))).toEqual([
      [
        '注意期限切れ間近',
        'ヘアカラー ナチュラルブラウン（ロット LOT-2026-077）使用期限 2026年12月10日',
        '6 本',
      ],
      [
        '注意在庫僅少',
        'プロフェッショナル シャンプー 500ml（SHMP001）',
        '4 本最低在庫数 5 本',
      ],
      [
        '情報在庫過剰',
        'プロフェッショナル シャンプー 500ml（SHMP001）',
        '60 本最大在庫数 50 本',
      ],
    ])
  })

  it.each<[string, keyof typeof stories]>([
    ['an administrator', 'AcknowledgedByAnAdministrator'],
    ['somebody while the staff are being read', 'WhileTheStaffAreRead'],
  ])('should name nobody for %s', async (_, story) => {
    // Act
    await stories[story].run()

    // Assert
    expect(rowsOf(table())[0]?.[3]).toMatch(/^2026年11月20日（金） 09:30(?!（)/)
  })

  it('should say how many are shown, and ask for the next ones', async () => {
    // Arrange
    await stories.More.run()
    expect(screen.getByRole('status')).toHaveTextContent(
      '21 件（1 件を表示しています）',
    )

    // Act
    await userEvent.click(screen.getByRole('button', { name: 'さらに表示' }))

    // Assert
    expect(stories.More.args.onMore).toHaveBeenCalledTimes(1)
  })
})

describe('AlertTable on a page in English', () => {
  const alerts = (): HTMLElement =>
    screen.getByRole('table', { name: 'Inventory alerts' })

  afterEach(() => {
    localStorage.clear()
  })

  it('should list the alerts, with who saw to each and when, in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Alerts.run()

    // Assert
    expect(
      within(alerts())
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Alert', 'Subject', 'In stock', 'Acknowledgement'])
    expect(rowsOf(alerts())).toEqual([
      [
        'CriticalExpired',
        'ヘアカラー ナチュラルブラウン (lot LOT-2025-112)Expiry: December 31, 2025',
        '2.5 本',
        'Fri, November 20, 2026 at 09:30 (佐藤 健)廃棄の前に、メーカーに返品できるか問い合わせる。',
      ],
      [
        'CriticalLow stock',
        'ニトリル手袋 M (SUP-GLOVE)',
        '0 箱Minimum stock: 0 箱',
        'Not acknowledgedAcknowledge',
      ],
    ])
    expect(screen.getByRole('status')).toHaveTextContent('2 items')
  })

  it('should name the alert of the button that sees to it in English', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.Alerts.run()

    // Assert
    expect(
      screen.getByRole('button', {
        name: 'Acknowledge the alert “Low stock” for ニトリル手袋 M (SUP-GLOVE)',
      }),
    ).toHaveTextContent('Acknowledge')
  })

  it('should say in English what each kind of alert holds the stock against', async () => {
    // Arrange
    languageStore.choose('en')

    // Act
    await stories.OfEveryKind.run()

    // Assert
    expect(rowsOf(alerts()).map((row) => row.slice(0, 3))).toEqual([
      [
        'WarningExpiring soon',
        'ヘアカラー ナチュラルブラウン (lot LOT-2026-077)Expiry: December 10, 2026',
        '6 本',
      ],
      [
        'WarningLow stock',
        'プロフェッショナル シャンプー 500ml (SHMP001)',
        '4 本Minimum stock: 5 本',
      ],
      [
        'InfoOverstock',
        'プロフェッショナル シャンプー 500ml (SHMP001)',
        '60 本Maximum stock: 50 本',
      ],
    ])
  })
})
