import { dayNameOf } from '@beauty-salon-frontend/salon-screens'
import { findAccessibilityViolations } from '@beauty-salon-frontend/testing'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ADMIN,
  arrangeSale,
  dayFromToday,
  MANAGER,
  OSAKA,
  OWNER,
  paySale,
  removeTokyo,
  salonIdOf,
  signInAs,
  TOKYO,
  voidSale,
} from '../__tests__/arrangements'
import {
  firstSight,
  heading,
  menuLink,
  renderAt,
  TITLE,
  termsOf,
} from '../__tests__/screens'
import { dailyHrefOf } from '../navigation'

/*
 * The seed data has no sales: a test enters those of today and of
 * yesterday in the salon in Tokyo.
 */

/**
 * The sales of today, a cut paid in cash and a colour paid by card and in
 * part given back, a sale voided today that is not counted, and a cut of
 * yesterday.
 */
const sellTwoDays = async (): Promise<void> => {
  const cut = await arrangeSale({
    saleNumber: 'S-DAY-1',
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
    saleNumber: 'S-DAY-2',
    day: 0,
    staffCode: 'STF002',
    lines: [
      {
        itemType: 'service',
        itemName: 'Full Color',
        unitPrice: 8000,
        tax: 800,
        staffCode: 'STF002',
      },
    ],
  })
  await paySale(colour, 'credit_card', 8800, 800)
  const mistake = await arrangeSale({
    saleNumber: 'S-DAY-3',
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
  await arrangeSale({
    saleNumber: 'S-DAY-4',
    day: -1,
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
}

/** The sums of today */
const SUMS_OF_TODAY: [string, string][] = [
  ['売上', '￥14,300'],
  ['会計の件数', '2 件'],
  ['返金', '￥800'],
  ['純売上', '￥13,500'],
]

/** The sums of yesterday */
const SUMS_OF_YESTERDAY: [string, string][] = [
  ['売上', '￥4,400'],
  ['会計の件数', '1 件'],
  ['返金', '￥0'],
  ['純売上', '￥4,400'],
]

/** The sums of a day without a sale */
const NOTHING: [string, string][] = [
  ['売上', '￥0'],
  ['会計の件数', '0 件'],
  ['返金', '￥0'],
  ['純売上', '￥0'],
]

/** The card of the sales of a day */
const salesOf = (day: string): string => `${dayNameOf(day)}の売上`

/** Shows the sales of a day, as the owner types it. */
const showDay = async (day: string): Promise<void> => {
  const user = userEvent.setup()
  const field = screen.getByLabelText('日付')
  await user.clear(field)
  if (day !== '') {
    await user.type(field, day)
  }
  await user.click(screen.getByRole('button', { name: '表示する' }))
}

describe('the sales of one day, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_APP_TITLE', TITLE)
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it.each([
    ['the owner', OWNER],
    ['a manager', MANAGER],
  ])(
    'should lead %s from the report to the sales of today at the salon',
    async (_case, email) => {
      // Arrange
      const user = userEvent.setup()
      await sellTwoDays()
      const today = await dayFromToday(0)
      renderAt('/')
      await signInAs(email)
      await heading('売上レポート')

      // Act
      await user.click(menuLink('1 日の売上'))

      // Assert
      expect(await heading('1 日の売上')).toHaveFocus()
      expect(screen.getByLabelText('日付')).toHaveValue(today)
      expect(await termsOf(salesOf(today))).toEqual(SUMS_OF_TODAY)
      expect(screen.getByRole('link', { name: '前の日' })).toBeVisible()
      // The sales of tomorrow are not entered yet
      expect(screen.queryByRole('link', { name: '次の日' })).toBeNull()
      expect(menuLink('1 日の売上')).toHaveAttribute('aria-current', 'page')
      expect(document.title).toBe(`1 日の売上 | ${TITLE}`)
    },
  )

  it('should go to the day before and back to the day after', async () => {
    // Arrange
    const user = userEvent.setup()
    await sellTwoDays()
    const today = await dayFromToday(0)
    const yesterday = await dayFromToday(-1)
    renderAt(dailyHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    await termsOf(salesOf(today))

    // Act
    await user.click(screen.getByRole('link', { name: '前の日' }))

    // Assert
    expect(await termsOf(salesOf(yesterday))).toEqual(SUMS_OF_YESTERDAY)
    expect(screen.getByLabelText('日付')).toHaveValue(yesterday)

    // Act
    await user.click(screen.getByRole('link', { name: '次の日' }))

    // Assert
    expect(await termsOf(salesOf(today))).toEqual(SUMS_OF_TODAY)
    expect(screen.getByLabelText('日付')).toHaveValue(today)
  })

  it('should show the day filled in, and the zeros of a day without a sale', async () => {
    // Arrange
    await sellTwoDays()
    renderAt(dailyHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    await termsOf(salesOf(await dayFromToday(0)))

    // Act
    await showDay('2020-01-01')

    // Assert
    expect(await termsOf(salesOf('2020-01-01'))).toEqual(NOTHING)
    expect(screen.getByRole('link', { name: '次の日' })).toBeVisible()
  })

  it('should say that a day is needed, give the field the focus and show the day it showed', async () => {
    // Arrange
    await sellTwoDays()
    const today = await dayFromToday(0)
    renderAt(dailyHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    await termsOf(salesOf(today))

    // Act
    await showDay('')

    // Assert
    const field = screen.getByLabelText('日付')
    expect(field).toHaveFocus()
    expect(field).toHaveAccessibleDescription(
      expect.stringContaining('日付を入力してください。'),
    )
    expect(await termsOf(salesOf(today))).toEqual(SUMS_OF_TODAY)
  })

  it('should say nothing more of what was wrong once another day is shown', async () => {
    // Arrange
    const user = userEvent.setup()
    await sellTwoDays()
    const yesterday = await dayFromToday(-1)
    renderAt(dailyHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    await termsOf(salesOf(await dayFromToday(0)))
    await showDay('')

    // Act
    await user.click(screen.getByRole('link', { name: '前の日' }))

    // Assert
    expect(await termsOf(salesOf(yesterday))).toEqual(SUMS_OF_YESTERDAY)
    const field = screen.getByLabelText('日付')
    expect(field).toHaveValue(yesterday)
    expect(field).not.toHaveAccessibleDescription(
      expect.stringContaining('日付を入力してください。'),
    )
    expect(field).not.toHaveAttribute('aria-invalid')
  })

  it.each<
    [string, () => Promise<string>, () => Promise<string>, [string, string][]]
  >([
    [
      'the day of the address',
      () => dayFromToday(-1),
      () => dayFromToday(-1),
      SUMS_OF_YESTERDAY,
    ],
    [
      'today, when the address names no day of the calendar',
      async () => '2026-02-30',
      () => dayFromToday(0),
      SUMS_OF_TODAY,
    ],
  ])(
    'should show the sales of %s',
    async (_case, inTheAddress, shown, sums) => {
      // Arrange
      await sellTwoDays()

      // Act
      renderAt(
        `${dailyHrefOf(await salonIdOf(TOKYO))}?date=${await inTheAddress()}`,
      )
      await signInAs(OWNER)

      // Assert
      const day = await shown()
      expect(await termsOf(salesOf(day))).toEqual(sums)
      expect(screen.getByLabelText('日付')).toHaveValue(day)
    },
  )

  it('should count the day shown anew when it is shown again, since sales are entered meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    const today = await dayFromToday(0)
    renderAt(dailyHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    expect(await termsOf(salesOf(today))).toEqual(NOTHING)
    await sellTwoDays()

    // Act
    await user.click(screen.getByRole('button', { name: '表示する' }))

    // Assert
    await screen.findByText('￥14,300')
    expect(await termsOf(salesOf(today))).toEqual(SUMS_OF_TODAY)
  })

  it('should never show the sales as an earlier screen read them', async () => {
    // Arrange
    const user = userEvent.setup()
    const today = await dayFromToday(0)
    renderAt(dailyHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    expect(await termsOf(salesOf(today))).toEqual(NOTHING)
    await user.click(menuLink('売上の推移'))
    await heading('売上の推移')
    await sellTwoDays()

    // Act
    await user.click(menuLink('1 日の売上'))

    // Assert
    await screen.findByText('￥14,300')
    expect(firstSight()[0]).toMatch(/\/reports\/daily$/)
    expect(firstSight()[1]).not.toContain('0 件')
  })

  it('should tell the owner that the sales of another salon are not theirs to see', async () => {
    // Arrange
    renderAt(dailyHrefOf(await salonIdOf(OSAKA)))

    // Act
    await signInAs(OWNER)

    // Assert
    expect(
      await screen.findByText(
        'このサロンの売上は、見られません。売上を見られるのは、そのサロンのオーナーとマネージャーと、管理者です。',
      ),
    ).toBeVisible()
    expect(screen.queryByLabelText('日付')).toBeNull()
  })

  it('should say that a salon removed since it was read has no sales to show any more', async () => {
    // Arrange
    await sellTwoDays()
    renderAt(dailyHrefOf(await salonIdOf(TOKYO)))
    await signInAs(ADMIN)
    await termsOf(salesOf(await dayFromToday(0)))
    await removeTokyo()

    // Act
    await showDay('2020-01-01')

    // Assert
    expect(
      await screen.findByText(
        'このサロンは削除されたため、売上を見られません。',
      ),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'トップへ戻る' })).toBeVisible()
  })

  it.each<[string, string, () => Promise<void>, () => Promise<unknown>]>([
    [
      'the sales of a day',
      TOKYO,
      sellTwoDays,
      () => screen.findByText('￥14,300'),
    ],
    [
      'the sales of another salon',
      OSAKA,
      async () => undefined,
      () => screen.findByRole('link', { name: '自分のサロンの売上レポートへ' }),
    ],
  ])('should be accessible on %s', async (_case, salon, arrange, shown) => {
    // Arrange
    await arrange()
    renderAt(dailyHrefOf(await salonIdOf(salon)))
    await signInAs(OWNER)

    // Act
    await shown()

    // Assert
    expect(await findAccessibilityViolations(document.body)).toEqual([])
  })
})
