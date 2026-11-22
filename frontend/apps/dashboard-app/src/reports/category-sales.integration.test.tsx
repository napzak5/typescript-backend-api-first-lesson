import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { signInAs, testApi } from '@beauty-salon-frontend/testing/api'
import { firstSight, heading } from '@beauty-salon-frontend/testing/screens'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ADMIN,
  dayFromToday,
  OSAKA,
  OWNER,
  removeTokyo,
  salonIdOf,
  sellToBreakDown,
  TOKYO,
} from '../__tests__/arrangements'
import {
  countOver,
  menuLink,
  renderAt,
  rowsOf,
  TITLE,
} from '../__tests__/screens'
import { categorySalesHrefOf } from '../navigation'

/*
 * The seed data has no sales: a test enters those of today, and a product
 * sold forty days before, in the salon in Tokyo (`sellToBreakDown`). Of
 * the services of the menu, the cuts are of the kind `cut` and the colour
 * and the balayage of `color`.
 */

const TABLE = '区分別の売上'

/** The kinds of service sold today: the fringe trim is on no menu */
const KINDS_OF_TODAY = [
  ['カラー', '￥24,300', '2 件', '￥12,150', '68.8%'],
  ['カット', '￥9,900', '2 件', '￥4,950', '28.0%'],
  ['その他', '￥1,100', '1 件', '￥1,100', '3.1%'],
]

describe('the sales by kind of service, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should lead the owner from the kinds of service of the report to their screen, over the days of the report', async () => {
    // Arrange
    const user = userEvent.setup()
    await sellToBreakDown()
    renderAt('/')
    await signInAs(OWNER)
    await screen.findByRole('table', { name: 'メニューの区分別の売上' })

    // Act
    await user.click(screen.getByRole('link', { name: '区分別の売上へ' }))

    // Assert
    expect(await heading('区分別の売上')).toHaveFocus()
    await screen.findByRole('table', { name: TABLE })
    expect(rowsOf(TABLE)).toEqual(KINDS_OF_TODAY)
    expect(
      screen.getByRole('rowheader', { name: 'その他' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('集計する期間（まで）')).toHaveValue(
      await dayFromToday(0),
    )
    expect(menuLink('区分別の売上')).toHaveAttribute('aria-current', 'page')
    expect(document.title).toBe(`区分別の売上 | ${TITLE}`)
  })

  it('should count a service in the kind it is of now', async () => {
    // Arrange
    await sellToBreakDown()
    await testApi().query(
      `update services set "categoryId" = (
         select id from service_categories
         where category = 'treatment' and "salonId" = services."salonId")
       where name = 'Balayage'`,
    )

    // Act
    renderAt(categorySalesHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)

    // Assert
    await screen.findByRole('table', { name: TABLE })
    expect(rowsOf(TABLE)).toEqual([
      ['トリートメント', '￥16,500', '1 件', '￥16,500', '46.7%'],
      ['カット', '￥9,900', '2 件', '￥4,950', '28.0%'],
      ['カラー', '￥7,800', '1 件', '￥7,800', '22.1%'],
      ['その他', '￥1,100', '1 件', '￥1,100', '3.1%'],
    ])
  })

  it('should say that no service was sold on days that sold a product alone', async () => {
    // Arrange
    await sellToBreakDown()
    const before = await dayFromToday(-40)
    renderAt(categorySalesHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    await screen.findByRole('table', { name: TABLE })

    // Act
    await countOver(before, before)

    // Assert
    expect(
      await screen.findByText('この期間のメニューの売上はありません'),
    ).toBeVisible()
    expect(screen.queryByRole('table', { name: TABLE })).toBeNull()
  })

  it('should say what is wrong with the days, give it the focus and count nothing anew', async () => {
    // Arrange
    await sellToBreakDown()
    renderAt(categorySalesHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    await screen.findByRole('table', { name: TABLE })

    // Act
    await countOver('2026-11-10', '2026-11-01')

    // Assert
    const last = screen.getByLabelText('集計する期間（まで）')
    expect(last).toHaveFocus()
    expect(last).toHaveAccessibleDescription(
      expect.stringContaining(
        '終わりの日は、始まりの日と同じか、その後にしてください。',
      ),
    )
    expect(rowsOf(TABLE)).toEqual(KINDS_OF_TODAY)
  })

  it('should never show the kinds of service as an earlier screen read them', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt(categorySalesHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    expect(
      await screen.findByText('この期間のメニューの売上はありません'),
    ).toBeVisible()
    await user.click(menuLink('売上の推移'))
    await heading('売上の推移')
    await sellToBreakDown()

    // Act
    await user.click(menuLink('区分別の売上'))

    // Assert
    await screen.findByRole('table', { name: TABLE })
    expect(firstSight()[0]).toMatch(/\/reports\/categories$/)
    expect(firstSight()[1]).not.toContain('メニューの売上はありません')
  })

  it('should tell the owner that the kinds of service of another salon are not theirs to see', async () => {
    // Arrange
    renderAt(categorySalesHrefOf(await salonIdOf(OSAKA)))

    // Act
    await signInAs(OWNER)

    // Assert
    expect(
      await screen.findByText(
        'このサロンの区分別の売上は、見られません。区分別の売上を見られるのは、そのサロンのオーナーとマネージャーと、管理者です。',
      ),
    ).toBeVisible()
  })

  it('should say that a salon removed since it was read has no sales by kind any more', async () => {
    // Arrange
    await sellToBreakDown()
    renderAt(categorySalesHrefOf(await salonIdOf(TOKYO)))
    await signInAs(ADMIN)
    await screen.findByRole('table', { name: TABLE })
    await removeTokyo()

    // Act
    await countOver('2020-01-01', '2020-01-31')

    // Assert
    expect(
      await screen.findByText(
        'このサロンは削除されたため、区分別の売上を見られません。',
      ),
    ).toBeVisible()
  })

  it.each<[string, string, () => Promise<void>, () => Promise<unknown>]>([
    [
      'the sales by kind',
      TOKYO,
      sellToBreakDown,
      () => screen.findByRole('table', { name: TABLE }),
    ],
    [
      'a period without them',
      TOKYO,
      async () => undefined,
      () => screen.findByText('この期間のメニューの売上はありません'),
    ],
    [
      'the kinds of another salon',
      OSAKA,
      async () => undefined,
      () => screen.findByRole('link', { name: '自分のサロンの売上レポートへ' }),
    ],
  ])('should be accessible on %s', async (_case, salon, arrange, shown) => {
    // Arrange
    await arrange()
    renderAt(categorySalesHrefOf(await salonIdOf(salon)))
    await signInAs(OWNER)

    // Act
    await shown()

    // Assert
    expect(await findAccessibilityViolations(document.body)).toEqual([])
  })
})
