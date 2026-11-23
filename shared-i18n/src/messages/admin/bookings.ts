import { type LocalizedText, text } from '../../languages/localized-text'

/**
 * What the admin application says around a screen of a booking, which the
 * checkout of a booking opens in as well: the booking read whenever the
 * screen opens, named below its heading, and the staff and the services
 * of the salon that the screen names; and what a time a form takes on the
 * clock of the salon cannot be. The number of a booking stands as it was
 * written.
 */
export const adminBookingMessages = {
  /** What a screen could not read, as a sentence names it */
  names: {
    booking: text({ en: 'the booking', ja: '予約' }),
    staffAndServices: text({
      en: 'the staff and services',
      ja: 'スタッフとメニュー',
    }),
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
}
