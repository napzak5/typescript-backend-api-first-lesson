import type {
  ModelsBusinessHours,
  ModelsDateRange,
  ModelsDayOfWeekType,
  ModelsOpeningHours,
} from '@beauty-salon-frontend/api-client'
import { dayAt, dayNameOf } from '@beauty-salon-frontend/salon-screens'
import { NOT_RECORDED } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { adminSettingsMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { WEEKDAYS } from '../../shifts/utils/shift-week'

const { hours: HOURS, record } = adminSettingsMessages

/*
 * The words of the settings of a salon: its hours, by the day of the week
 * and by the date, its tax and its place on the map. The times are those
 * of the clock of the salon, as the API keeps them.
 */

/** The days hours are kept in, at the clock of the salon: 「2026年4月1日から2026年9月30日まで」. */
export const periodNameOf = (
  { startDate, endDate }: ModelsDateRange,
  timezone: string,
): LocalizedText =>
  HOURS.periodOf(
    formats.dayOf(dayAt(new Date(startDate), timezone)),
    formats.dayOf(dayAt(new Date(endDate), timezone)),
  )

/** The hours of a day of the week, as a row of the regular week. */
export type WeekdayHours = {
  weekday: ModelsDayOfWeekType
  /** 「10:00〜20:00」, with the break and the period it is kept in; 「休業」 for a day the salon is closed */
  hours: LocalizedText
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
      return { weekday, hours: HOURS.closed }
    }

    return {
      weekday,
      hours: HOURS.ofTheWeek(
        formats.timeSlotsOf(entry.operatingSlots),
        entry.breakSlots === null || entry.breakSlots.length === 0
          ? null
          : formats.timeSlotsOf(entry.breakSlots),
        entry.effectivePeriod === null
          ? null
          : periodNameOf(entry.effectivePeriod, timezone),
      ),
    }
  })

/** A date of the calendar of a salon, as a row of its table. */
export type CalendarDay = {
  date: string
  /** 「2026年11月23日（月）」 */
  day: LocalizedText
  /** 「10:00〜17:00」, or 「終日休業」 */
  hours: LocalizedText
  /** The name of the holiday or of the day off as it was written, 「祝日・休業日」 for one without a name, and 「いいえ」 for an ordinary day */
  holiday: LocalizedText
  /** `null` when nothing was noted of the day */
  notes: string | null
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
          ? HOURS.closedAllDay
          : formats.timeSlotsOf([
              { startTime: entry.openTime, endTime: entry.closeTime },
            ]),
      holiday: entry.isHoliday
        ? entry.holidayName === null
          ? HOURS.unnamedHoliday
          : HOURS.holidayNamed(entry.holidayName)
        : HOURS.noHoliday,
      notes: entry.notes,
    }))

/** A rate of tax: 「10%」, 「8.5%」. */
export const taxRateNameOf = (taxRate: number): LocalizedText =>
  formats.percentOf(taxRate)

/** A coordinate as it is written, with the decimals the API keeps, or that it is not recorded. */
const coordinateNameOf = (coordinate: number | null): LocalizedText =>
  coordinate === null ? NOT_RECORDED : formats.numberOf(coordinate, { most: 8 })

/** The place of a salon on the map: 「緯度 35.658、経度 139.7016」, or `null` when it is not recorded. */
export const coordinatesNameOf = (
  latitude: number | null,
  longitude: number | null,
): LocalizedText | null =>
  latitude === null && longitude === null
    ? null
    : record.placeOf(coordinateNameOf(latitude), coordinateNameOf(longitude))

/** How the customers rate the salon: 「4.0（3 件のレビュー）」, or that there is no rating yet. */
export const ratingNameOf = (
  rating: number | null,
  reviewCount: number,
): LocalizedText =>
  rating === null
    ? record.notRated
    : record.ratingOf(
        formats.numberOf(rating, { most: 1, least: 1 }),
        reviewCount,
      )
