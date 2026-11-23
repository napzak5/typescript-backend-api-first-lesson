import type {
  ModelsSalesTrendPeriodType,
  ModelsSalesTrendsResponse,
} from '@beauty-salon-frontend/api-client'
import {
  amountOf,
  dayNameOf,
  type Period,
  periodQueryOf,
} from '@beauty-salon-frontend/salon-screens'
import { inJapanese, textOf } from '@beauty-salon-frontend/ui'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { match } from 'ts-pattern'

/*
 * How the trends of the sales are asked for and said: the parts a period
 * is cut into, kept in the address beside its days, and the names of the
 * parts the API labels.
 */

/** What a period is cut into: days, weeks from a Monday, or months */
export type TrendUnit = ModelsSalesTrendPeriodType

/** The parts the form offers, the way the API cuts a period */
export const TREND_UNITS: readonly { value: TrendUnit; label: string }[] = [
  { value: 'daily', label: '日' },
  { value: 'weekly', label: '週' },
  { value: 'monthly', label: '月' },
]

/** What is said of the choice of the parts: where a week starts */
export const TREND_UNIT_HELP = '週は、月曜日から日曜日までです。'

/** What is said of the parts: the first and the last hold only the days of the period */
export const TREND_PARTS = '最初と最後の週や月は、期間の中の日だけを数えます。'

/** A text of the address or of a control as the parts it names; months when it names none */
export const trendUnitOf = (text: string | null): TrendUnit =>
  match(text)
    .returnType<TrendUnit>()
    .with('daily', 'weekly', 'monthly', (unit) => unit)
    .otherwise(() => 'monthly')

/** The parts in the query of an address; months, unless it names others the API cuts into. */
export const trendUnitIn = (query: URLSearchParams): TrendUnit =>
  trendUnitOf(query.get('period'))

/** The parts that were chosen in the form. */
export const readTrendUnit = (values: FormData): TrendUnit =>
  trendUnitOf(textOf(values, 'period'))

/**
 * The twelve months up to today: from the first day of the month eleven
 * months before, so that the first month is a whole one.
 */
export const twelveMonthsUntil = (today: string): Period => {
  const months =
    Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)) - 1 - 11
  const year = String(Math.floor(months / 12)).padStart(4, '0')
  const month = String((months % 12) + 1).padStart(2, '0')

  return { from: `${year}-${month}-01`, to: today }
}

/** The query that keeps a trend in an address: its days and its parts. */
export const trendsQueryOf = (
  period: Period,
  unit: TrendUnit,
): URLSearchParams => {
  const query = periodQueryOf(period)
  query.set('period', unit)

  return query
}

/** A month the API labels (`2026-11`) in words: 「2026年11月」. */
const monthNameOf = (label: string): string =>
  inJapanese(formats.monthOf(label))

/**
 * A part as the table names it: a day 「2026年11月21日（土）」, the week
 * from a Monday 「2026年11月16日（月）からの週」, a month 「2026年11月」.
 */
export const partNameOf = (label: string, unit: TrendUnit): string =>
  match(unit)
    .with('daily', () => dayNameOf(label))
    .with('weekly', () => `${dayNameOf(label)}からの週`)
    .with('monthly', () => monthNameOf(label))
    .exhaustive()

/** A part as the axis of the chart names it, in less room: 「2026/11/16」, 「2026年11月」. */
export const shortPartNameOf = (label: string, unit: TrendUnit): string =>
  match(unit)
    .with(
      'daily',
      'weekly',
      () =>
        `${Number(label.slice(0, 4))}/${Number(label.slice(5, 7))}/${Number(label.slice(8, 10))}`,
    )
    .with('monthly', () => monthNameOf(label))
    .exhaustive()

/** One part of a trend and its sums */
export type TrendPart = {
  /** The label the API gives it: its day, the Monday of its week, or its month */
  label: string
  sales: number
  transactions: number
  average: number
}

/**
 * The parts of a trend, each with its sums. The API answers with arrays of
 * one length, the same place the same part.
 */
export const partsOf = ({
  labels,
  sales,
  transactions,
  average,
}: ModelsSalesTrendsResponse): TrendPart[] =>
  labels.map((label, index) => ({
    label,
    sales: sales[index] ?? 0,
    transactions: transactions[index] ?? 0,
    average: average[index] ?? 0,
  }))

/**
 * The top of the scale of a chart of amounts: the least of 1, 2 or 5 times
 * a power of ten that is no less than the largest amount, so that it and
 * its half are round. 1 when there is nothing to draw.
 */
export const scaleTopOf = (largest: number): number => {
  if (largest <= 0) {
    return 1
  }
  const power = 10 ** Math.floor(Math.log10(largest))
  const times = [1, 2, 5, 10].find((step) => step * power >= largest) ?? 10

  return times * power
}

/** From 10,000 on, an amount is written short on an axis */
const SHORT_FROM = 10_000

/**
 * An amount on the axis of a chart: in full below 10,000 (「￥2,500」),
 * short from it on (「￥2.5万」), where the yen are counted in 万.
 */
export const axisAmountOf = (amount: number, currency: string): string =>
  amount >= SHORT_FROM
    ? inJapanese(formats.shortAmountOf(amount, currency))
    : amountOf(amount, currency)
