import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import { messagesOf } from '../__tests__/found-messages'
import { adminSettingsMessages, adminShiftMessages } from './index'

const { form, member, record, week } = adminShiftMessages

/** A week as a heading of the screens of a salon names it */
const WEEK = {
  en: 'Mon, November 16, 2026 – Sun, November 22, 2026',
  ja: '2026年11月16日（月）〜2026年11月22日（日）',
}

/** Every message that is made from a value, with the value and what it says */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'adminShiftMessages.week.caption',
    week.caption(WEEK),
    {
      en: 'Shifts for Mon, November 16, 2026 – Sun, November 22, 2026',
      ja: '2026年11月16日（月）〜2026年11月22日（日）のシフト',
    },
  ],
  [
    'adminShiftMessages.record.pastOf',
    record.pastOf(3),
    {
      en: 'Also kept: 3 rows of dates before today.',
      ja: '今日より前の日付の行が、ほかに 3 行あります。',
    },
  ],
  [
    'adminShiftMessages.member.called',
    member.called('Hiroshi Tanaka'),
    { en: 'Hiroshi Tanaka', ja: 'Hiroshi Tanaka さん' },
  ],
  ['adminShiftMessages.form.row', form.row(2), { en: 'Row 2', ja: '2 行目' }],
  [
    'adminShiftMessages.form.removeRow',
    form.removeRow(2),
    { en: 'Remove row 2', ja: '2 行目を外す' },
  ],
  [
    'adminShiftMessages.form.mostDates',
    form.mostDates(366),
    {
      en: 'Up to 366 rows by date can be kept, the rows before today among them.',
      ja: '日付ごとの行は、今日より前の行と合わせて 366 行まで入れられます。',
    },
  ],
  [
    'adminShiftMessages.form.dropPast',
    form.dropPast(4),
    {
      en: 'Delete the rows of dates before today (4 rows)',
      ja: '今日より前の日付の行（4 行）を消す',
    },
  ],
  [
    'adminShiftMessages.form.errors.sameDate',
    form.errors.sameDate(1),
    {
      en: 'This date is the same as that of row 1. A date takes one row.',
      ja: 'この日付は、1 行目と同じです。1 つの日付に入れられるのは 1 行です。',
    },
  ],
  [
    'adminShiftMessages.form.saved',
    form.saved('Hiroshi Tanaka'),
    {
      en: 'Saved the work schedule of Hiroshi Tanaka.',
      ja: 'Hiroshi Tanaka さんの勤務スケジュールを保存しました。',
    },
  ],
]

describe('the messages of the shifts of the admin application', () => {
  it.each(MADE)(
    'should name the value it is made from: %s',
    (_where, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should have a value in this test for every message that is made from one', () => {
    // Assert
    expect(MADE.map(([where]) => where).toSorted()).toEqual(
      messagesOf({ adminShiftMessages }, '').made.toSorted(),
    )
  })

  it.each<[string, LocalizedText, LocalizedText]>([
    [
      'row before today',
      record.pastOf(1),
      {
        en: 'Also kept: 1 row of dates before today.',
        ja: '今日より前の日付の行が、ほかに 1 行あります。',
      },
    ],
    [
      'row to delete',
      form.dropPast(1),
      {
        en: 'Delete the rows of dates before today (1 row)',
        ja: '今日より前の日付の行（1 行）を消す',
      },
    ],
  ])(
    'should count one %s as one in English, and with the same word in Japanese',
    (_what, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should say what the form of the hours of a salon says alike in its words', () => {
    // Arrange
    const { hoursForm } = adminSettingsMessages

    // Assert
    expect(form.errors.noBreakEnd).toBe(hoursForm.errors.noBreakEnd)
    expect(form.errors.noBreakStart).toBe(hoursForm.errors.noBreakStart)
    expect(form.errors.dayOutOfRange).toBe(hoursForm.errors.dayOutOfRange)
    expect(form.addRow).toBe(hoursForm.addRow)
  })
})
