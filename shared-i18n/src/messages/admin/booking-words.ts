import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'
import { uiMessages } from '../ui/components'
import { followed, listed } from '../written'

/*
 * What the catalogues of the bookings share: the words of what a booking
 * and its lines record, the lines by their numbers, when a booking is,
 * what a form of a booking says is missing, and what an account that may
 * not change a booking is told. The numbers of the bookings, the names of
 * the customers, the staff and the services, the requests and the notes
 * stand as they were written. Each part of the bookings is a file of its
 * own, and `adminBookingMessages` (`bookings.ts`) collects them under one
 * name.
 */

/** What follows a sentence that says an attempt came to nothing */
const TRY_AGAIN = text({
  en: 'Check your connection and try again.',
  ja: '通信の状態を確かめて、もう一度お試しください。',
})

/** What an attempt that came to nothing says: what was not done, then what to do */
export const failedTo = (undone: LocalizedText): LocalizedText =>
  followed(undone, TRY_AGAIN)

/** A line of a booking by its number, counted from 1: 「明細 2」 */
export const lineNamed = (number: number): LocalizedText =>
  text({ en: `Line ${numberOf(number).en}`, ja: `明細 ${numberOf(number).ja}` })

/** The lines of a booking by their numbers, counted from 1, as a sentence lists them: 「明細 1、3」 */
export const linesNamed = (numbers: readonly number[]): LocalizedText => {
  const list = listed(numbers.map((number) => numberOf(number)))

  return text({
    en: `${numbers.length === 1 ? 'Line' : 'Lines'} ${list.en}`,
    ja: `明細 ${list.ja}`,
  })
}

/** When a booking is, as a dialog names it: its day and its hours, 「2026年11月20日（金） 10:00〜11:00」 */
export const whenOf = (day: LocalizedText, hours: LocalizedText) =>
  text({ en: `${day.en}, ${hours.en}`, ja: `${day.ja} ${hours.ja}` })

/** A line that nobody does takes nobody's time */
export const UNASSIGNED_TAKES_NOTHING = text({
  en: 'A line without a staff member takes nobody’s time.',
  ja: '担当を決めない明細は、誰の時間も占有しません。',
})

/** What a booking's amount is, and whether its tax is in it: 「¥5,000（割引 ¥500）（税込）」 */
export const amountWithTax = (
  amount: LocalizedText,
  discount: LocalizedText | null,
  taxIncluded: boolean,
): LocalizedText =>
  text({
    en: `${amount.en}${discount === null ? '' : ` (${discount.en} off)`} (${taxIncluded ? 'tax included' : 'before tax'})`,
    ja: `${amount.ja}${discount === null ? '' : `（割引 ${discount.ja}）`}${taxIncluded ? '（税込）' : '（税別）'}`,
  })

/** The words of the bookings that more than one of their parts says */
export const BOOKING_WORDS = {
  booking: text({ en: 'Booking', ja: '予約' }),
  bookingNumber: text({ en: 'Booking number', ja: '予約番号' }),
  date: text({ en: 'Date of visit', ja: '来店日' }),
  dateDescription: text({
    en: 'A date on the clock of the salon.',
    ja: 'サロンの時計の日付です。',
  }),
  hours: text({ en: 'Time', ja: '時刻' }),
  customer: text({ en: 'Customer', ja: 'お客様' }),
  /** Who does a booking or a line, as a column and a term name them */
  staff: text({ en: 'Staff', ja: '担当' }),
  /** The member of the staff of a booking, as a control names them */
  staffMember: text({ en: 'Staff member', ja: '担当スタッフ' }),
  service: text({ en: 'Service', ja: 'メニュー' }),
  startTime: text({ en: 'Start time', ja: '開始の時刻' }),
  notes: text({ en: 'Notes', ja: 'メモ' }),
  status: text({ en: 'Status', ja: '状態' }),
  /** The lines of a booking, as a part and a table name them */
  lines: text({ en: 'Service lines', ja: '施術明細' }),
  /** Whether a line was done */
  completed: text({ en: 'Done', ja: '完了' }),
  done: text({ en: 'Done', ja: '済み' }),
  notDone: text({ en: 'Not yet', ja: '未' }),
  discount: text({ en: 'Discount', ja: '割引' }),
  /** How a booking reached the salon */
  source: text({ en: 'How it was booked', ja: '受付の経路' }),
  deposit: text({ en: 'Deposit', ja: '予約金' }),
  customerRequest: text({ en: 'Customer’s requests', ja: 'お客様の要望' }),
  internalNotes: text({ en: 'Notes for the salon', ja: 'サロン内のメモ' }),
  choose: text({ en: 'Choose', ja: '選んでください' }),
  cancel: text({ en: 'Cancel', ja: 'やめる' }),
  back: uiMessages.back,
  /** The way to change the time and the member of a booking, and the screen of it */
  move: text({
    en: 'Change the date, time and staff',
    ja: '日時と担当を変える',
  }),
  /** The way to add a line to a booking, and the screen of it */
  addLine: text({ en: 'Add a line', ja: '施術明細を追加する' }),
  /** The way to change what the salon wrote down on a booking, and the screen of it */
  changeNotes: text({
    en: 'Edit the requests and notes',
    ja: '要望とメモを変える',
  }),
  /** The way to put a booking in, and the screen of it */
  entry: text({ en: 'Make a booking', ja: '予約を入れる' }),
  chooseCustomerAgain: text({
    en: 'Choose another customer',
    ja: 'お客様を選び直す',
  }),
}

/** What the forms of a booking say is wrong with their values */
export const BOOKING_ERRORS = {
  staff: text({
    en: 'Choose the staff member.',
    ja: '担当スタッフを選んでください。',
  }),
  date: text({
    en: 'Enter the date of the visit.',
    ja: '来店日を入力してください。',
  }),
  service: text({ en: 'Choose a service.', ja: 'メニューを選んでください。' }),
  startTime: text({
    en: 'Enter the start time.',
    ja: '開始の時刻を入力してください。',
  }),
  deposit: text({
    en: 'Enter the deposit as a whole number of yen, 0 or more.',
    ja: '予約金は、0 以上の円の整数で入力してください。',
  }),
  /** A service the API does not take for a line any more */
  serviceGone: text({
    en: 'This service cannot be chosen any more. Choose again.',
    ja: 'このメニューは、もう選べません。選び直してください。',
  }),
  /** A member of the staff the API does not take for a booking any more */
  staffGone: text({
    en: 'This staff member cannot be chosen any more. Choose again.',
    ja: 'このスタッフは、もう選べません。選び直してください。',
  }),
  /** The account may not change the booking */
  forbidden: text({
    en: 'This account cannot change this booking.',
    ja: 'このアカウントでは、この予約を変えられません。',
  }),
}
