import type {
  ModelsBusinessHours,
  ModelsDayOfWeekType,
  ModelsOpeningHours,
  ModelsReviewResponse,
  ModelsSalonResponse,
} from '@beauty-salon-frontend/api-client'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { portalSalonMessages } from '@beauty-salon-shared/i18n/messages/portal'
import { termMessages } from '@beauty-salon-shared/i18n/messages/ui'

const { hours: words, reviews } = portalSalonMessages

/** The days of a week in the order a timetable lists them. */
const WEEKDAYS: readonly ModelsDayOfWeekType[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

const DAY_NAMES: Record<ModelsDayOfWeekType, LocalizedText> =
  termMessages.dayOfWeek

/** Where a salon is, in one line: the parts of the address as the salon wrote them. */
export const addressOf = (
  salon: Pick<
    ModelsSalonResponse,
    'prefecture' | 'city' | 'address' | 'building'
  >,
): string =>
  [salon.prefecture, salon.city, salon.address, salon.building]
    .filter((part) => part !== null)
    .join(' ')

/** The calendar date it is at the salon at a moment: `2026-11-23`. */
export const dateAt = (moment: Date, timezone: string): string =>
  new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  }).format(moment)

/** The day a moment falls on at the salon: 「2026年11月19日」. */
export const dayOf = (moment: string, timezone: string): LocalizedText =>
  formats.dayOf(dateAt(new Date(moment), timezone))

/** The day a moment falls on at the salon, with its day of the week: 「2026年11月20日金曜日」. */
export const weekdayOf = (moment: string, timezone: string): LocalizedText =>
  formats.fullDayOf(dateAt(new Date(moment), timezone))

/**
 * The days of the calendar of a salon from a date on, the nearest first. A
 * day that has passed is of no use to somebody who plans a visit.
 */
export const comingDays = (
  days: readonly ModelsOpeningHours[],
  today: string,
  most: number,
): ModelsOpeningHours[] =>
  days
    .filter((day) => day.date >= today)
    .toSorted((a, b) => a.date.localeCompare(b.date))
    .slice(0, most)

/** What a day of the calendar says about the hours: closed, or from when until when. */
export const hoursOf = (day: ModelsOpeningHours): LocalizedText =>
  day.isHoliday || day.openTime === null || day.closeTime === null
    ? words.closed
    : formats.timeSlotsOf([{ startTime: day.openTime, endTime: day.closeTime }])

/** A day of the week, as the timetable of a salon says it. */
export type WeeklyDay = {
  day: ModelsDayOfWeekType
  name: LocalizedText
  /**
   * 「定休日」, or from when until when, with the breaks and, when the hours
   * hold for a time only, that time:
   * 「10:00〜20:00（休憩 13:00〜14:00）（2026年12月1日〜2026年12月31日）」
   */
  hours: LocalizedText
}

const weeklyTextOf = (
  entry: ModelsBusinessHours,
  timezone: string,
): LocalizedText =>
  words.ofTheWeek(
    formats.timeSlotsOf(entry.operatingSlots),
    entry.breakSlots === null || entry.breakSlots.length === 0
      ? null
      : formats.timeSlotsOf(entry.breakSlots),
    entry.effectivePeriod === null
      ? null
      : {
          from: dayOf(entry.effectivePeriod.startDate, timezone),
          to: dayOf(entry.effectivePeriod.endDate, timezone),
        },
  )

/**
 * The timetable of a week, Monday first. A day has the hours of its first
 * entry, which is the entry the API reads when it works out the free slots;
 * a day without an entry is closed, as it is for the API.
 */
export const weeklyHoursOf = (
  businessHours: readonly ModelsBusinessHours[],
  timezone: string,
): WeeklyDay[] =>
  WEEKDAYS.map((day) => {
    const entry = businessHours.find((hours) => hours.dayOfWeek === day)

    return {
      day,
      name: DAY_NAMES[day],
      hours:
        entry === undefined ||
        entry.isClosed ||
        entry.operatingSlots.length === 0
          ? words.regularHoliday
          : weeklyTextOf(entry, timezone),
    }
  })

/**
 * Which of the reviews of a salon one is, as a sentence and the name of a
 * button say it: by its title and the day it was posted,
 * 「「丁寧なカットでした」（2026年11月10日 投稿）」, or by the day alone.
 */
export const postedOf = (
  { title, createdAt }: Pick<ModelsReviewResponse, 'title' | 'createdAt'>,
  timezone: string,
): LocalizedText => reviews.posted(title, dayOf(createdAt, timezone))

/** The address that calls a telephone number: its digits, and a leading plus sign. */
export const telephoneHrefOf = (phoneNumber: string): string =>
  `tel:${phoneNumber.replace(/[^\d+]/g, '')}`

/** A rating of one side of a visit: a property of a review. */
export type DetailRating =
  | 'serviceRating'
  | 'staffRating'
  | 'atmosphereRating'
  | 'cleanlinessRating'
  | 'valueRating'

const SIDE_NAMES: Record<DetailRating, LocalizedText> = reviews.sides

/** The sides of a visit, in the order a page shows them and a form asks for them */
const SIDES: readonly DetailRating[] = [
  'serviceRating',
  'staffRating',
  'atmosphereRating',
  'cleanlinessRating',
  'valueRating',
]

/**
 * The ratings of a review besides the overall one, with the word for each,
 * in the order a page shows them and a form asks for them.
 */
export const DETAIL_RATINGS: readonly {
  name: DetailRating
  label: LocalizedText
}[] = SIDES.map((name) => ({ name, label: SIDE_NAMES[name] }))

/**
 * The ratings of a review besides the overall one, those the customer gave:
 * 「サービス 5・スタッフ 4」. `null` when there is none.
 */
export const detailRatingsOf = (
  review: Pick<ModelsReviewResponse, DetailRating>,
): LocalizedText | null => {
  const given = DETAIL_RATINGS.flatMap(({ name, label }) => {
    const rating = review[name]

    return rating === null ? [] : [{ label, rating }]
  })

  return given.length === 0 ? null : reviews.detailRatings(given)
}
