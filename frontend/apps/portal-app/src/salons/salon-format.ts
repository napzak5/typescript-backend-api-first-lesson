import type {
  ModelsBusinessHours,
  ModelsDayOfWeekType,
  ModelsOpeningHours,
  ModelsReviewResponse,
  ModelsSalonResponse,
  ModelsStaffLevelType,
  ModelsTimeSlot,
} from '@beauty-salon-frontend/api-client'

/** The days of a week in the order a timetable lists them, with their names. */
const WEEKDAYS: readonly { day: ModelsDayOfWeekType; name: string }[] = [
  { day: 'monday', name: '月曜日' },
  { day: 'tuesday', name: '火曜日' },
  { day: 'wednesday', name: '水曜日' },
  { day: 'thursday', name: '木曜日' },
  { day: 'friday', name: '金曜日' },
  { day: 'saturday', name: '土曜日' },
  { day: 'sunday', name: '日曜日' },
]

const LEVEL_NAMES: Record<ModelsStaffLevelType, string> = {
  junior: 'ジュニア',
  stylist: 'スタイリスト',
  senior: 'シニア',
  expert: 'エキスパート',
  director: 'ディレクター',
}

export const levelNameOf = (level: ModelsStaffLevelType): string =>
  LEVEL_NAMES[level]

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

/** An amount in the currency of the salon: 「￥5,500」. */
export const amountOf = (amount: number, currency: string): string =>
  new Intl.NumberFormat('ja-JP', { style: 'currency', currency }).format(amount)

/** How long a service takes: 「45 分」, 「1 時間」, 「1 時間 30 分」. */
export const durationOf = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60

  return [
    ...(hours === 0 ? [] : [`${hours} 時間`]),
    ...(rest === 0 && hours > 0 ? [] : [`${rest} 分`]),
  ].join(' ')
}

/** A time of day without its seconds: the API writes `10:00` and `10:00:00`. */
const timeOf = (time: string): string => time.slice(0, 5)

/** From when until when: 「10:00〜20:00」; several slots are 「10:00〜13:00、15:00〜20:00」. */
const slotsOf = (slots: readonly ModelsTimeSlot[]): string =>
  slots
    .map((slot) => `${timeOf(slot.startTime)}〜${timeOf(slot.endTime)}`)
    .join('、')

/**
 * A calendar date (`2026-11-23`) with its day of the week: 「11月23日（月）」.
 * The date is a day of the calendar of the salon and is no moment in time,
 * so it is formatted as it stands, in no time zone but the one it is
 * written in.
 */
export const calendarDateOf = (date: string): string =>
  new Intl.DateTimeFormat('ja-JP', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    timeZone: 'UTC',
  })
    .format(new Date(`${date}T00:00:00Z`))
    .replace(/\((.)\)/, '（$1）')

/** The calendar date it is at the salon at a moment: `2026-11-23`. */
export const dateAt = (moment: Date, timezone: string): string =>
  new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  }).format(moment)

/** The day a moment falls on at the salon: 「2026年11月19日」. */
export const dayOf = (moment: string, timezone: string): string =>
  new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'long',
    timeZone: timezone,
  }).format(new Date(moment))

/** The day a moment falls on at the salon, with its day of the week: 「2026年11月20日金曜日」. */
export const weekdayOf = (moment: string, timezone: string): string =>
  new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'full',
    timeZone: timezone,
  }).format(new Date(moment))

/** The time of day it is at the salon at a moment: 「10:00」. */
export const timeOfDayAt = (moment: string, timezone: string): string =>
  new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: timezone,
  }).format(new Date(moment))

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
export const hoursOf = (day: ModelsOpeningHours): string =>
  day.isHoliday || day.openTime === null || day.closeTime === null
    ? '休業'
    : `${timeOf(day.openTime)}〜${timeOf(day.closeTime)}`

/** A day of the week, as the timetable of a salon says it. */
export type WeeklyDay = {
  day: ModelsDayOfWeekType
  name: string
  /**
   * 「定休日」, or from when until when, with the breaks and, when the hours
   * hold for a time only, that time:
   * 「10:00〜20:00（休憩 13:00〜14:00）（2026年12月1日〜2026年12月31日）」
   */
  hours: string
}

const weeklyTextOf = (entry: ModelsBusinessHours, timezone: string): string =>
  [
    slotsOf(entry.operatingSlots),
    ...(entry.breakSlots === null || entry.breakSlots.length === 0
      ? []
      : [`（休憩 ${slotsOf(entry.breakSlots)}）`]),
    ...(entry.effectivePeriod === null
      ? []
      : [
          `（${dayOf(entry.effectivePeriod.startDate, timezone)}〜${dayOf(entry.effectivePeriod.endDate, timezone)}）`,
        ]),
  ].join('')

/**
 * The timetable of a week, Monday first. A day has the hours of its first
 * entry, which is the entry the API reads when it works out the free slots;
 * a day without an entry is closed, as it is for the API.
 */
export const weeklyHoursOf = (
  businessHours: readonly ModelsBusinessHours[],
  timezone: string,
): WeeklyDay[] =>
  WEEKDAYS.map(({ day, name }) => {
    const entry = businessHours.find((hours) => hours.dayOfWeek === day)

    return {
      day,
      name,
      hours:
        entry === undefined ||
        entry.isClosed ||
        entry.operatingSlots.length === 0
          ? '定休日'
          : weeklyTextOf(entry, timezone),
    }
  })

/**
 * The address of a website, when it is one a link may lead to. Anything
 * else the salon wrote there is shown as text and is no link.
 */
export const webAddressOf = (url: string): string | null =>
  /^https?:\/\//i.test(url) ? url : null

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

/**
 * The ratings of a review besides the overall one, with the word for each,
 * in the order a page shows them and a form asks for them.
 */
export const DETAIL_RATINGS: readonly { name: DetailRating; label: string }[] =
  [
    { name: 'serviceRating', label: 'サービス' },
    { name: 'staffRating', label: 'スタッフ' },
    { name: 'atmosphereRating', label: '雰囲気' },
    { name: 'cleanlinessRating', label: '清潔さ' },
    { name: 'valueRating', label: '価格' },
  ]

/**
 * The ratings of a review besides the overall one, those the customer gave:
 * 「サービス 5・スタッフ 4」. `null` when there is none.
 */
export const detailRatingsOf = (
  review: Pick<ModelsReviewResponse, DetailRating>,
): string | null => {
  const given = DETAIL_RATINGS.flatMap(({ name, label }) => {
    const rating = review[name]

    return rating === null ? [] : [`${label} ${rating}`]
  })

  return given.length === 0 ? null : given.join('・')
}
