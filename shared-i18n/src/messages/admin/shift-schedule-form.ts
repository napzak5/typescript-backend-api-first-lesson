import { numberOf } from '../../formats/numbers'
import { text } from '../../languages/localized-text'
import { countedIn } from '../written'
import { salonHours } from './settings-hours'
import { CANCEL, SAVE } from './settings-words'
import { staffCalled } from './staff-words'

/*
 * The form of the schedule of a member: the hours of every day of the
 * week, and the rows of dates. It is written as the form of the hours of
 * a salon is, and says what that form says alike in the words of that
 * form.
 */

const { hoursForm } = salonHours

export const shiftScheduleForm = {
  form: {
    submit: SAVE,
    cancel: CANCEL,
    start: text({ en: 'Starts', ja: '始まり' }),
    end: text({ en: 'Ends', ja: '終わり' }),
    breakStart: hoursForm.breakStart,
    breakEnd: hoursForm.breakEnd,
    breakDescription: hoursForm.breakDescription,
    week: hoursForm.week,
    weekDescription: text({
      en: 'The hours of each day of the week, at the clock of the salon. A note on a day the member does not work on is kept as the reason for the day off.',
      ja: '曜日ごとの勤務時間です。時刻は、サロンの時計の時刻です。勤務しない曜日に備考を書くと、休みの理由として残ります。',
    }),
    work: text({ en: 'Work', ja: '勤務' }),
    works: text({ en: 'Works', ja: '勤務する' }),
    worksNot: text({ en: 'Does not work', ja: '勤務しない' }),
    off: text({ en: 'Day off', ja: '休み' }),
    notes: hoursForm.notes,
    dates: hoursForm.dates,
    datesDescription: text({
      en: 'Days with other hours, and days off. On a day with a row, the row is used in place of the hours of its day of the week.',
      ja: 'その日だけ勤務時間を変える日や、休みの日です。日付ごとの行がある日は、曜日の勤務時間の代わりに、その行を使います。',
    }),
    row: hoursForm.row,
    date: hoursForm.date,
    notesDescription: text({
      en: 'Why the member is off (paid leave, training and the like), or why the hours change.',
      ja: '休みの理由（有給休暇、研修など）や、勤務時間を変える理由です。',
    }),
    removeRow: hoursForm.removeRow,
    remove: hoursForm.remove,
    addRow: hoursForm.addRow,
    /** The rows of dates a schedule holds at most */
    mostDates: (most: number) =>
      text({
        en: `Up to ${countedIn(most, 'row', 'rows')} by date can be kept, the rows before today among them.`,
        ja: `日付ごとの行は、今日より前の行と合わせて ${numberOf(most).ja} 行まで入れられます。`,
      }),
    /** The control that deletes the rows of the days before today */
    dropPast: (rows: number) =>
      text({
        en: `Delete the rows of dates before today (${countedIn(rows, 'row', 'rows')})`,
        ja: `今日より前の日付の行（${numberOf(rows).ja} 行）を消す`,
      }),
    dropPastDescription: text({
      en: 'Rows that are not deleted stay as they are. The rows of past days are not used for the shifts.',
      ja: '消さないときは、そのまま残ります。済んだ日の行は、シフトに使われません。',
    }),
    /** What the form found wrong */
    errors: {
      startMissing: text({
        en: 'Enter the time the work starts.',
        ja: '勤務の始まりの時刻を入力してください。',
      }),
      endMissing: text({
        en: 'Enter the time the work ends.',
        ja: '勤務の終わりの時刻を入力してください。',
      }),
      endBeforeStart: text({
        en: 'Make the end of the work later than its start. Work cannot run past midnight.',
        ja: '勤務の終わりは、始まりより後の時刻にしてください。日付をまたぐ勤務は入れられません。',
      }),
      breakBeforeStart: text({
        en: 'Start the break after the work starts.',
        ja: '休憩は、勤務の始まりより後に始めてください。',
      }),
      breakEndBeforeStart: hoursForm.errors.breakEndBeforeStart,
      breakAfterEnd: text({
        en: 'End the break before the work ends.',
        ja: '休憩は、勤務の終わりより前に終えてください。',
      }),
      noBreakEnd: hoursForm.errors.noBreakEnd,
      noBreakStart: hoursForm.errors.noBreakStart,
      dayMissing: hoursForm.errors.dayMissing,
      dayOutOfRange: hoursForm.errors.dayOutOfRange,
      sameDate: hoursForm.errors.sameDate,
      /** A date that a row of the days before today, which the form does not show, has */
      pastDateKept: text({
        en: 'This date already has a row among the dates before today.',
        ja: 'この日付の行は、今日より前の日付の行に、すでにあります。',
      }),
    },
    /** Somebody changed the schedule meanwhile: the form was not saved */
    changedMeanwhile: text({
      en: `Meanwhile, another account changed this work schedule. What this form holds is not saved yet. Press “${SAVE.en}” again to replace the work schedule with what this form holds. To see the change of the other account, go back to the work schedule with “${CANCEL.en}”.`,
      ja: `その間に、ほかのアカウントがこの勤務スケジュールを変えていました。このフォームの内容は、まだ保存していません。もう一度「${SAVE.ja}」を押すと、いまの勤務スケジュールを、このフォームの内容で置き換えます。ほかのアカウントの変更を確かめるときは、「${CANCEL.ja}」で勤務スケジュールに戻ってください。`,
    }),
    /** The account may not plan the schedules of the salon */
    forbidden: text({
      en: 'This account cannot edit work schedules. Only the owners and managers of the salon, and administrators, can edit them.',
      ja: 'このアカウントでは、勤務スケジュールを直せません。勤務スケジュールを直せるのは、サロンのオーナー、マネージャーと、管理者です。',
    }),
    failed: text({
      en: 'Could not save the work schedule. Check your connection and try again.',
      ja: '勤務スケジュールを保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
    /** The schedule was saved, of the member by the name the customers see */
    saved: (displayName: string) =>
      text({
        en: `Saved the work schedule of ${staffCalled(displayName).en}.`,
        ja: `${staffCalled(displayName).ja}の勤務スケジュールを保存しました。`,
      }),
    toSchedule: text({
      en: 'Back to the work schedule',
      ja: '勤務スケジュールへ',
    }),
  },
}
