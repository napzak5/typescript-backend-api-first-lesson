import { type LocalizedText, text } from '../../languages/localized-text'
import { bookingDetailsMessages } from './booking-details'
import { bookingEntryMessages } from './booking-entry'
import { bookingLedgerMessages } from './booking-ledger'
import { bookingMoveMessages } from './booking-moves'
import {
  amountWithTax,
  BOOKING_WORDS,
  lineNamed,
  linesNamed,
  whenOf,
} from './booking-words'

/*
 * What the screens of the bookings say in the admin application: the
 * bookings of a day, a booking and what can be done to its state, a
 * booking put in for a customer, its move, its lines and what the salon
 * wrote down on it; the frame around a screen of a booking, which the
 * checkout of a booking opens in as well; and what a time a form takes on
 * the clock of the salon cannot be. The numbers of the bookings, the names
 * of the customers, the staff and the services, the requests and the notes
 * stand as they were written.
 *
 * The other parts of the bookings are files of their own beside this one,
 * collected here under the same name: the bookings of a day, the page of a
 * booking, the entry of one, and its move and its lines.
 */

export const adminBookingMessages = {
  titles: {
    ledger: text({ en: 'Booking ledger', ja: '予約台帳' }),
    booking: text({ en: 'Booking details', ja: '予約の内容' }),
    entry: BOOKING_WORDS.entry,
    line: bookingMoveMessages.line.title,
    lineEntry: BOOKING_WORDS.addLine,
    move: BOOKING_WORDS.move,
    notes: BOOKING_WORDS.changeNotes,
  },
  /** What a screen could not read, as a sentence names it */
  names: {
    booking: text({ en: 'the booking', ja: '予約' }),
    bookings: text({ en: 'the bookings', ja: '予約' }),
    details: text({ en: 'the booking details', ja: '予約の内容' }),
    staffAndServices: text({
      en: 'the staff and services',
      ja: 'スタッフとメニュー',
    }),
    customersOfBookings: text({
      en: 'the customers of the bookings',
      ja: '予約のお客様',
    }),
    customerAndServices: text({
      en: 'the customer and the services',
      ja: 'お客様とメニュー',
    }),
    line: text({ en: 'the line', ja: '施術明細' }),
  },
  frame: {
    loading: text({ en: 'Loading the booking', ja: '予約を読み込んでいます' }),
    /** The booking below the heading, by its number, its day and its hours */
    bookingOf: (
      bookingNumber: string,
      day: LocalizedText,
      hours: LocalizedText,
    ) =>
      text({
        en: `Booking ${bookingNumber} (${day.en}, ${hours.en})`,
        ja: `予約番号 ${bookingNumber}（${day.ja} ${hours.ja}）`,
      }),
    notFound: text({ en: 'Booking not found', ja: '予約が見つかりません' }),
    notFoundDescription: text({
      en: 'Check that the address is right. A removed booking cannot be shown.',
      ja: 'アドレスが正しいか、お確かめください。削除された予約は、表示できません。',
    }),
    toToday: text({ en: 'Go to today’s bookings', ja: '今日の予約へ' }),
    toBooking: text({ en: 'Back to the booking', ja: '予約の内容へ' }),
    loadingStaffAndServices: text({
      en: 'Loading the staff and services',
      ja: 'スタッフとメニューを読み込んでいます',
    }),
  },
  /** A time the clock of the salon skips on that day: it is put forward then */
  notOnTheClock: text({
    en: 'The clock of the salon skips this time on this day (daylight saving time begins). Enter another time.',
    ja: 'サロンの時計で、この日にない時刻です（夏時間の始まり）。別の時刻を入力してください。',
  }),
  words: BOOKING_WORDS,
  whenOf,
  lineNamed,
  linesNamed,
  amountWithTax,
  ledger: bookingLedgerMessages,
  details: bookingDetailsMessages,
  entry: bookingEntryMessages,
  moves: bookingMoveMessages,
}
