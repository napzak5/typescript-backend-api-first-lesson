import { languageStore } from '@beauty-salon-frontend/io'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import {
  dayFromToday,
  giveBack,
  salonIdOf,
  signInAs,
  takeAway,
  testApi,
} from '@beauty-salon-frontend/testing/api'
import {
  firstSight,
  heading,
  readAgain,
  rowsOf,
} from '@beauty-salon-frontend/testing/screens'
import {
  MANAGER,
  OPERATOR,
  OSAKA,
  OWNER,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { removeTokyo, sellToBreakDown } from '../../__tests__/arrangements'
import {
  countOver,
  menuLink,
  periodInEnglish,
  renderAt,
  TITLE,
} from '../../__tests__/screens'
import { reportsHrefOf, staffSalesHrefOf } from '../../navigation'

/*
 * The seed data has no sales: a test enters those of today, and a product
 * sold forty days before, in the salon in Tokyo (`sellToBreakDown`).
 */

const TABLE = 'スタッフ別の売上'

/** The first and the last day the form holds */
const daysOfTheForm = (): string[] => [
  screen.getByLabelText<HTMLInputElement>('集計する期間（から）').value,
  screen.getByLabelText<HTMLInputElement>('集計する期間（まで）').value,
]

/** Every member of the staff who had a line of the sales of today */
const STAFF_OF_TODAY = [
  ['1 位', 'Hiroshi Tanaka', '￥22,000', '2 件', '￥11,000'],
  ['2 位', 'Mika Suzuki', '￥12,200', '2 件', '￥4,450'],
  ['3 位', 'Yui Watanabe', '￥4,400', '1 件', '￥4,400'],
]

describe('the sales of the staff, against the API', () => {
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
    'should lead %s from the five who sold the most to every member of the staff, over the days of the report',
    async (_case, email) => {
      // Arrange
      const user = userEvent.setup()
      await sellToBreakDown()
      const days = [await dayFromToday(-1), await dayFromToday(0)]
      renderAt(
        `${reportsHrefOf(await salonIdOf(TOKYO))}?from=${days[0]}&to=${days[1]}`,
      )
      await signInAs(email)
      await screen.findByRole('table', { name: 'スタッフ別の売上の上位 5 人' })
      expect(daysOfTheForm()).toEqual(days)

      // Act
      await user.click(
        screen.getByRole('link', { name: 'すべてのスタッフの売上へ' }),
      )

      // Assert
      expect(await heading('スタッフ別の売上')).toHaveFocus()
      await screen.findByRole('table', { name: TABLE })
      expect(rowsOf(TABLE)).toEqual(STAFF_OF_TODAY)
      expect(
        screen.getByRole('rowheader', { name: 'Yui Watanabe' }),
      ).toBeInTheDocument()
      expect(daysOfTheForm()).toEqual(days)
      expect(menuLink('スタッフ別の売上')).toHaveAttribute(
        'aria-current',
        'page',
      )
      expect(document.title).toBe(`スタッフ別の売上 | ${TITLE}`)
    },
  )

  it('should count the products a member of the staff sold, and none of their services, on the days chosen', async () => {
    // Arrange
    await sellToBreakDown()
    const before = await dayFromToday(-40)
    renderAt(staffSalesHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    await screen.findByRole('table', { name: TABLE })

    // Act
    await countOver(before, before)

    // Assert
    await screen.findByRole('rowheader', { name: 'Yui Watanabe' })
    expect(rowsOf(TABLE)).toEqual([
      ['1 位', 'Yui Watanabe', '￥3,300', '0 件', '￥0'],
    ])
  })

  it('should count a member of the staff who left since, under the name they have now', async () => {
    // Arrange
    await sellToBreakDown()
    await testApi().query(
      `update staff set "isActive" = false, "deletedAt" = now(), "displayName" = 'Yui W.'
       where "staffCode" = 'STF004'`,
    )

    // Act
    renderAt(staffSalesHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)

    // Assert
    await screen.findByRole('table', { name: TABLE })
    expect(rowsOf(TABLE).at(-1)).toEqual([
      '3 位',
      'Yui W.',
      '￥4,400',
      '1 件',
      '￥4,400',
    ])
  })

  it('should say when nobody of the staff sold anything on the days chosen', async () => {
    // Arrange
    await sellToBreakDown()
    renderAt(staffSalesHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    await screen.findByRole('table', { name: TABLE })

    // Act
    await countOver('2020-01-01', '2020-01-31')

    // Assert
    expect(
      await screen.findByText('この期間に、スタッフが担当した売上はありません'),
    ).toBeVisible()
    expect(screen.queryByRole('table', { name: TABLE })).toBeNull()
  })

  it('should say that the sales of the staff could not be read, and show them once they are read again', async () => {
    // Arrange
    const user = userEvent.setup()
    await sellToBreakDown()
    await takeAway('sales')
    renderAt(staffSalesHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'スタッフ別の売上を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(screen.queryByRole('table', { name: TABLE })).toBeNull()
    await giveBack('sales')

    // Act
    await readAgain(user)

    // Assert
    await screen.findByRole('table', { name: TABLE })
    expect(rowsOf(TABLE)).toEqual(STAFF_OF_TODAY)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('should say what is wrong with the days, give it the focus and count nothing anew', async () => {
    // Arrange
    await sellToBreakDown()
    renderAt(staffSalesHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    await screen.findByRole('table', { name: TABLE })

    // Act
    await countOver('2024-01-01', '2025-01-01')

    // Assert
    const last = screen.getByLabelText('集計する期間（まで）')
    expect(last).toHaveFocus()
    expect(last).toHaveAccessibleDescription(
      expect.stringContaining('期間は 366 日までにしてください。'),
    )
    expect(rowsOf(TABLE)).toEqual(STAFF_OF_TODAY)
  })

  it('should count the staff anew when the same days are counted again, since sales are entered meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt(staffSalesHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    expect(
      await screen.findByText('この期間に、スタッフが担当した売上はありません'),
    ).toBeVisible()
    await sellToBreakDown()

    // Act
    await user.click(screen.getByRole('button', { name: '集計する' }))

    // Assert
    await screen.findByRole('table', { name: TABLE })
    expect(rowsOf(TABLE)).toEqual(STAFF_OF_TODAY)
  })

  it('should never show the staff as an earlier screen read them', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt(staffSalesHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    expect(
      await screen.findByText('この期間に、スタッフが担当した売上はありません'),
    ).toBeVisible()
    await user.click(menuLink('1 日の売上'))
    await heading('1 日の売上')
    await sellToBreakDown()

    // Act
    await user.click(menuLink('スタッフ別の売上'))

    // Assert
    await screen.findByRole('table', { name: TABLE })
    expect(firstSight()[0]).toMatch(/\/reports\/staff$/)
    expect(firstSight()[1]).not.toContain('スタッフが担当した売上はありません')
  })

  it('should tell the owner that the staff of another salon are not theirs to see', async () => {
    // Arrange
    renderAt(staffSalesHrefOf(await salonIdOf(OSAKA)))

    // Act
    await signInAs(OWNER)

    // Assert
    expect(
      await screen.findByText(
        'このサロンのスタッフ別の売上は、見られません。スタッフ別の売上を見られるのは、そのサロンのオーナーとマネージャーと、管理者です。',
      ),
    ).toBeVisible()
    expect(screen.queryByLabelText('集計する期間（から）')).toBeNull()
  })

  it('should say that a salon removed since it was read has no sales of its staff any more', async () => {
    // Arrange
    await sellToBreakDown()
    renderAt(staffSalesHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OPERATOR)
    await screen.findByRole('table', { name: TABLE })
    await removeTokyo()

    // Act
    await countOver('2020-01-01', '2020-01-31')

    // Assert
    expect(
      await screen.findByText(
        'このサロンは削除されたため、スタッフ別の売上を見られません。',
      ),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'トップへ戻る' })).toBeVisible()
  })

  it.each<[string, string, () => Promise<void>, () => Promise<unknown>]>([
    [
      'the sales of the staff',
      TOKYO,
      sellToBreakDown,
      () => screen.findByRole('table', { name: TABLE }),
    ],
    [
      'a period without them',
      TOKYO,
      async () => undefined,
      () => screen.findByText('この期間に、スタッフが担当した売上はありません'),
    ],
    [
      'the staff of another salon',
      OSAKA,
      async () => undefined,
      () => screen.findByRole('link', { name: '自分のサロンの売上レポートへ' }),
    ],
  ])('should be accessible on %s', async (_case, salon, arrange, shown) => {
    // Arrange
    await arrange()
    renderAt(staffSalesHrefOf(await salonIdOf(salon)))
    await signInAs(OWNER)

    // Act
    await shown()

    // Assert
    expect(await findAccessibilityViolations(document.body)).toEqual([])
  })
})

describe('the sales of the staff on a page in English, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  it('should rank every member of the staff in English, over the month up to today', async () => {
    // Arrange
    await sellToBreakDown()
    const today = await dayFromToday(0)
    const first = `${today.slice(0, 8)}01`

    // Act
    renderAt(staffSalesHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER, 'en')

    // Assert
    expect(await heading('Sales by staff')).toHaveFocus()
    expect(document.title).toBe(`Sales by staff | ${TITLE}`)
    expect(
      screen.getByText(`Sales by staff for ${periodInEnglish(first, today)}`),
    ).toBeVisible()
    await screen.findByRole('table', { name: 'Sales by staff' })
    expect(rowsOf('Sales by staff')).toEqual([
      ['1st', 'Hiroshi Tanaka', '¥22,000', '2', '¥11,000'],
      ['2nd', 'Mika Suzuki', '¥12,200', '2', '¥4,450'],
      ['3rd', 'Yui Watanabe', '¥4,400', '1', '¥4,400'],
    ])
  })

  it('should say in English when nobody of the staff sold anything on the days chosen', async () => {
    // Arrange
    await sellToBreakDown()
    renderAt(staffSalesHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER, 'en')
    await screen.findByRole('table', { name: 'Sales by staff' })

    // Act
    await countOver('2020-01-01', '2020-01-31', 'en')

    // Assert
    expect(
      await screen.findByText('No sales handled by the staff in this period'),
    ).toBeVisible()
  })

  it('should say in English that the sales by staff could not be read, and show them once they are read again', async () => {
    // Arrange
    const user = userEvent.setup()
    await sellToBreakDown()
    await takeAway('sales')
    renderAt(staffSalesHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER, 'en')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the sales by staff. Check your connection and try again.',
    )
    await giveBack('sales')

    // Act
    await readAgain(user, { name: 'Load again' })

    // Assert
    expect(
      await screen.findByRole('table', { name: 'Sales by staff' }),
    ).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('should tell the owner in English that the staff of another salon are not theirs to see', async () => {
    // Arrange
    renderAt(staffSalesHrefOf(await salonIdOf(OSAKA)))

    // Act
    await signInAs(OWNER, 'en')

    // Assert
    expect(
      await screen.findByText(
        'You cannot see the sales by staff of this salon. Only the owner and the managers of the salon and the administrators can.',
      ),
    ).toBeVisible()
  })
})
