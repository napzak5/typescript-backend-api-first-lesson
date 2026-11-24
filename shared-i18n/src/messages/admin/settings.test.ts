import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import { messagesOf } from '../__tests__/found-messages'
import { adminSettingsMessages } from './index'

const { entry, form, hours, hoursForm, record, removal } = adminSettingsMessages

/** A name of a salon, which stands in every language as it was written */
const NAME = '表参道店'

/** Days, times and numbers, as the formats write them */
const FROM = { en: 'April 1, 2026', ja: '2026年4月1日' }
const TO = { en: 'September 30, 2026', ja: '2026年9月30日' }
const OPEN = { en: '10:00–20:00', ja: '10:00〜20:00' }
const BREAK = { en: '13:00–14:00', ja: '13:00〜14:00' }
const RATING = { en: '4.0', ja: '4.0' }

/** Every message that is made from a value, with the value and what it says */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'adminSettingsMessages.record.ratingOf',
    record.ratingOf(RATING, 3),
    { en: '4.0 (3 reviews)', ja: '4.0（3 件のレビュー）' },
  ],
  [
    'adminSettingsMessages.record.placeOf',
    record.placeOf(
      { en: '35.658', ja: '35.658' },
      { en: '139.7016', ja: '139.7016' },
    ),
    {
      en: 'Latitude 35.658, longitude 139.7016',
      ja: '緯度 35.658、経度 139.7016',
    },
  ],
  [
    'adminSettingsMessages.hours.periodOf',
    hours.periodOf(FROM, TO),
    {
      en: 'from April 1, 2026 to September 30, 2026',
      ja: '2026年4月1日から2026年9月30日まで',
    },
  ],
  [
    'adminSettingsMessages.hours.ofTheWeek',
    hours.ofTheWeek(OPEN, BREAK, hours.periodOf(FROM, TO)),
    {
      en: '10:00–20:00 (break 13:00–14:00), from April 1, 2026 to September 30, 2026',
      ja: '10:00〜20:00（休憩 13:00〜14:00）・2026年4月1日から2026年9月30日まで',
    },
  ],
  [
    'adminSettingsMessages.hours.holidayNamed',
    hours.holidayNamed('年末年始'),
    { en: '年末年始', ja: '年末年始' },
  ],
  [
    'adminSettingsMessages.hoursForm.periodKept',
    hoursForm.periodKept(hours.periodOf(FROM, TO)),
    {
      en: 'These hours are kept from April 1, 2026 to September 30, 2026. The period is not changed on this screen.',
      ja: 'この曜日の営業時間は、2026年4月1日から2026年9月30日までです。期間は、この画面では変えません。',
    },
  ],
  [
    'adminSettingsMessages.hoursForm.row',
    hoursForm.row(2),
    { en: 'Row 2', ja: '2 行目' },
  ],
  [
    'adminSettingsMessages.hoursForm.holidayNameDescription',
    hoursForm.holidayNameDescription(100),
    {
      en: 'Up to 100 characters. Such as “New Year’s Day”, “Year-end holidays” or “Equipment check”.',
      ja: '100 文字まで。「元日」「年末年始」「設備の点検」など。',
    },
  ],
  [
    'adminSettingsMessages.hoursForm.removeRow',
    hoursForm.removeRow(2),
    { en: 'Remove row 2', ja: '2 行目を外す' },
  ],
  [
    'adminSettingsMessages.hoursForm.pastKept',
    hoursForm.pastKept(3),
    {
      en: 'The dates before today (3 rows) stay as a record.',
      ja: '今日より前の日付（3 行）は、記録としてそのまま残ります。',
    },
  ],
  [
    'adminSettingsMessages.hoursForm.errors.sameDate',
    hoursForm.errors.sameDate(1),
    {
      en: 'This date is the same as that of row 1. A date takes one row.',
      ja: 'この日付は、1 行目と同じです。1 つの日付に入れられるのは 1 行です。',
    },
  ],
  [
    'adminSettingsMessages.form.nameDescription',
    form.nameDescription(255),
    {
      en: 'Up to 255 characters. Shown when customers look for a salon.',
      ja: '255 文字まで。お客様がサロンを探すときに出ます。',
    },
  ],
  [
    'adminSettingsMessages.form.kept',
    form.kept('Asia/Tokyo', 'JPY'),
    {
      en: 'The time zone (Asia/Tokyo) and the currency (JPY) cannot be changed. The times of the bookings and the prices are read in them.',
      ja: 'タイムゾーン（Asia/Tokyo）と通貨（JPY）は、変えられません。予約の日時と料金は、これらで読みます。',
    },
  ],
  [
    'adminSettingsMessages.form.currencyChoice',
    form.currencyChoice('JPY', { en: 'Japanese Yen', ja: '日本円' }),
    { en: 'JPY (Japanese Yen)', ja: 'JPY（日本円）' },
  ],
  [
    'adminSettingsMessages.entry.added',
    entry.added(NAME),
    {
      en: 'Registered the salon “表参道店”. Enter its hours and its menu, then accept online bookings.',
      ja: 'サロン「表参道店」を登録しました。営業時間とメニューを入れてから、オンライン予約を受け付けてください。',
    },
  ],
  [
    'adminSettingsMessages.removal.description',
    removal.description(NAME),
    {
      en: 'When the salon “表参道店” is removed, it is taken off the list of salons and the screens of the customers, and the staff can no longer use its screens. A removed salon cannot be restored. It cannot be removed while a booking is not finished.',
      ja: 'サロン「表参道店」を削除すると、サロンの一覧とお客様の画面から消え、スタッフはこのサロンの画面を使えなくなります。削除したサロンは、元に戻せません。終わっていない予約があるあいだは、削除できません。',
    },
  ],
  [
    'adminSettingsMessages.removal.question',
    removal.question(NAME),
    {
      en: 'Remove the salon “表参道店”?',
      ja: 'サロン「表参道店」を削除しますか？',
    },
  ],
  [
    'adminSettingsMessages.removal.done',
    removal.done(NAME),
    {
      en: 'Removed the salon “表参道店”.',
      ja: 'サロン「表参道店」を削除しました。',
    },
  ],
  [
    'adminSettingsMessages.removal.bookingsUnfinished',
    removal.bookingsUnfinished(NAME),
    {
      en: 'The salon “表参道店” has bookings that are not finished (draft, awaiting confirmation, confirmed, in progress), so it cannot be removed. In the booking ledger, complete them, cancel them or mark them as no-shows, then try again.',
      ja: 'サロン「表参道店」には、終わっていない予約（下書き、確定待ち、確定、施術中）があるため、削除できません。予約台帳で、予約を完了するか、キャンセルするか、無断キャンセルにしてから、もう一度お試しください。',
    },
  ],
]

describe('the messages of the settings of the admin application', () => {
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
      messagesOf({ adminSettingsMessages }, '').made.toSorted(),
    )
  })

  it('should write the hours of a day of the week without a break or a period as the hours alone', () => {
    // Assert
    expect(hours.ofTheWeek(OPEN, null, null)).toEqual(OPEN)
  })

  it('should count one review and one row as one', () => {
    // Assert
    expect(record.ratingOf(RATING, 1)).toEqual({
      en: '4.0 (1 review)',
      ja: '4.0（1 件のレビュー）',
    })
    expect(hoursForm.pastKept(1).en).toBe(
      'The dates before today (1 row) stay as a record.',
    )
  })

  it('should name the buttons of the form in the sentence of hours changed meanwhile', () => {
    // Assert
    expect(hoursForm.changedMeanwhile.en).toContain(`“${hoursForm.submit.en}”`)
    expect(hoursForm.changedMeanwhile.en).toContain(`“${hoursForm.cancel.en}”`)
    expect(hoursForm.changedMeanwhile.ja).toContain(
      `「${hoursForm.submit.ja}」`,
    )
    expect(hoursForm.changedMeanwhile.ja).toContain(
      `「${hoursForm.cancel.ja}」`,
    )
  })
})
