import { periodNameOf } from '@beauty-salon-frontend/salon-screens'
import {
  findAccessibilityViolations,
  type SavedFile,
  savedFiles,
} from '@beauty-salon-frontend/testing'
import {
  dayFromToday,
  salonIdOf,
  signInAs,
} from '@beauty-salon-frontend/testing/api'
import {
  firstSight,
  heading,
  notifications,
  termsOnceThere,
} from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OPERATOR,
  OSAKA,
  OWNER,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  arrangeSale,
  paySale,
  removeTokyo,
  voidSale,
} from '../__tests__/arrangements'
import {
  countOver,
  menuLink,
  renderAt,
  rowsOf,
  TITLE,
} from '../__tests__/screens'
import { reportsHrefOf } from '../navigation'

/*
 * The seed data has no sales: a test enters those of today in the salon
 * in Tokyo (`theDay`), whose owner and manager are seeded. Today is in the
 * period a report starts with, the month up to today.
 */

/** The only file the page saved, once it has saved one. */
const theSavedFile = async (): Promise<SavedFile> => {
  await waitFor(async () => expect(await savedFiles()).toHaveLength(1))
  const [file] = await savedFiles()
  if (file === undefined) {
    throw new Error('The page saved no file')
  }
  return file
}

/**
 * The sales of today: a cut paid in cash; a colour with a discount and a
 * product, paid by card and the product given back; a cut not paid yet;
 * and a sale entered by mistake and voided, which no report counts.
 */
const sellToday = async (): Promise<void> => {
  const cut = await arrangeSale({
    saleNumber: 'S-REPORT-1',
    day: 0,
    staffCode: 'STF001',
    lines: [
      {
        itemType: 'service',
        itemName: 'Ladies Cut',
        unitPrice: 5000,
        tax: 500,
        staffCode: 'STF001',
      },
    ],
  })
  await paySale(cut, 'cash', 5500)
  const colour = await arrangeSale({
    saleNumber: 'S-REPORT-2',
    day: 0,
    staffCode: 'STF002',
    lines: [
      {
        itemType: 'service',
        itemName: 'Full Color',
        unitPrice: 8000,
        discount: 1000,
        tax: 800,
        staffCode: 'STF002',
      },
      {
        itemType: 'product',
        itemName: 'Repair Shampoo',
        unitPrice: 3000,
        tax: 300,
      },
    ],
  })
  await paySale(colour, 'credit_card', 11_100, 3300)
  await arrangeSale({
    saleNumber: 'S-REPORT-3',
    day: 0,
    staffCode: 'STF001',
    lines: [
      {
        itemType: 'service',
        itemName: 'Mens Cut',
        unitPrice: 4000,
        tax: 400,
        staffCode: 'STF001',
      },
    ],
  })
  const mistake = await arrangeSale({
    saleNumber: 'S-REPORT-4',
    day: 0,
    staffCode: 'STF004',
    lines: [
      {
        itemType: 'service',
        itemName: 'Balayage',
        unitPrice: 15_000,
        tax: 1500,
        staffCode: 'STF004',
      },
    ],
  })
  await voidSale(mistake)
}

/** The sums of the sales of today */
const SUMS_OF_TODAY: [string, string][] = [
  ['売上', '￥21,000'],
  ['返金', '￥3,300'],
  ['純売上', '￥17,700'],
  ['会計の件数', '3 件'],
  ['客単価', '￥7,000'],
  ['消費税', '￥2,000'],
  ['値引き', '￥1,000'],
]

describe('the sales report, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    ['the owner', OWNER],
    ['a manager', MANAGER],
  ])(
    'should lead %s from the start to the report of their salon, over the month up to today',
    async (_case, email) => {
      // Arrange
      await sellToday()
      const today = await dayFromToday(0)
      const first = `${today.slice(0, 8)}01`
      renderAt('/')

      // Act
      await signInAs(email)

      // Assert
      expect(await heading('売上レポート')).toHaveFocus()
      expect(screen.getByText(TOKYO)).toBeVisible()
      expect(screen.getByLabelText('集計する期間（から）')).toHaveValue(first)
      expect(screen.getByLabelText('集計する期間（まで）')).toHaveValue(today)
      expect(
        screen.getByText(`${periodNameOf({ from: first, to: today })}の売上`),
      ).toBeVisible()
      expect(await termsOnceThere('期間の合計')).toEqual(SUMS_OF_TODAY)
      expect(rowsOf('支払い方法別の入金')).toEqual([
        ['クレジットカード', '￥7,800', '1 件', '58.6%'],
        ['現金', '￥5,500', '1 件', '41.4%'],
      ])
      expect(rowsOf('メニューの区分別の売上')).toEqual([
        ['カット', '￥9,900', '2 件', '55.9%'],
        ['カラー', '￥7,800', '1 件', '44.1%'],
      ])
      // The product counts for the member of the sale, who did the colour
      expect(rowsOf('スタッフ別の売上の上位 5 人')).toEqual([
        ['1 位', 'Mika Suzuki', '￥11,100', '1 件', '￥7,800'],
        ['2 位', 'Hiroshi Tanaka', '￥9,900', '2 件', '￥4,950'],
      ])
      expect(document.title).toBe(`売上レポート | ${TITLE}`)
    },
  )

  it('should count over the days chosen, keep them in the address, and say when nothing was sold in them', async () => {
    // Arrange
    await sellToday()
    renderAt(reportsHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    await screen.findByRole('region', { name: '期間の合計' })

    // Act
    await countOver('2020-01-01', '2020-12-31')

    // Assert
    expect(await screen.findByText('この期間の売上はありません')).toBeVisible()
    expect(
      screen.getByText(
        `${periodNameOf({ from: '2020-01-01', to: '2020-12-31' })}の売上`,
      ),
    ).toBeVisible()
    // Nothing was sold, so there is nothing to export
    expect(
      screen.queryByRole('button', { name: 'CSV に出力する' }),
    ).not.toBeInTheDocument()
  })

  it('should count the days shown anew when they are counted again, since sales are entered meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt(reportsHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    expect(await screen.findByText('この期間の売上はありません')).toBeVisible()
    await sellToday()

    // Act
    await user.click(screen.getByRole('button', { name: '集計する' }))

    // Assert
    expect(await termsOnceThere('期間の合計')).toEqual(SUMS_OF_TODAY)
  })

  it('should count the period of the address it was opened at, a year of 366 days', async () => {
    // Arrange
    await sellToday()
    const today = await dayFromToday(0)
    const yearAgo = await dayFromToday(-365)

    // Act
    renderAt(
      `${reportsHrefOf(await salonIdOf(TOKYO))}?from=${yearAgo}&to=${today}`,
    )
    await signInAs(OWNER)

    // Assert
    expect(await termsOnceThere('期間の合計')).toEqual(SUMS_OF_TODAY)
    expect(screen.getByLabelText('集計する期間（から）')).toHaveValue(yearAgo)
  })

  it.each<[string, string, string, string]>([
    [
      'a period longer than the API counts over',
      '2024-01-01',
      '2025-01-01',
      '期間は 366 日までにしてください。',
    ],
    [
      'a last day before the first',
      '2026-11-10',
      '2026-11-01',
      '終わりの日は、始まりの日と同じか、その後にしてください。',
    ],
  ])(
    'should say what is wrong with %s, give it the focus and count nothing anew',
    async (_case, from, to, error) => {
      // Arrange
      await sellToday()
      renderAt(reportsHrefOf(await salonIdOf(TOKYO)))
      await signInAs(OWNER)
      await screen.findByRole('region', { name: '期間の合計' })

      // Act
      await countOver(from, to)

      // Assert
      const last = screen.getByLabelText('集計する期間（まで）')
      expect(last).toHaveFocus()
      expect(last).toHaveAccessibleDescription(expect.stringContaining(error))
      expect(await termsOnceThere('期間の合計')).toEqual(SUMS_OF_TODAY)
    },
  )

  it('should say nothing more of what was wrong once the header leads to the month up to today', async () => {
    // Arrange
    const user = userEvent.setup()
    const today = await dayFromToday(0)
    renderAt(
      `${reportsHrefOf(await salonIdOf(TOKYO))}?from=2020-01-01&to=2020-01-31`,
    )
    await signInAs(OWNER)
    await screen.findByText('この期間の売上はありません')
    await countOver('2026-11-10', '2026-11-01')

    // Act
    await user.click(menuLink('売上レポート'))

    // Assert
    await waitFor(() =>
      expect(screen.getByLabelText('集計する期間（まで）')).toHaveValue(today),
    )
    expect(screen.getByLabelText('集計する期間（まで）')).not.toHaveAttribute(
      'aria-invalid',
    )
  })

  it('should save the sales of the period as the CSV file the API makes, a day a row, and say so', async () => {
    // Arrange
    const user = userEvent.setup()
    await sellToday()
    const today = await dayFromToday(0)
    const yesterday = await dayFromToday(-1)
    renderAt(
      `${reportsHrefOf(await salonIdOf(TOKYO))}?from=${yesterday}&to=${today}`,
    )
    await signInAs(OWNER)
    await screen.findByRole('region', { name: '期間の合計' })
    const exporting = screen.getByRole('button', { name: 'CSV に出力する' })

    // Act
    await user.click(exporting)

    // Assert
    const file = await theSavedFile()
    expect(file.name).toBe(`sales-report-${yesterday}-${today}.csv`)
    expect(file.type).toBe('text/csv; charset=utf-8')
    expect(file.text).toBe(
      [
        'date,sales,tax,discounts,transactions,refunds,net',
        `${yesterday},0,0,0,0,0,0`,
        `${today},21000,2000,1000,3,3300,17700`,
        '',
      ].join('\r\n'),
    )
    expect(notifications()).toContain(
      `${periodNameOf({ from: yesterday, to: today })}の売上を、${file.name} に出力しました。`,
    )
    expect(exporting).toHaveFocus()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('should save no file of a salon removed since the report was read, and say why beside the button', async () => {
    // Arrange
    const user = userEvent.setup()
    await sellToday()
    renderAt(reportsHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OPERATOR)
    await screen.findByRole('region', { name: '期間の合計' })
    await removeTokyo()

    // Act
    await user.click(screen.getByRole('button', { name: 'CSV に出力する' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'このサロンは削除されたため、売上を出力できません。',
    )
    expect(await savedFiles()).toEqual([])
  })

  it('should say that a salon removed since it was read has no report any more', async () => {
    // Arrange
    await sellToday()
    renderAt(reportsHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OPERATOR)
    await screen.findByRole('region', { name: '期間の合計' })
    await removeTokyo()

    // Act
    await countOver('2020-01-01', '2020-01-31')

    // Assert
    expect(
      await screen.findByText(
        'このサロンは削除されたため、売上レポートを見られません。',
      ),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'トップへ戻る' })).toBeVisible()
    expect(screen.queryByLabelText('集計する期間（から）')).toBeNull()
  })

  it('should never show the report as an earlier screen read it, since sales are entered meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt('/')
    await signInAs(OWNER)
    expect(await screen.findByText('この期間の売上はありません')).toBeVisible()
    await user.click(
      within(screen.getByRole('banner')).getByRole('link', {
        name: 'アカウントの安全',
      }),
    )
    await heading('アカウントの安全')
    await sellToday()

    // Act
    await user.click(menuLink('売上レポート'))

    // Assert
    expect(await termsOnceThere('期間の合計')).toEqual(SUMS_OF_TODAY)
    expect(firstSight()[0]).toMatch(/\/reports$/)
    expect(firstSight()[1]).not.toContain('この期間の売上はありません')
  })

  it('should let an administrator choose the salon whose report to open', async () => {
    // Arrange
    const user = userEvent.setup()
    await sellToday()
    renderAt('/')
    await signInAs(OPERATOR)
    expect(await heading('サロンを選ぶ')).toHaveFocus()
    expect(
      screen.getByText('売上レポートを開くサロンを選びます。'),
    ).toBeVisible()

    // Act
    await user.click(await screen.findByRole('link', { name: TOKYO }))

    // Assert
    expect(await heading('売上レポート')).toHaveFocus()
    expect(await termsOnceThere('期間の合計')).toEqual(SUMS_OF_TODAY)
    expect(menuLink('売上レポート')).toHaveAttribute('aria-current', 'page')
  })

  it('should tell the owner that the report of another salon is not theirs to see, and lead them to their own', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt(reportsHrefOf(await salonIdOf(OSAKA)))
    await signInAs(OWNER)
    expect(
      await screen.findByText(
        'このサロンの売上レポートは、見られません。売上レポートを見られるのは、そのサロンのオーナーとマネージャーと、管理者です。',
      ),
    ).toBeVisible()
    expect(screen.queryByLabelText('集計する期間（から）')).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'CSV に出力する' }),
    ).not.toBeInTheDocument()

    // Act
    await user.click(
      screen.getByRole('link', { name: '自分のサロンの売上レポートへ' }),
    )

    // Assert
    expect(await heading('売上レポート')).toHaveFocus()
    expect(await screen.findByText(TOKYO)).toBeVisible()
    expect(await screen.findByText('この期間の売上はありません')).toBeVisible()
  })

  it('should say that a salon of no such ID is not found', async () => {
    // Arrange
    renderAt(reportsHrefOf('0b9a4d0e-5c1f-4c3e-9d6a-2f7b8e1a3c55'))

    // Act
    await signInAs(OWNER)

    // Assert
    expect(await heading('サロンが見つかりません')).toBeVisible()
  })

  it.each<[string, string, () => Promise<void>, () => Promise<unknown>]>([
    [
      'a report',
      TOKYO,
      sellToday,
      () => screen.findByRole('table', { name: 'スタッフ別の売上の上位 5 人' }),
    ],
    [
      'a period without sales',
      TOKYO,
      async () => undefined,
      () => screen.findByText('この期間の売上はありません'),
    ],
    [
      'the report of another salon',
      OSAKA,
      async () => undefined,
      () => screen.findByRole('link', { name: '自分のサロンの売上レポートへ' }),
    ],
  ])('should be accessible on %s', async (_case, salon, arrange, shown) => {
    // Arrange
    await arrange()
    renderAt(reportsHrefOf(await salonIdOf(salon)))
    await signInAs(OWNER)

    // Act
    await shown()

    // Assert
    expect(await findAccessibilityViolations(document.body)).toEqual([])
  })
})
