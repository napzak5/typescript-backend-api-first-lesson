import { type LocalizedText, text } from '../../languages/localized-text'
import { followed } from '../written'
import {
  BOOKING_ERRORS,
  BOOKING_WORDS,
  failedTo,
  lineNamed,
  linesNamed,
  UNASSIGNED_TAKES_NOTHING,
} from './booking-words'
import { KEYWORD_DESCRIPTION } from './customer-words'

/*
 * What putting a booking into the ledger says: the customer it is for,
 * found by a keyword, the form with its lines and what the salon writes
 * down, whether the members of the lines are free, and what the API
 * refused; and what the change of what the salon wrote down says.
 */

/** A line of a form, by its number counted from 1, and the part of it a control holds */
const ofLine = (number: number, en: string, ja: string): LocalizedText => {
  const line = lineNamed(number)

  return text({
    en: `${en} of ${line.en.toLowerCase()}`,
    ja: `${line.ja} の${ja}`,
  })
}

export const bookingEntryMessages = {
  /** The first step: the customer of the booking */
  customer: {
    search: text({ en: 'Search for customers', ja: 'お客様を探す' }),
    searchDescription: followed(
      KEYWORD_DESCRIPTION,
      text({
        en: 'Finds the customer of the booking in the ledger.',
        ja: '台帳のお客様から、予約を入れる方を探します。',
      }),
    ),
    searching: text({
      en: 'Searching for customers',
      ja: 'お客様を探しています',
    }),
    none: text({
      en: 'No customers match the keyword',
      ja: 'キーワードに合うお客様が見つかりませんでした',
    }),
    noneDescription: text({
      en: 'Change the keyword and search again. Register a customer who is not in the ledger first: a booking can be made from their record.',
      ja: 'キーワードを変えて、もう一度お探しください。台帳にないお客様は、先に台帳に登録してください。登録したお客様の台帳から、予約を入れられます。',
    }),
    /** The customer that was chosen, as the form shows them */
    chosen: BOOKING_WORDS.customer,
    chooseAgain: BOOKING_WORDS.chooseCustomerAgain,
    notFound: text({
      en: 'The customer was not found. They were removed from the ledger, or the address is wrong.',
      ja: 'お客様が見つかりません。台帳から削除されたか、アドレスが正しくありません。',
    }),
  },
  /** The second step: what the form needs is read */
  loading: text({
    en: 'Loading the customer and the services',
    ja: 'お客様とメニューを読み込んでいます',
  }),
  /** The salon has no member of the staff, or no service, to book */
  unbookable: text({
    en: 'No booking can be made',
    ja: '予約を入れられません',
  }),
  unbookableDescription: text({
    en: 'This salon shows no staff or no services. Bookings can be made once staff and services are registered.',
    ja: 'このサロンには、表示しているスタッフかメニューがありません。スタッフとメニューを登録すると、予約を入れられるようになります。',
  }),
  /** The form of a booking */
  form: {
    submit: BOOKING_WORDS.entry,
    cancel: BOOKING_WORDS.cancel,
    staffAndDate: text({ en: 'Staff and date', ja: '担当と日時' }),
    staff: BOOKING_WORDS.staffMember,
    staffDescription: text({
      en: 'The staff member of the booking. This person does the lines whose staff is “Same as the booking”.',
      ja: '予約の担当です。明細の担当が「予約の担当と同じ」なら、この人が施術します。',
    }),
    choose: BOOKING_WORDS.choose,
    date: BOOKING_WORDS.date,
    dateDescription: followed(
      BOOKING_WORDS.dateDescription,
      text({
        en: 'The lines begin at times of this day.',
        ja: '明細は、この日の時刻に始まります。',
      }),
    ),
    check: text({
      en: 'Check whether the staff are free',
      ja: '担当の空きを確かめる',
    }),
    record: text({ en: 'Reception record', ja: '受付の記録' }),
  },
  /** The lines of the form, a row each */
  lines: {
    serviceOf: (number: number) => ofLine(number, 'Service', 'メニュー'),
    staffOf: (number: number) => ofLine(number, 'Staff', '担当'),
    startOf: (number: number) => ofLine(number, 'Start', '開始'),
    notesOf: (number: number) => ofLine(number, 'Notes', 'メモ'),
    removeLine: (number: number) => {
      const line = lineNamed(number)

      return text({
        en: `Remove ${line.en.toLowerCase()}`,
        ja: `${line.ja} を外す`,
      })
    },
    add: text({ en: 'Add a line', ja: '明細を追加する' }),
    /** The form has the most lines a booking has */
    most: (most: LocalizedText) =>
      text({
        en: `Up to ${most.en} lines.`,
        ja: `明細は ${most.ja} までです。`,
      }),
    /** A service a line is for, by name and length; one the salon takes no bookings for says so */
    serviceChoice: (name: string, duration: LocalizedText, active: boolean) =>
      text({
        en: `${name} (${duration.en})${active ? '' : ' (not taking bookings)'}`,
        ja: `${name}（${duration.ja}）${active ? '' : '（受付停止中）'}`,
      }),
    sameStaff: text({ en: 'Same as the booking', ja: '予約の担当と同じ' }),
    noStaff: text({ en: 'Not decided', ja: '決めない' }),
  },
  /** What the salon writes down on a booking */
  notes: {
    source: BOOKING_WORDS.source,
    noSource: text({ en: 'Not recorded', ja: '記録しない' }),
    deposit: BOOKING_WORDS.deposit,
    depositDescription: text({
      en: 'The amount in yen taken in advance. Leave it empty if none was.',
      ja: 'お預かりした円の金額。お預かりしていなければ空欄です。',
    }),
    customerRequest: BOOKING_WORDS.customerRequest,
    internalNotes: BOOKING_WORDS.internalNotes,
    internalNotesDescription: text({
      en: 'Customers do not see it.',
      ja: 'お客様には見えません。',
    }),
  },
  /** How a booking reached the salon, by the values the API keeps */
  sources: {
    phone: text({ en: 'Phone', ja: '電話' }),
    walk_in: text({ en: 'Walk-in', ja: '店頭' }),
    email: text({ en: 'Email', ja: 'メール' }),
    other: text({ en: 'Other', ja: 'その他' }),
    /** A booking a customer made in the portal */
    online: text({ en: 'Online', ja: 'オンライン' }),
  },
  /** A way the form does not know, as the API keeps it */
  storedSource: (source: string) => text({ en: source, ja: source }),
  /** What a check of the members of the lines found */
  checked: {
    unread: (numbers: readonly number[]) => {
      const lines = linesNamed(numbers)

      return failedTo(
        text({
          en: `Whether the staff of ${lines.en.toLowerCase()} are free could not be checked.`,
          ja: `${lines.ja} の担当の空きを確かめられませんでした。`,
        }),
      )
    },
    taken: (numbers: readonly number[]) => {
      const lines = linesNamed(numbers)

      return text({
        en: `The staff of ${lines.en.toLowerCase()} have an overlapping booking. The time a staff member keeps free before and after a booking counts as well. Change the staff member or the start time.`,
        ja: `${lines.ja} の担当に、重なる予約があります。担当の前後の空け時間も、重なりに数えます。担当か開始の時刻を変えてください。`,
      })
    },
    unassigned: followed(
      text({
        en: 'No line has a staff member.',
        ja: '担当を決めた明細がありません。',
      }),
      UNASSIGNED_TAKES_NOTHING,
    ),
    free: text({
      en: 'Checked whether the staff are free. No booking overlaps.',
      ja: '担当の空きを確かめました。重なる予約はありません。',
    }),
  },
  errors: {
    ...BOOKING_ERRORS,
    /** The customer of the booking was removed meanwhile */
    customerGone: text({
      en: 'This customer was removed from the ledger. Choose the customer again.',
      ja: 'このお客様は、台帳から削除されていました。お客様を選び直してください。',
    }),
    /** The amounts of the lines go beyond what a booking holds */
    tooMuch: text({
      en: 'The total goes beyond what one booking can hold. Take some lines off.',
      ja: '金額の合計が、1 件の予約で扱える上限を超えます。明細を減らしてください。',
    }),
  },
  /** What the API refused about a booking that was to be put in */
  refused: {
    taken: text({
      en: 'The booking could not be made: the time of a staff member overlaps another booking. Each line was checked again for whether its staff member is free.',
      ja: '担当の時間が、ほかの予約と重なっているため、予約を入れられませんでした。明細ごとに、担当の空きを確かめ直しました。',
    }),
    forbidden: text({
      en: 'This account cannot make bookings for this salon.',
      ja: 'このアカウントでは、このサロンの予約を入れられません。',
    }),
    failed: failedTo(
      text({
        en: 'The booking could not be made.',
        ja: '予約を入れられませんでした。',
      }),
    ),
  },
  added: text({ en: 'Made the booking.', ja: '予約を入れました。' }),
  /** The change of what the salon wrote down on a booking */
  notesChange: {
    submit: text({ en: 'Save changes', ja: '変更を保存する' }),
    cancel: BOOKING_WORDS.cancel,
    done: text({
      en: 'Saved the record of the booking.',
      ja: '予約の記録を変えました。',
    }),
    forbidden: BOOKING_ERRORS.forbidden,
    failed: failedTo(
      text({
        en: 'The record of the booking could not be changed.',
        ja: '予約の記録を変えられませんでした。',
      }),
    ),
  },
}
