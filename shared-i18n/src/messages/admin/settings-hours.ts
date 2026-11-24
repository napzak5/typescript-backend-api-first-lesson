import { type LocalizedText, text } from '../../languages/localized-text'
import { fieldMessages } from '../ui/fields'
import { salonScreenMessages } from '../ui/salon-screens'
import { countedIn, followed } from '../written'
import { CANCEL, SAVE } from './settings-words'

/*
 * The hours of a salon: how its record writes them, the form that changes
 * them, and what it says after the API took them or not. The times are
 * those of the clock of the salon, written by the formats.
 */

/** A day of the week, or a date, on which the salon does not open */
const CLOSED = text({ en: 'Closed', ja: '休業' })

export const salonHours = {
  /** How the record writes the hours */
  hours: {
    closed: CLOSED,
    closedAllDay: text({ en: 'Closed all day', ja: '終日休業' }),
    /** The days hours are kept in: 「2026年4月1日から2026年9月30日まで」 */
    periodOf: (from: LocalizedText, to: LocalizedText) =>
      text({
        en: `from ${from.en} to ${to.en}`,
        ja: `${from.ja}から${to.ja}まで`,
      }),
    /** The hours of a day of the week, with its break and the period they are kept in */
    ofTheWeek: (
      open: LocalizedText,
      breaks: LocalizedText | null,
      period: LocalizedText | null,
    ) =>
      text({
        en: [
          open.en,
          ...(breaks === null ? [] : [` (break ${breaks.en})`]),
          ...(period === null ? [] : [`, ${period.en}`]),
        ].join(''),
        ja: [
          open.ja,
          ...(breaks === null ? [] : [`（休憩 ${breaks.ja}）`]),
          ...(period === null ? [] : [`・${period.ja}`]),
        ].join(''),
      }),
    /** A holiday or a day off by the name the salon wrote, which stands in every language as it was written */
    holidayNamed: (name: string) => text({ en: name, ja: name }),
    /** A holiday or a day off without a name */
    unnamedHoliday: text({ en: 'Holiday or day off', ja: '祝日・休業日' }),
    /** An ordinary day of the calendar */
    noHoliday: text({ en: 'No', ja: 'いいえ' }),
  },
  /** The tables of the hours in the record */
  hoursRecord: {
    week: text({ en: 'Hours', ja: '営業時間' }),
    weekday: text({ en: 'Day', ja: '曜日' }),
    hours: text({ en: 'Hours', ja: '営業時間' }),
    noWeek: text({ en: 'No hours', ja: '営業時間はありません' }),
    calendar: text({ en: 'Calendar', ja: '営業日カレンダー' }),
    date: text({ en: 'Date', ja: '日付' }),
    holiday: text({ en: 'Holiday or day off', ja: '祝日・休業日' }),
    notes: text({ en: 'Notes', ja: '備考' }),
    noCalendar: text({
      en: 'No dates from today on. The salon keeps the hours of the days of the week.',
      ja: '今日からの日付はありません。曜日ごとの営業時間で営業します。',
    }),
  },
  /** The form of the hours */
  hoursForm: {
    submit: SAVE,
    cancel: CANCEL,
    opens: text({ en: 'Opens', ja: '開店' }),
    closes: text({ en: 'Closes', ja: '閉店' }),
    week: text({ en: 'Every week', ja: '毎週' }),
    weekDescription: text({
      en: 'The hours of each day of the week, at the clock of the salon. The free slots customers book are the hours less the breaks.',
      ja: '曜日ごとの営業時間です。時刻は、サロンの時計の時刻です。お客様の予約の空き枠は、営業時間から休憩を除いた時間にできます。',
    }),
    open: text({ en: 'Open or closed', ja: '営業' }),
    isOpen: text({ en: 'Open', ja: '営業する' }),
    isClosed: CLOSED,
    isClosedAllDay: text({ en: 'Closed all day', ja: '終日休業' }),
    breakStart: text({ en: 'Break starts', ja: '休憩の始まり' }),
    breakEnd: text({ en: 'Break ends', ja: '休憩の終わり' }),
    breakDescription: text({
      en: 'Leave both empty when there is no break.',
      ja: '休憩がないときは、始まりも終わりも空にします。',
    }),
    moreSlots: text({
      en: 'This day of the week has two or more hours or breaks. Saving a change of the weekly hours keeps only the first hours and the first break.',
      ja: 'この曜日には、営業時間か休憩が 2 つ以上あります。毎週の営業時間を変えて保存すると、最初の営業時間と最初の休憩だけが残ります。',
    }),
    /** The period the hours of a day of the week are kept in, which the form does not change */
    periodKept: (period: LocalizedText) =>
      text({
        en: `These hours are kept ${period.en}. The period is not changed on this screen.`,
        ja: `この曜日の営業時間は、${period.ja}です。期間は、この画面では変えません。`,
      }),
    dates: text({ en: 'By date', ja: '日付ごと' }),
    datesDescription: text({
      en: 'Holidays, closures and short days. On a day with a row, the row is used in place of the hours of its day of the week.',
      ja: '祝日、臨時休業、短縮営業の日です。日付ごとの行がある日は、曜日の営業時間の代わりに、その行を使います。',
    }),
    /** A row of the dates, by its number from 1 */
    row: (row: number) => text({ en: `Row ${row}`, ja: `${row} 行目` }),
    date: text({ en: 'Date', ja: '日付' }),
    holidayOpen: text({ en: 'Open on a holiday', ja: '祝日の営業' }),
    holidayOpenDescription: text({
      en: 'Check it for a holiday or a day off on which the salon opens at set hours.',
      ja: '祝日や店休日に、時間を決めて営業する日に印を付けます。',
    }),
    holidayName: text({
      en: 'Name of the holiday or day off',
      ja: '祝日・休業日の名前',
    }),
    holidayNameDescription: (most: number) =>
      followed(
        fieldMessages.upTo(most),
        text({
          en: 'Such as “New Year’s Day”, “Year-end holidays” or “Equipment check”.',
          ja: '「元日」「年末年始」「設備の点検」など。',
        }),
      ),
    notes: text({ en: 'Notes', ja: '備考' }),
    removeRow: (row: number) =>
      text({ en: `Remove row ${row}`, ja: `${row} 行目を外す` }),
    remove: text({ en: 'Remove', ja: '外す' }),
    addRow: text({ en: 'Add a date', ja: '日付の行を足す' }),
    /** The dates before today, which the form keeps as they are */
    pastKept: (rows: number) =>
      text({
        en: `The dates before today (${countedIn(rows, 'row', 'rows')}) stay as a record.`,
        ja: `今日より前の日付（${rows} 行）は、記録としてそのまま残ります。`,
      }),
    /** What the form found wrong */
    errors: {
      openMissing: text({
        en: 'Enter the opening time.',
        ja: '開店の時刻を入力してください。',
      }),
      closeMissing: text({
        en: 'Enter the closing time.',
        ja: '閉店の時刻を入力してください。',
      }),
      closeBeforeOpen: text({
        en: 'Make the closing time later than the opening time. Hours cannot run past midnight.',
        ja: '閉店は、開店より後の時刻にしてください。日付をまたぐ営業は入れられません。',
      }),
      breakBeforeOpen: text({
        en: 'Start the break after the opening time.',
        ja: '休憩は、開店より後に始めてください。',
      }),
      breakEndBeforeStart: text({
        en: 'Make the end of the break later than its start.',
        ja: '休憩の終わりは、休憩の始まりより後の時刻にしてください。',
      }),
      breakAfterClose: text({
        en: 'End the break before the closing time.',
        ja: '休憩は、閉店より前に終えてください。',
      }),
      /** A break with a start and no end, which the shifts say as well */
      noBreakEnd: text({
        en: 'Enter the end of the break as well. When there is no break, leave both its start and its end empty.',
        ja: '休憩の終わりの時刻も入力してください。休憩がないときは、始まりも終わりも空にします。',
      }),
      /** A break with an end and no start, which the shifts say as well */
      noBreakStart: text({
        en: 'Enter the start of the break as well. When there is no break, leave both its start and its end empty.',
        ja: '休憩の始まりの時刻も入力してください。休憩がないときは、始まりも終わりも空にします。',
      }),
      dayMissing: salonScreenMessages.period.dayMissing,
      dayOutOfRange: text({
        en: 'Enter a date from January 1, 1900 to December 31, 2999.',
        ja: '日付は、1900 年 1 月 1 日から 2999 年 12 月 31 日までにしてください。',
      }),
      dayPast: text({
        en: 'Enter today or a later date.',
        ja: '今日か、今日より後の日付を入力してください。',
      }),
      /** A date that an earlier row has, by the number of that row from 1 */
      sameDate: (row: number) =>
        text({
          en: `This date is the same as that of row ${row}. A date takes one row.`,
          ja: `この日付は、${row} 行目と同じです。1 つの日付に入れられるのは 1 行です。`,
        }),
    },
    /** Somebody changed the hours meanwhile: the form was not saved */
    changedMeanwhile: text({
      en: `Meanwhile, another account changed the hours of this salon. What this form holds is not saved yet. Press “${SAVE.en}” again to replace the hours with what this form holds. To see the change of the other account, go back to the settings with “${CANCEL.en}”.`,
      ja: `その間に、ほかのアカウントがこのサロンの営業時間を変えていました。このフォームの内容は、まだ保存していません。もう一度「${SAVE.ja}」を押すと、いまの営業時間を、このフォームの内容で置き換えます。ほかのアカウントの変更を確かめるときは、「${CANCEL.ja}」で設定に戻ってください。`,
    }),
    /** The account may not keep the hours of the salon */
    forbidden: text({
      en: 'The hours of this salon cannot be changed. Only the owners and managers of that salon, and administrators, can change its hours.',
      ja: 'このサロンの営業時間は、変えられません。営業時間を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
    }),
    failed: text({
      en: 'Could not save the hours. Check your connection and try again.',
      ja: '営業時間を保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
    changed: text({ en: 'Saved the hours.', ja: '営業時間を直しました。' }),
  },
}
