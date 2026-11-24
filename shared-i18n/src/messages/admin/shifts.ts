import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'
import { countedIn } from '../written'
import { salonHours } from './settings-hours'
import { shiftScheduleForm } from './shift-schedule-form'
import { adminStaffMessages } from './staff'

/*
 * What the admin application says of the shifts of a salon: the shifts
 * of a week, the work schedule of a member, and its form. The names of the
 * members and the notes of a schedule stand as they were written; the
 * times are those of the clock of the salon, written by the formats.
 */

const { hoursRecord } = salonHours

const SCHEDULE = adminStaffMessages.member.schedule
const CHANGE = text({
  en: 'Edit the work schedule',
  ja: '勤務スケジュールを直す',
})
const BREAK = text({ en: 'Break', ja: '休憩' })
const NO_WORK = text({ en: 'Not working', ja: '勤務なし' })

export const adminShiftMessages = {
  titles: {
    shifts: text({ en: 'Shifts', ja: 'シフト' }),
    schedule: SCHEDULE,
    change: CHANGE,
  },
  /** What a screen could not read, as a sentence names it */
  names: {
    shifts: text({ en: 'the shifts', ja: 'シフト' }),
    schedule: text({ en: 'the work schedule', ja: '勤務スケジュール' }),
  },
  loading: {
    shifts: text({ en: 'Loading the shifts', ja: 'シフトを読み込んでいます' }),
    schedule: text({
      en: 'Loading the work schedule',
      ja: '勤務スケジュールを読み込んでいます',
    }),
  },
  /** The shifts of a week */
  week: {
    label: text({ en: 'Week of the shifts', ja: 'シフトの週' }),
    /** The table of a week, by the days it runs over */
    caption: (week: LocalizedText) =>
      text({ en: `Shifts for ${week.en}`, ja: `${week.ja}のシフト` }),
    member: text({ en: 'Staff member', ja: 'スタッフ' }),
    none: adminStaffMessages.ledger.none,
    rest: BREAK,
    /** A row of a date, which applies on that date alone */
    onlyThisDate: text({ en: 'This date only', ja: '（この日だけ）' }),
    off: shiftScheduleForm.form.off,
    noWork: NO_WORK,
    nobody: text({
      en: 'No staff members on the shifts',
      ja: 'シフトに出るスタッフはいません',
    }),
    nobodyDescription: text({
      en: 'Active staff members are on the shifts. The owner registers the staff in the staff ledger.',
      ja: '有効なスタッフが、シフトに出ます。スタッフは、オーナーがスタッフ台帳に登録します。',
    }),
    /** The member of a member of the staff is not among the active staff */
    notOnShifts: text({
      en: 'The staff member linked to this account is not an active staff member of this salon.',
      ja: 'このアカウントに結びついたスタッフは、このサロンの有効なスタッフにいません。',
    }),
  },
  /** The schedule of a member, as its screen shows it */
  record: {
    week: shiftScheduleForm.form.week,
    weekday: hoursRecord.weekday,
    work: shiftScheduleForm.form.work,
    rest: BREAK,
    notes: hoursRecord.notes,
    noWeekdays: text({ en: 'No days of the week', ja: '曜日はありません' }),
    dates: shiftScheduleForm.form.dates,
    date: hoursRecord.date,
    noDates: text({
      en: 'No dates from today on. A day with other hours, or a day off, goes in a row by date.',
      ja: '今日から後の日付の行はありません。その日だけ勤務時間を変える日や休みの日は、日付ごとの行に入れます。',
    }),
    /** The rows of the days before today, which are counted, not listed */
    pastOf: (rows: number) =>
      text({
        en: `Also kept: ${countedIn(rows, 'row', 'rows')} of dates before today.`,
        ja: `今日より前の日付の行が、ほかに ${numberOf(rows).ja} 行あります。`,
      }),
    off: shiftScheduleForm.form.off,
    noWork: NO_WORK,
    change: CHANGE,
    toShifts: text({ en: 'Back to the shifts', ja: 'シフトへ' }),
  },
  /** A screen of a schedule when there is none to show, or none the account may see */
  member: {
    notFound: adminStaffMessages.notFound.title,
    notFoundDescription: text({
      en: 'Check that the address is right. A staff member removed from the ledger cannot be shown. The owner and administrators open the work schedule of an inactive staff member from the staff ledger.',
      ja: 'アドレスが正しいか、お確かめください。削除したスタッフは、表示できません。無効なスタッフの勤務スケジュールは、オーナーと管理者が、スタッフ台帳から開けます。',
    }),
    forbidden: text({
      en: 'This work schedule cannot be seen from this account. Only the owner and managers of the salon, administrators, and the staff member themselves can see it.',
      ja: 'この勤務スケジュールは、見られません。勤務スケジュールを見られるのは、そのサロンのオーナー、マネージャー、管理者と、そのスタッフ自身です。',
    }),
    toStart: adminStaffMessages.keepers.toStart,
    /** The member, by the name the customers see */
    called: adminStaffMessages.called,
    inactive: text({
      en: 'This staff member is inactive, and is not on the shifts until they are made active again. Their work schedule can be planned before they come back.',
      ja: '無効なスタッフです。有効に戻すまで、シフトには出ません。復帰の前に、勤務スケジュールを組んでおけます。',
    }),
  },
  ...shiftScheduleForm,
}
