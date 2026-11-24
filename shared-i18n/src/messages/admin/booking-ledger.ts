import { type LocalizedText, text } from '../../languages/localized-text'
import { listed } from '../written'
import { BOOKING_WORDS } from './booking-words'

/*
 * What the bookings of a salon on a day say: the list, what narrows it,
 * and the way to the other days.
 */

/** The bookings of a day, as a heading names them: 「2026年11月20日（金）の予約」 */
const bookingsOn = (day: LocalizedText) =>
  text({ en: `Bookings on ${day.en}`, ja: `${day.ja}の予約` })

export const bookingLedgerMessages = {
  bookingsOn,
  /** No booking of the day is shown */
  noneOn: (day: LocalizedText) =>
    text({ en: `No bookings on ${day.en}`, ja: `${day.ja}の予約はありません` }),
  noneMatchingOn: (day: LocalizedText) =>
    text({
      en: `No bookings on ${day.en} match the conditions`,
      ja: `${day.ja}の予約のうち、条件に合うものはありません`,
    }),
  /** The switch of the day */
  day: text({ en: 'Day of the bookings', ja: '予約の日' }),
  loading: text({ en: 'Loading the bookings', ja: '予約を読み込んでいます' }),
  filter: {
    label: text({ en: 'Narrow the bookings', ja: '予約を絞り込む' }),
    date: text({ en: 'Date', ja: '日付' }),
    status: BOOKING_WORDS.status,
    staff: BOOKING_WORDS.staff,
    all: text({ en: 'All', ja: 'すべて' }),
  },
  table: {
    hours: BOOKING_WORDS.hours,
    customer: BOOKING_WORDS.customer,
    staff: BOOKING_WORDS.staff,
    services: BOOKING_WORDS.service,
    /** The services of a booking, one after the other: 「カット、カラー」 */
    servicesOf: (names: readonly string[]) => listed(names),
    status: BOOKING_WORDS.status,
    bookingNumber: BOOKING_WORDS.bookingNumber,
    empty: text({ en: 'No bookings', ja: '予約はありません' }),
  },
}
