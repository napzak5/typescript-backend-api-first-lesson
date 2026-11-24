import { type LocalizedText, text } from '../../languages/localized-text'
import { listed } from '../written'
import {
  amountWithTax,
  BOOKING_ERRORS,
  BOOKING_WORDS,
  failedTo,
  lineNamed,
  UNASSIGNED_TAKES_NOTHING,
  whenOf,
} from './booking-words'

/*
 * What moving a booking says, and adding a line to it, showing one and
 * taking one away: the forms, the lines where a move would put them, what
 * was found out about the members of the staff, why the state of a booking
 * does not allow a change, and what the API refused.
 */

export const bookingMoveMessages = {
  /** The form that moves a booking */
  move: {
    submit: BOOKING_WORDS.move,
    cancel: BOOKING_WORDS.cancel,
    to: text({ en: 'Move to', ja: '移す先' }),
    staff: BOOKING_WORDS.staffMember,
    staffDescription: text({
      en: 'The staff member of the booking. The lines of the current staff member of the booking go to the new one. Lines of other staff members, and lines without one, keep theirs.',
      ja: '予約の担当です。いまの担当が受け持つ明細は、新しい担当に替わります。ほかのスタッフの明細と、担当を決めない明細は、担当がそのままです。',
    }),
    choose: BOOKING_WORDS.choose,
    date: BOOKING_WORDS.date,
    dateDescription: BOOKING_WORDS.dateDescription,
    startTime: BOOKING_WORDS.startTime,
    startTimeDescription: text({
      en: 'When the first line begins. Every line moves by the same time.',
      ja: '最初の明細が始まる時刻です。すべての明細が、同じ時間だけ動きます。',
    }),
    moved: text({
      en: 'The lines after the move',
      ja: '動かしたあとの明細',
    }),
    noMove: text({
      en: 'Enter the staff member, the date of the visit and the start time to see the lines after the move.',
      ja: '担当スタッフ、来店日、開始の時刻を入れると、動かしたあとの明細を出します。',
    }),
    /** A line where the move would put it, by its number and its service */
    movedLine: (number: number, service: string) => {
      const line = lineNamed(number)

      return text({
        en: `${line.en}: ${service}`,
        ja: `${line.ja} ${service}`,
      })
    },
    /** When a moved line is, and who does it */
    movedHours: (hours: LocalizedText, member: LocalizedText) =>
      text({
        en: `${hours.en}, staff: ${member.en}`,
        ja: `${hours.ja} 担当 ${member.ja}`,
      }),
    done: text({
      en: 'Changed the date, time and staff of the booking.',
      ja: '予約の日時と担当を変えました。',
    }),
    taken: text({
      en: 'The date, time and staff could not be changed: the time of a staff member overlaps another booking. Each line was checked, where it would be after the move, for the other bookings it overlaps.',
      ja: '担当の時間が、ほかの予約と重なっているため、日時と担当を変えられませんでした。動かしたあとの明細ごとに、重なるほかの予約を確かめました。',
    }),
    forbidden: BOOKING_ERRORS.forbidden,
    failed: failedTo(
      text({
        en: 'The date, time and staff of the booking could not be changed.',
        ja: '予約の日時と担当を変えられませんでした。',
      }),
    ),
    /** Why a booking is not moved in its state */
    unmovable: (status: LocalizedText, movable: readonly LocalizedText[]) => {
      const statuses = listed(movable)

      return text({
        en: `This booking is in the status “${status.en}”, so its date, time and staff cannot be changed. They can be changed for bookings in these statuses: ${statuses.en}.`,
        ja: `この予約は${status.ja}のため、日時と担当を変えられません。日時と担当を変えられるのは、${statuses.ja}の予約です。`,
      })
    },
  },
  /** The form that adds a line to a booking */
  addition: {
    submit: BOOKING_WORDS.addLine,
    cancel: BOOKING_WORDS.cancel,
    line: text({ en: 'The line to add', ja: '足す明細' }),
    service: BOOKING_WORDS.service,
    choose: BOOKING_WORDS.choose,
    staff: BOOKING_WORDS.staff,
    staffDescription: (noStaff: LocalizedText) =>
      text({
        en: `A line whose staff is “${noStaff.en}” takes nobody’s time.`,
        ja: `「${noStaff.ja}」明細は、誰の時間も占有しません。`,
      }),
    startTime: BOOKING_WORDS.startTime,
    startTimeDescription: (day: LocalizedText) =>
      text({
        en: `A time on the clock of the salon, on the day of the visit (${day.en}).`,
        ja: `来店日（${day.ja}）の、サロンの時計の時刻です。`,
      }),
    notes: BOOKING_WORDS.notes,
    beyondTheDay: text({
      en: 'Every line begins within 24 hours of the start of the earliest line. Check the start time.',
      ja: 'すべての明細は、最も早い明細の開始から 24 時間以内に始まります。開始の時刻を確かめてください。',
    }),
    done: text({ en: 'Added the line.', ja: '施術明細を追加しました。' }),
    taken: text({
      en: 'The line could not be added: the time of its staff member overlaps another booking. The other bookings that overlap the line were checked.',
      ja: '担当の時間が、ほかの予約と重なっているため、施術明細を足せませんでした。足す明細に重なる、ほかの予約を確かめました。',
    }),
    tooMuch: text({
      en: 'The line could not be added: the total would go beyond what one booking can hold.',
      ja: '金額の合計が、1 件の予約で扱える上限を超えるため、施術明細を足せませんでした。',
    }),
    forbidden: BOOKING_ERRORS.forbidden,
    failed: failedTo(
      text({
        en: 'The line could not be added.',
        ja: '施術明細を足せませんでした。',
      }),
    ),
    /** Why no line is added to a booking in its state */
    closed: (status: LocalizedText, unfinished: readonly LocalizedText[]) => {
      const statuses = listed(unfinished)

      return text({
        en: `This booking is in the status “${status.en}”, so no line can be added to it. The lines can be changed for bookings in these statuses: ${statuses.en}.`,
        ja: `この予約は${status.ja}のため、施術明細を足せません。施術明細を変えられるのは、${statuses.ja}の予約です。`,
      })
    },
    /** The booking has the most lines a booking has */
    full: (most: LocalizedText) =>
      text({
        en: `A booking has up to ${most.en} lines. No more can be added to this one.`,
        ja: `施術明細は ${most.ja} 件までです。この予約には、もう足せません。`,
      }),
  },
  /** A line of a booking, as the salon keeps it */
  line: {
    title: text({ en: 'Line details', ja: '施術明細の内容' }),
    line: text({ en: 'Service line', ja: '施術明細' }),
    service: BOOKING_WORDS.service,
    staff: BOOKING_WORDS.staff,
    hours: BOOKING_WORDS.hours,
    duration: text({ en: 'Duration', ja: '所要時間' }),
    price: text({ en: 'Price', ja: '料金' }),
    discount: BOOKING_WORDS.discount,
    finalPrice: text({ en: 'Amount to pay', ja: '支払う額' }),
    finalPriceOf: (amount: LocalizedText, taxIncluded: boolean) =>
      amountWithTax(amount, null, taxIncluded),
    completed: BOOKING_WORDS.completed,
    done: BOOKING_WORDS.done,
    /** A line that was done, with when it was recorded */
    doneAt: (moment: LocalizedText) =>
      text({ en: `Done (${moment.en})`, ja: `済み（${moment.ja}）` }),
    notDone: BOOKING_WORDS.notDone,
    notes: BOOKING_WORDS.notes,
    /** When a line is: its day and its hours */
    when: whenOf,
    loading: text({ en: 'Loading the line', ja: '施術明細を読み込んでいます' }),
    notFound: text({
      en: 'The line was not found. It was taken off the booking, or the address is wrong.',
      ja: '施術明細が見つかりません。予約から外されたか、アドレスが正しくありません。',
    }),
  },
  /** Taking a line away from its booking */
  removal: {
    unchangeable: text({
      en: 'The staff member and the start time of a line cannot be changed. Add a new line, then take this one off.',
      ja: '明細の担当や開始の時刻は、変えられません。新しい明細を足してから、この明細を外してください。',
    }),
    open: text({ en: 'Take this line off', ja: 'この明細を外す' }),
    title: text({ en: 'Take the line off?', ja: '施術明細を外しますか？' }),
    /** The line, as the dialog names it: 「カット（10:00〜11:00）」 */
    lineOf: (service: string, hours: LocalizedText) =>
      text({ en: `${service} (${hours.en})`, ja: `${service}（${hours.ja}）` }),
    description: (line: LocalizedText) =>
      text({
        en: `${line.en} will be taken off the booking. The time and the amounts of the booking are worked out again from the lines that stay. A line taken off cannot be put back.`,
        ja: `${line.ja}を、予約から外します。予約の時刻と金額は、残る明細から算出し直します。外した明細は、元に戻せません。`,
      }),
    back: BOOKING_WORDS.back,
    submit: text({ en: 'Take off', ja: '外す' }),
    done: text({ en: 'Took the line off.', ja: '施術明細を外しました。' }),
    unsummed: text({
      en: 'The line could not be taken off: without it, the amounts of the booking cannot be worked out again.',
      ja: '施術明細を外せませんでした。この明細を外すと、予約の金額を算出し直せません。',
    }),
    forbidden: BOOKING_ERRORS.forbidden,
    failed: failedTo(
      text({
        en: 'The line could not be taken off.',
        ja: '施術明細を外せませんでした。',
      }),
    ),
    /** Why a line stays on a booking in its state */
    closed: (status: LocalizedText) =>
      text({
        en: `This booking is in the status “${status.en}”, so no line can be taken off it.`,
        ja: `この予約は${status.ja}のため、施術明細を外せません。`,
      }),
    last: text({
      en: 'The last line of a booking cannot be taken off. Cancel the booking of a visit that will not take place.',
      ja: '予約に残る最後の明細は、外せません。行われない来店は、予約をキャンセルしてください。',
    }),
  },
  /** What was found out about the member of the staff of a line */
  check: {
    unassigned: UNASSIGNED_TAKES_NOTHING,
    unread: text({
      en: 'Could not check',
      ja: '空きを確かめられませんでした',
    }),
    taken: text({ en: 'Overlapping bookings', ja: '重なる予約があります' }),
    free: text({ en: 'Free', ja: '空いています' }),
    /** The member is free, as far as the bookings they take at once go */
    withinCapacity: text({
      en: ' (bookings overlap, within the number taken at once)',
      ja: '（同時に受けられる数の内で、重なる予約があります）',
    }),
    /** A booking that overlaps, by its number and its hours */
    overlapping: (bookingNumber: string, hours: LocalizedText) =>
      text({
        en: `${bookingNumber} ${hours.en}`,
        ja: `${bookingNumber} ${hours.ja}`,
      }),
  },
}
