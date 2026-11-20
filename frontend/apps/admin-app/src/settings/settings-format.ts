import type {
  ModelsBusinessHours,
  ModelsDayOfWeekType,
  ModelsOpeningHours,
  ModelsTimeSlot,
} from '@beauty-salon-frontend/api-client'
import { dayAt, dayNameOf } from '../salon-time'
import { timeNameOf, WEEKDAYS } from '../shifts/shift-week'
import { NOT_RECORDED } from '../staff/staff-format'

/*
 * The words of the settings of a salon: its hours, by the day of the week
 * and by the date, its tax and its place on the map. The times are those
 * of the clock of the salon, as the API keeps them.
 */

/** What is said of a day the salon is not open on */
const CLOSED = '休業'

/** Hours from one time to another: 「10:00〜20:00」, several of them with 「、」. */
const slotsNameOf = (slots: readonly ModelsTimeSlot[]): string =>
  slots
    .map(
      ({ startTime, endTime }) =>
        `${timeNameOf(startTime)}〜${timeNameOf(endTime)}`,
    )
    .join('、')

/** A day without its day of the week: 「2026年4月1日」. */
const dateNameOf = (day: string): string =>
  new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${day}T00:00:00Z`))

/** The hours of a day of the week, as a row of the regular week. */
export type WeekdayHours = {
  weekday: ModelsDayOfWeekType
  /** 「10:00〜20:00」, with the break and the period it is kept in; 「休業」 for a day the salon is closed */
  hours: string
}

/**
 * The regular week of a salon, from Monday, as the API reads it: a day
 * with no entry, one that is closed and one without hours are days the
 * salon is closed. The break follows the hours, and a period the hours
 * are kept in follows both, its days at the clock of the salon.
 */
export const weekHoursOf = (
  businessHours: readonly ModelsBusinessHours[] | null,
  timezone: string,
): WeekdayHours[] =>
  WEEKDAYS.map((weekday) => {
    const entry = businessHours?.find(({ dayOfWeek }) => dayOfWeek === weekday)
    if (
      entry === undefined ||
      entry.isClosed ||
      entry.operatingSlots.length === 0
    ) {
      return { weekday, hours: CLOSED }
    }
    const rest =
      entry.breakSlots === null || entry.breakSlots.length === 0
        ? ''
        : `（休憩 ${slotsNameOf(entry.breakSlots)}）`
    const period =
      entry.effectivePeriod === null
        ? ''
        : `・${dateNameOf(dayAt(new Date(entry.effectivePeriod.startDate), timezone))}から${dateNameOf(dayAt(new Date(entry.effectivePeriod.endDate), timezone))}まで`

    return {
      weekday,
      hours: `${slotsNameOf(entry.operatingSlots)}${rest}${period}`,
    }
  })

/** A date of the calendar of a salon, as a row of its table. */
export type CalendarDay = {
  date: string
  /** 「2026年11月23日（月）」 */
  day: string
  /** 「10:00〜17:00」, or 「終日休業」 */
  hours: string
  /** The name of the holiday or of the day off, 「祝日・休業日」 for one without a name, and 「いいえ」 for an ordinary day */
  holiday: string
  notes: string
}

/**
 * The dates of the calendar of a salon from today on, in their order: a
 * date of the calendar sets the hours of that day in place of those of
 * its day of the week.
 */
export const calendarFrom = (
  openingHours: readonly ModelsOpeningHours[],
  today: string,
): CalendarDay[] =>
  openingHours
    .filter(({ date }) => date >= today)
    .toSorted((one, other) => one.date.localeCompare(other.date))
    .map((entry) => ({
      date: entry.date,
      day: dayNameOf(entry.date),
      hours:
        entry.openTime === null || entry.closeTime === null
          ? '終日休業'
          : `${timeNameOf(entry.openTime)}〜${timeNameOf(entry.closeTime)}`,
      holiday: entry.isHoliday
        ? (entry.holidayName ?? '祝日・休業日')
        : 'いいえ',
      notes: entry.notes ?? NOT_RECORDED,
    }))

/** A rate of tax: 「10%」, 「8.5%」. */
export const taxRateNameOf = (taxRate: number): string => `${taxRate}%`

/** The place of a salon on the map: 「緯度 35.658、経度 139.7016」, or nothing recorded. */
export const coordinatesNameOf = (
  latitude: number | null,
  longitude: number | null,
): string =>
  latitude === null && longitude === null
    ? NOT_RECORDED
    : `緯度 ${latitude ?? NOT_RECORDED}、経度 ${longitude ?? NOT_RECORDED}`

/** How the customers rate the salon: 「4.0（3 件のレビュー）」, or that there is no rating yet. */
export const ratingNameOf = (
  rating: number | null,
  reviewCount: number,
): string =>
  rating === null
    ? 'まだありません'
    : `${rating.toFixed(1)}（${reviewCount} 件のレビュー）`
