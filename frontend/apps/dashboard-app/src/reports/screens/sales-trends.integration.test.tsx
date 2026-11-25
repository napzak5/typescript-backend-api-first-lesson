import { languageStore } from '@beauty-salon-frontend/io'
import { dayNameOf } from '@beauty-salon-frontend/salon-screens'
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
  OPERATOR,
  OSAKA,
  OWNER,
  TOKYO,
} from '@beauty-salon-frontend/testing/seed'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as z from 'zod'
import {
  arrangeSale,
  paySale,
  removeTokyo,
  voidSale,
} from '../../__tests__/arrangements'
import {
  countOver,
  dayInEnglish,
  menuLink,
  periodInEnglish,
  renderAt,
  TITLE,
} from '../../__tests__/screens'
import { trendsHrefOf } from '../../navigation'

/*
 * The seed data has no sales: a test enters those of today and of a day
 * forty days before in the salon in Tokyo, a month before at least. Both
 * are in the twelve months a trend starts with.
 */

const TABLE = '区切りごとの売上、会計の件数、客単価'

const daySchema = z.tuple([z.object({ day: z.iso.date() })])

/** A day computed by the database in Tokyo, from an expression of `today` */
const dayOf = async (expression: string): Promise<string> =>
  daySchema.parse(
    await testApi().query(
      `with tokyo as (select (now() at time zone 'Asia/Tokyo')::date as today)
       select to_char(${expression}, 'YYYY-MM-DD') as day from tokyo`,
    ),
  )[0].day

/** A month in words, as the table names it: 「2026年11月」 */
const monthNameOf = (day: string): string =>
  `${Number(day.slice(0, 4))}年${Number(day.slice(5, 7))}月`

/**
 * The sales of today, a cut and a colour paid in cash and by card, a sale
 * voided today that no trend counts, and a cut forty days before.
 */
const sellOverTime = async (): Promise<void> => {
  const cut = await arrangeSale({
    saleNumber: 'S-TREND-1',
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
    saleNumber: 'S-TREND-2',
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
  await paySale(colour, 'credit_card', 8800)
  const mistake = await arrangeSale({
    saleNumber: 'S-TREND-3',
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
    saleNumber: 'S-TREND-4',
    day: -40,
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

/** The sums of the sales of today */
const TODAY = ['￥14,300', '2 件', '￥7,150']

/** The sums of a part without a sale */
const NONE = ['￥0', '0 件', '￥0']

/** The part chosen in the form */
const chosenUnit = (): string | null =>
  within(screen.getByRole('radiogroup', { name: '区切り' }))
    .getAllByRole('radio')
    .find((radio) => radio instanceof HTMLInputElement && radio.checked)
    ?.getAttribute('value') ?? null

describe('the trends of the sales, against the API', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('should lead the owner from the report to the trend of the twelve months up to today, month by month', async () => {
    // Arrange
    const user = userEvent.setup()
    await sellOverTime()
    const today = await dayFromToday(0)
    const before = await dayFromToday(-40)
    const first = await dayOf(
      "date_trunc('month', today) - interval '11 months'",
    )
    renderAt('/')
    await signInAs(OWNER)
    await heading('売上レポート')

    // Act
    await user.click(menuLink('売上の推移'))

    // Assert
    expect(await heading('売上の推移')).toHaveFocus()
    expect(screen.getByLabelText('集計する期間（から）')).toHaveValue(first)
    expect(screen.getByLabelText('集計する期間（まで）')).toHaveValue(today)
    expect(chosenUnit()).toBe('monthly')
    expect(
      screen.getByRole('radiogroup', { name: '区切り' }),
    ).toHaveAccessibleDescription('週は、月曜日から日曜日までです。')
    await screen.findByRole('table', { name: TABLE })
    const rows = rowsOf(TABLE)
    expect(rows).toHaveLength(12)
    expect(rows[0]).toEqual([monthNameOf(first), ...NONE])
    expect(rows.at(-1)).toEqual([monthNameOf(today), ...TODAY])
    expect(rows.find(([name]) => name === monthNameOf(before))).toEqual([
      monthNameOf(before),
      '￥4,400',
      '1 件',
      '￥4,400',
    ])
    expect(
      rows.filter(([, sales]) => sales !== '￥0').map(([name]) => name),
    ).toEqual([monthNameOf(before), monthNameOf(today)])
    expect(menuLink('売上の推移')).toHaveAttribute('aria-current', 'page')
    expect(menuLink('売上レポート')).not.toHaveAttribute('aria-current')
    expect(document.title).toBe(`売上の推移 | ${TITLE}`)
  })

  it('should cut the days chosen into the parts chosen', async () => {
    // Arrange
    const user = userEvent.setup()
    await sellOverTime()
    const today = await dayFromToday(0)
    const weekAgo = await dayFromToday(-6)
    renderAt(trendsHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    await screen.findByRole('table', { name: TABLE })

    // Act
    await user.click(screen.getByRole('radio', { name: '日' }))
    await countOver(weekAgo, today)

    // Assert
    expect(
      await screen.findByText(
        `${dayNameOf(weekAgo).ja}〜${dayNameOf(today).ja}の売上の推移`,
      ),
    ).toBeVisible()
    await screen.findByRole('rowheader', {
      name: dayNameOf(weekAgo).ja,
    })
    const rows = rowsOf(TABLE)
    expect(rows).toHaveLength(7)
    expect(rows[0]).toEqual([dayNameOf(weekAgo).ja, ...NONE])
    expect(rows.at(-1)).toEqual([dayNameOf(today).ja, ...TODAY])
    expect(chosenUnit()).toBe('daily')
  })

  it('should count the days and the parts of the address it was opened at, the first week from its Monday', async () => {
    // Arrange
    await sellOverTime()
    const today = await dayFromToday(0)
    const twoWeeksAgo = await dayFromToday(-13)
    const monday = await dayOf("date_trunc('week', today)")
    const firstMonday = await dayOf("date_trunc('week', today - 13)")

    // Act
    renderAt(
      `${trendsHrefOf(await salonIdOf(TOKYO))}?from=${twoWeeksAgo}&to=${today}&period=weekly`,
    )
    await signInAs(OWNER)

    // Assert
    await screen.findByRole('table', { name: TABLE })
    expect(chosenUnit()).toBe('weekly')
    expect(screen.getByLabelText('集計する期間（から）')).toHaveValue(
      twoWeeksAgo,
    )
    const rows = rowsOf(TABLE)
    expect(rows[0]?.[0]).toBe(`${dayNameOf(firstMonday).ja}からの週`)
    expect(rows.at(-1)).toEqual([`${dayNameOf(monday).ja}からの週`, ...TODAY])
    expect(
      screen.getByText(/最初と最後の週や月は、期間の中の日だけを数えます。/),
    ).toBeVisible()
  })

  it('should cut into months when the address names no parts the API cuts into', async () => {
    // Arrange
    await sellOverTime()

    // Act
    renderAt(`${trendsHrefOf(await salonIdOf(TOKYO))}?period=yearly`)
    await signInAs(OWNER)

    // Assert
    await screen.findByRole('table', { name: TABLE })
    expect(chosenUnit()).toBe('monthly')
    expect(rowsOf(TABLE)).toHaveLength(12)
  })

  it('should say when nothing was sold in the days chosen', async () => {
    // Arrange
    await sellOverTime()
    renderAt(trendsHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    await screen.findByRole('table', { name: TABLE })

    // Act
    await countOver('2020-01-01', '2020-12-31')

    // Assert
    expect(await screen.findByText('この期間の売上はありません')).toBeVisible()
    expect(screen.queryByRole('table', { name: TABLE })).toBeNull()
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
      await sellOverTime()
      renderAt(trendsHrefOf(await salonIdOf(TOKYO)))
      await signInAs(OWNER)
      await screen.findByRole('table', { name: TABLE })
      const counted = rowsOf(TABLE)

      // Act
      await countOver(from, to)

      // Assert
      const last = screen.getByLabelText('集計する期間（まで）')
      expect(last).toHaveFocus()
      expect(last).toHaveAccessibleDescription(expect.stringContaining(error))
      expect(rowsOf(TABLE)).toEqual(counted)
    },
  )

  it('should say that the trend could not be read, and show it once it is read again', async () => {
    // Arrange
    const user = userEvent.setup()
    await sellOverTime()
    await takeAway('sales')
    renderAt(trendsHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '売上の推移を読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(screen.queryByRole('table', { name: TABLE })).toBeNull()
    await giveBack('sales')

    // Act
    await readAgain(user)

    // Assert
    await screen.findByRole('table', { name: TABLE })
    expect(rowsOf(TABLE).at(-1)).toEqual([
      monthNameOf(await dayFromToday(0)),
      ...TODAY,
    ])
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('should say nothing more of what was wrong once the header leads to the twelve months', async () => {
    // Arrange
    const user = userEvent.setup()
    const today = await dayFromToday(0)
    const first = await dayOf(
      "date_trunc('month', today) - interval '11 months'",
    )
    renderAt(
      `${trendsHrefOf(await salonIdOf(TOKYO))}?from=2020-01-01&to=2020-12-31&period=weekly`,
    )
    await signInAs(OWNER)
    await screen.findByText('この期間の売上はありません')
    await countOver('2026-11-10', '2026-11-01')

    // Act
    await user.click(menuLink('売上の推移'))

    // Assert
    await screen.findByText(new RegExp(`${dayNameOf(today).ja}の売上の推移$`))
    const last = screen.getByLabelText('集計する期間（まで）')
    expect(last).toHaveValue(today)
    expect(last).not.toHaveAttribute('aria-invalid')
    expect(screen.getByLabelText('集計する期間（から）')).toHaveValue(first)
    expect(chosenUnit()).toBe('monthly')
  })

  it('should count the parts shown anew when they are counted again, since sales are entered meanwhile', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt(trendsHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    expect(await screen.findByText('この期間の売上はありません')).toBeVisible()
    await sellOverTime()

    // Act
    await user.click(screen.getByRole('button', { name: '集計する' }))

    // Assert
    await screen.findByRole('table', { name: TABLE })
    expect(rowsOf(TABLE).at(-1)?.slice(1)).toEqual(TODAY)
  })

  it('should never show the trend as an earlier screen read it', async () => {
    // Arrange
    const user = userEvent.setup()
    renderAt(trendsHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER)
    expect(await screen.findByText('この期間の売上はありません')).toBeVisible()
    await user.click(menuLink('1 日の売上'))
    await heading('1 日の売上')
    await sellOverTime()

    // Act
    await user.click(menuLink('売上の推移'))

    // Assert
    await screen.findByRole('table', { name: TABLE })
    expect(firstSight()[0]).toMatch(/\/reports\/trends$/)
    expect(firstSight()[1]).not.toContain('この期間の売上はありません')
  })

  it('should tell the owner that the trend of another salon is not theirs to see', async () => {
    // Arrange
    renderAt(trendsHrefOf(await salonIdOf(OSAKA)))

    // Act
    await signInAs(OWNER)

    // Assert
    expect(
      await screen.findByText(
        'このサロンの売上の推移は、見られません。売上の推移を見られるのは、そのサロンのオーナーとマネージャーと、管理者です。',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: '自分のサロンの売上レポートへ' }),
    ).toBeVisible()
    expect(screen.queryByLabelText('集計する期間（から）')).toBeNull()
  })

  it('should say that a salon removed since it was read has no trend any more', async () => {
    // Arrange
    await sellOverTime()
    renderAt(trendsHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OPERATOR)
    await screen.findByRole('table', { name: TABLE })
    await removeTokyo()

    // Act
    await countOver('2020-01-01', '2020-01-31')

    // Assert
    expect(
      await screen.findByText(
        'このサロンは削除されたため、売上の推移を見られません。',
      ),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'トップへ戻る' })).toBeVisible()
  })

  it.each<[string, string, () => Promise<void>, () => Promise<unknown>]>([
    [
      'a trend',
      TOKYO,
      sellOverTime,
      () => screen.findByRole('table', { name: TABLE }),
    ],
    [
      'a period without sales',
      TOKYO,
      async () => undefined,
      () => screen.findByText('この期間の売上はありません'),
    ],
    [
      'the trend of another salon',
      OSAKA,
      async () => undefined,
      () => screen.findByRole('link', { name: '自分のサロンの売上レポートへ' }),
    ],
  ])('should be accessible on %s', async (_case, salon, arrange, shown) => {
    // Arrange
    await arrange()
    renderAt(trendsHrefOf(await salonIdOf(salon)))
    await signInAs(OWNER)

    // Act
    await shown()

    // Assert
    expect(await findAccessibilityViolations(document.body)).toEqual([])
  })
})

describe('the trends of the sales on a page in English, against the API', () => {
  const TABLE_IN_ENGLISH =
    'Sales, checkouts and average per checkout by interval'

  /** A month, as a page in English names it: 「November 2026」 */
  const monthInEnglish = (day: string): string =>
    new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }).format(new Date(`${day.slice(0, 7)}-01T00:00:00Z`))

  beforeEach(() => {
    vi.stubEnv('VITE_MODE', 'production')
    languageStore.choose('en')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    localStorage.clear()
  })

  it('should say the trend of the twelve months up to today in English, month by month', async () => {
    // Arrange
    await sellOverTime()
    const today = await dayFromToday(0)
    const first = await dayOf(
      "date_trunc('month', today) - interval '11 months'",
    )

    // Act
    renderAt(trendsHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER, 'en')

    // Assert
    expect(await heading('Sales trends')).toHaveFocus()
    expect(document.title).toBe(`Sales trends | ${TITLE}`)
    expect(
      screen.getByRole('radiogroup', { name: 'Interval' }),
    ).toHaveAccessibleDescription('A week runs from Monday to Sunday.')
    expect(
      screen.getByText(`Sales trends for ${periodInEnglish(first, today)}`),
    ).toBeVisible()
    await screen.findByRole('table', { name: TABLE_IN_ENGLISH })
    const rows = rowsOf(TABLE_IN_ENGLISH)
    expect(rows[0]).toEqual([monthInEnglish(first), '¥0', '0', '¥0'])
    expect(rows.at(-1)).toEqual([
      monthInEnglish(today),
      '¥14,300',
      '2',
      '¥7,150',
    ])
  })

  it('should cut the days chosen into weeks, each named in English by its Monday', async () => {
    // Arrange
    const user = userEvent.setup()
    await sellOverTime()
    const today = await dayFromToday(0)
    const twoWeeksAgo = await dayFromToday(-13)
    const monday = await dayOf("date_trunc('week', today)")
    const firstMonday = await dayOf("date_trunc('week', today - 13)")
    renderAt(trendsHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER, 'en')
    await screen.findByRole('table', { name: TABLE_IN_ENGLISH })

    // Act
    await user.click(screen.getByRole('radio', { name: 'Week' }))
    await countOver(twoWeeksAgo, today, 'en')

    // Assert
    expect(
      await screen.findByRole('rowheader', {
        name: `Week from ${dayInEnglish(firstMonday)}`,
      }),
    ).toBeVisible()
    expect(rowsOf(TABLE_IN_ENGLISH).at(-1)).toEqual([
      `Week from ${dayInEnglish(monday)}`,
      '¥14,300',
      '2',
      '¥7,150',
    ])
    expect(
      screen.getByText(
        /The first and the last week or month count only the days within the period\.$/,
      ),
    ).toBeVisible()
  })

  it('should say in English that the trend could not be read, and show it once it is read again', async () => {
    // Arrange
    const user = userEvent.setup()
    await sellOverTime()
    await takeAway('sales')
    renderAt(trendsHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OWNER, 'en')
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load the sales trends. Check your connection and try again.',
    )
    await giveBack('sales')

    // Act
    await readAgain(user, { name: 'Load again' })

    // Assert
    expect(
      await screen.findByRole('table', { name: TABLE_IN_ENGLISH }),
    ).toBeVisible()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('should tell the owner in English that the trend of another salon is not theirs to see', async () => {
    // Arrange
    renderAt(trendsHrefOf(await salonIdOf(OSAKA)))

    // Act
    await signInAs(OWNER, 'en')

    // Assert
    expect(
      await screen.findByText(
        'You cannot see the sales trends of this salon. Only the owner and the managers of the salon and the administrators can.',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('link', {
        name: 'Go to the sales report of your salon',
      }),
    ).toBeVisible()
  })

  it('should say in English that a salon removed since it was read has no trend any more', async () => {
    // Arrange
    await sellOverTime()
    renderAt(trendsHrefOf(await salonIdOf(TOKYO)))
    await signInAs(OPERATOR, 'en')
    await screen.findByRole('table', { name: TABLE_IN_ENGLISH })
    await removeTokyo()

    // Act
    await countOver('2020-01-01', '2020-01-31', 'en')

    // Assert
    expect(
      await screen.findByText(
        'This salon was removed, so you cannot see its sales trends.',
      ),
    ).toBeVisible()
  })
})
