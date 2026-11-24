import { type LocalizedText, text } from '../../languages/localized-text'
import { followed } from '../written'
import { BOOKING_WORDS, failedTo } from './booking-words'
import { SALE_WORDS } from './sale-words'

/*
 * What the page of a booking says: what the salon keeps of it, what can
 * be done to its state, and the ways to change it and to remove it.
 */

/** What can be done to the state of a booking, by the names of the operations */
type ByAction = {
  confirm: LocalizedText
  start: LocalizedText
  complete: LocalizedText
  cancel: LocalizedText
  noShow: LocalizedText
}

const ACTION_LABELS: ByAction = {
  confirm: text({ en: 'Confirm the booking', ja: '予約を確定する' }),
  start: text({ en: 'Start the treatment', ja: '施術を始める' }),
  complete: text({ en: 'Complete', ja: '完了にする' }),
  noShow: text({ en: 'Record a no-show', ja: '無断キャンセルを記録する' }),
  cancel: text({ en: 'Cancel the booking', ja: '予約をキャンセルする' }),
}

/** A date and a time a control of the completion takes */
const ON_THE_CLOCK = text({
  en: 'A date and time on the clock of the salon.',
  ja: 'サロンの時計の日時。',
})

const NOT_RECORDED_EMPTY = followed(
  ON_THE_CLOCK,
  text({
    en: 'Left empty, nothing is recorded.',
    ja: '空欄のときは、記録しません。',
  }),
)

/** What follows an operation that was done */
const DONE: ByAction = {
  confirm: text({ en: 'Confirmed the booking.', ja: '予約を確定しました。' }),
  start: text({
    en: 'Recorded the start of the treatment.',
    ja: '施術の開始を記録しました。',
  }),
  complete: text({
    en: 'Completed the booking.',
    ja: '予約を完了にしました。',
  }),
  cancel: text({
    en: 'Cancelled the booking.',
    ja: '予約をキャンセルしました。',
  }),
  noShow: text({
    en: 'Recorded a no-show.',
    ja: '無断キャンセルを記録しました。',
  }),
}

/** What follows an operation that came to nothing */
const FAILED: ByAction = {
  confirm: failedTo(
    text({
      en: 'The booking could not be confirmed.',
      ja: '予約を確定できませんでした。',
    }),
  ),
  start: failedTo(
    text({
      en: 'The start of the treatment could not be recorded.',
      ja: '施術の開始を記録できませんでした。',
    }),
  ),
  complete: failedTo(
    text({
      en: 'The booking could not be completed.',
      ja: '予約を完了にできませんでした。',
    }),
  ),
  cancel: failedTo(
    text({
      en: 'The booking could not be cancelled.',
      ja: '予約をキャンセルできませんでした。',
    }),
  ),
  noShow: failedTo(
    text({
      en: 'The no-show could not be recorded.',
      ja: '無断キャンセルを記録できませんでした。',
    }),
  ),
}

export const bookingDetailsMessages = {
  /** What the salon keeps of a booking */
  record: {
    booking: BOOKING_WORDS.booking,
    bookingNumber: BOOKING_WORDS.bookingNumber,
    date: BOOKING_WORDS.date,
    hours: BOOKING_WORDS.hours,
    customer: BOOKING_WORDS.customer,
    phoneNumber: text({
      en: 'Customer’s phone number',
      ja: 'お客様の電話番号',
    }),
    staff: BOOKING_WORDS.staff,
    customerRequest: BOOKING_WORDS.customerRequest,
    internalNotes: BOOKING_WORDS.internalNotes,
    source: BOOKING_WORDS.source,
    deposit: BOOKING_WORDS.deposit,
    cancelledAt: text({ en: 'Cancelled at', ja: 'キャンセルした日時' }),
    cancellationReason: text({
      en: 'Reason for cancelling',
      ja: 'キャンセルの理由',
    }),
    actualStart: text({ en: 'Actual start', ja: '実際の開始' }),
    actualEnd: text({ en: 'Actual end', ja: '実際の終了' }),
    completedAt: text({
      en: 'Completion recorded at',
      ja: '完了を記録した日時',
    }),
    lines: BOOKING_WORDS.lines,
    service: BOOKING_WORDS.service,
    amount: text({ en: 'Amount', ja: '金額' }),
    completed: BOOKING_WORDS.completed,
    done: BOOKING_WORDS.done,
    notDone: BOOKING_WORDS.notDone,
    noLines: text({ en: 'No service lines', ja: '施術明細はありません' }),
    amounts: text({ en: 'Amounts', ja: '金額' }),
    subtotal: SALE_WORDS.subtotal,
    discount: SALE_WORDS.discount,
    tax: SALE_WORDS.tax,
    total: SALE_WORDS.total,
  },
  /** The state of a booking, and what can be done to it */
  status: {
    title: BOOKING_WORDS.status,
    actions: ACTION_LABELS,
    closed: text({
      en: 'The status of this booking cannot be changed any more. If it was recorded by mistake, remove the booking and make it again.',
      ja: 'この予約の状態は、もう変えられません。誤って記録したときは、予約を削除して入れ直してください。',
    }),
    completion: {
      title: text({
        en: 'Complete the booking?',
        ja: '予約を完了にしますか？',
      }),
      description: (when: LocalizedText) =>
        text({
          en: `The booking of ${when.en} will be completed. A completed booking cannot be undone.`,
          ja: `${when.ja}の予約を完了にします。完了にした予約は、元に戻せません。`,
        }),
      submit: ACTION_LABELS.complete,
      actualStart: text({ en: 'Actual start', ja: '実際の開始' }),
      actualEnd: text({ en: 'Actual end', ja: '実際の終了' }),
      notRecorded: NOT_RECORDED_EMPTY,
      /** The beginning was recorded when the treatment began: what an empty control keeps */
      recordedStart: (recorded: LocalizedText) =>
        followed(
          ON_THE_CLOCK,
          text({
            en: `Left empty, it stays as recorded when the treatment started (${recorded.en}).`,
            ja: `空欄のときは、施術を始めたときに記録した日時（${recorded.ja}）のままです。`,
          }),
        ),
      notAMoment: text({
        en: 'Enter a date and a time. On some days the clock of the salon skips a time (daylight saving time begins).',
        ja: '日付と時刻を入力してください。サロンの時計で、その時刻がない日（夏時間の始まり）もあります。',
      }),
      endAfterRecordedStart: text({
        en: 'Make the end later than the recorded start.',
        ja: '終了は、記録した開始より後の時刻にしてください。',
      }),
      endAfterStart: text({
        en: 'Make the end later than the start.',
        ja: '終了は、開始より後の時刻にしてください。',
      }),
    },
    cancellation: {
      title: text({
        en: 'Cancel the booking?',
        ja: '予約をキャンセルしますか？',
      }),
      description: (when: LocalizedText) =>
        text({
          en: `The booking of ${when.en} will be cancelled. A cancelled booking cannot be undone.`,
          ja: `${when.ja}の予約をキャンセルします。キャンセルした予約は、元に戻せません。`,
        }),
      submit: text({
        en: 'Confirm the cancellation',
        ja: 'キャンセルを確定する',
      }),
      reason: text({ en: 'Reason for cancelling', ja: 'キャンセルの理由' }),
      reasonDescription: text({
        en: 'What the customer said, for example. The booking can be cancelled with this left empty.',
        ja: 'お客様からの連絡の内容など。空欄のままでも、キャンセルできます。',
      }),
    },
    noShow: {
      title: text({
        en: 'Record a no-show?',
        ja: '無断キャンセルを記録しますか？',
      }),
      description: (when: LocalizedText) =>
        text({
          en: `It will be recorded that the customer did not come to the booking of ${when.en}. This cannot be undone.`,
          ja: `${when.ja}の予約に、お客様が来店しなかったことを記録します。記録した予約は、元に戻せません。`,
        }),
      back: BOOKING_WORDS.back,
      submit: text({ en: 'Record', ja: '記録する' }),
    },
    done: DONE,
    failed: FAILED,
    changedElsewhere: text({
      en: 'The status of the booking was changed on another screen or device. Its current status was read again.',
      ja: '予約の状態が、ほかの画面か端末で変わっていました。いまの状態を読み込み直しました。',
    }),
  },
  /** The ways to change a booking beside its state, and its removal */
  changes: {
    move: BOOKING_WORDS.move,
    addLine: BOOKING_WORDS.addLine,
    changeNotes: BOOKING_WORDS.changeNotes,
    remove: text({ en: 'Remove the booking', ja: '予約を削除する' }),
    removal: {
      title: text({ en: 'Remove the booking?', ja: '予約を削除しますか？' }),
      description: (when: LocalizedText) =>
        text({
          en: `The booking of ${when.en} will be taken out of the ledger with its lines. This is for a booking made by mistake or made twice. Cancel a booking that will not take place instead of removing it. A removed booking cannot be brought back.`,
          ja: `${when.ja}の予約を、施術明細とともに台帳から取り除きます。誤って入れた予約や、重複した予約を取り除くためのものです。行われない予約は、削除せずにキャンセルしてください。削除した予約は、元に戻せません。`,
        }),
      back: BOOKING_WORDS.back,
      submit: text({ en: 'Remove', ja: '削除する' }),
      done: text({ en: 'Removed the booking.', ja: '予約を削除しました。' }),
      referred: text({
        en: 'This booking cannot be removed: a sale, a treatment record or a review refers to it. It stays as the record of a visit that took place.',
        ja: 'この予約は、売上、施術記録、レビューのどれかが指しているため、削除できません。行われた来店の記録として残ります。',
      }),
      forbidden: text({
        en: 'This account cannot remove bookings. Cancel a booking that will not take place.',
        ja: 'このアカウントでは、予約を削除できません。行われない予約は、キャンセルしてください。',
      }),
      failed: failedTo(
        text({
          en: 'The booking could not be removed.',
          ja: '予約を削除できませんでした。',
        }),
      ),
    },
  },
  loading: text({
    en: 'Loading the booking details',
    ja: '予約の内容を読み込んでいます',
  }),
  /** The way from a booking to the bookings of its day */
  toDay: text({
    en: 'Go to the bookings of this day',
    ja: 'この日の予約へ',
  }),
}
