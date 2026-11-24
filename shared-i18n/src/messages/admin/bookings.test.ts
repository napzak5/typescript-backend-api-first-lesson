import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import { messagesOf } from '../__tests__/found-messages'
import { termMessages } from '../ui/terms'
import { adminBookingMessages } from './index'

const { details, entry, frame, ledger, moves } = adminBookingMessages

/** A day and the hours of a booking, as the formats write them */
const DAY = { en: 'Fri, November 20, 2026', ja: '2026年11月20日（金）' }
const HOURS = { en: '10:00–11:00', ja: '10:00〜11:00' }
const WHEN = adminBookingMessages.whenOf(DAY, HOURS)

/** A moment and amounts, as the formats write them */
const MOMENT = {
  en: 'Fri, November 20, 2026 at 10:05',
  ja: '2026年11月20日（金） 10:05',
}
const AMOUNT = { en: '¥5,500', ja: '￥5,500' }
const DISCOUNT = { en: '¥1,000', ja: '￥1,000' }

const { confirmed, in_progress, pending } = termMessages.bookingStatus

/** Every message that is made from a value, with the value and what it says */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'adminBookingMessages.frame.bookingOf',
    frame.bookingOf('BK-4F7H-2KQM', DAY, HOURS),
    {
      en: 'Booking BK-4F7H-2KQM (Fri, November 20, 2026, 10:00–11:00)',
      ja: '予約番号 BK-4F7H-2KQM（2026年11月20日（金） 10:00〜11:00）',
    },
  ],
  [
    'adminBookingMessages.whenOf',
    WHEN,
    {
      en: 'Fri, November 20, 2026, 10:00–11:00',
      ja: '2026年11月20日（金） 10:00〜11:00',
    },
  ],
  [
    'adminBookingMessages.lineNamed',
    adminBookingMessages.lineNamed(2),
    { en: 'Line 2', ja: '明細 2' },
  ],
  [
    'adminBookingMessages.linesNamed',
    adminBookingMessages.linesNamed([1, 3]),
    { en: 'Lines 1, 3', ja: '明細 1、3' },
  ],
  [
    'adminBookingMessages.amountWithTax',
    adminBookingMessages.amountWithTax(AMOUNT, DISCOUNT, true),
    {
      en: '¥5,500 (¥1,000 off) (tax included)',
      ja: '￥5,500（割引 ￥1,000）（税込）',
    },
  ],
  [
    'adminBookingMessages.ledger.bookingsOn',
    ledger.bookingsOn(DAY),
    {
      en: 'Bookings on Fri, November 20, 2026',
      ja: '2026年11月20日（金）の予約',
    },
  ],
  [
    'adminBookingMessages.ledger.noneOn',
    ledger.noneOn(DAY),
    {
      en: 'No bookings on Fri, November 20, 2026',
      ja: '2026年11月20日（金）の予約はありません',
    },
  ],
  [
    'adminBookingMessages.ledger.noneMatchingOn',
    ledger.noneMatchingOn(DAY),
    {
      en: 'No bookings on Fri, November 20, 2026 match the conditions',
      ja: '2026年11月20日（金）の予約のうち、条件に合うものはありません',
    },
  ],
  [
    'adminBookingMessages.ledger.table.servicesOf',
    ledger.table.servicesOf(['カット', 'カラー']),
    { en: 'カット, カラー', ja: 'カット、カラー' },
  ],
  [
    'adminBookingMessages.details.status.completion.description',
    details.status.completion.description(WHEN),
    {
      en: 'The booking of Fri, November 20, 2026, 10:00–11:00 will be completed. A completed booking cannot be undone.',
      ja: '2026年11月20日（金） 10:00〜11:00の予約を完了にします。完了にした予約は、元に戻せません。',
    },
  ],
  [
    'adminBookingMessages.details.status.completion.recordedStart',
    details.status.completion.recordedStart(MOMENT),
    {
      en: 'A date and time on the clock of the salon. Left empty, it stays as recorded when the treatment started (Fri, November 20, 2026 at 10:05).',
      ja: 'サロンの時計の日時。空欄のときは、施術を始めたときに記録した日時（2026年11月20日（金） 10:05）のままです。',
    },
  ],
  [
    'adminBookingMessages.details.status.cancellation.description',
    details.status.cancellation.description(WHEN),
    {
      en: 'The booking of Fri, November 20, 2026, 10:00–11:00 will be cancelled. A cancelled booking cannot be undone.',
      ja: '2026年11月20日（金） 10:00〜11:00の予約をキャンセルします。キャンセルした予約は、元に戻せません。',
    },
  ],
  [
    'adminBookingMessages.details.status.noShow.description',
    details.status.noShow.description(WHEN),
    {
      en: 'It will be recorded that the customer did not come to the booking of Fri, November 20, 2026, 10:00–11:00. This cannot be undone.',
      ja: '2026年11月20日（金） 10:00〜11:00の予約に、お客様が来店しなかったことを記録します。記録した予約は、元に戻せません。',
    },
  ],
  [
    'adminBookingMessages.details.changes.removal.description',
    details.changes.removal.description(WHEN),
    {
      en: 'The booking of Fri, November 20, 2026, 10:00–11:00 will be taken out of the ledger with its lines. This is for a booking made by mistake or made twice. Cancel a booking that will not take place instead of removing it. A removed booking cannot be brought back.',
      ja: '2026年11月20日（金） 10:00〜11:00の予約を、施術明細とともに台帳から取り除きます。誤って入れた予約や、重複した予約を取り除くためのものです。行われない予約は、削除せずにキャンセルしてください。削除した予約は、元に戻せません。',
    },
  ],
  [
    'adminBookingMessages.entry.lines.serviceOf',
    entry.lines.serviceOf(1),
    { en: 'Service of line 1', ja: '明細 1 のメニュー' },
  ],
  [
    'adminBookingMessages.entry.lines.staffOf',
    entry.lines.staffOf(1),
    { en: 'Staff of line 1', ja: '明細 1 の担当' },
  ],
  [
    'adminBookingMessages.entry.lines.startOf',
    entry.lines.startOf(1),
    { en: 'Start of line 1', ja: '明細 1 の開始' },
  ],
  [
    'adminBookingMessages.entry.lines.notesOf',
    entry.lines.notesOf(1),
    { en: 'Notes of line 1', ja: '明細 1 のメモ' },
  ],
  [
    'adminBookingMessages.entry.lines.removeLine',
    entry.lines.removeLine(2),
    { en: 'Remove line 2', ja: '明細 2 を外す' },
  ],
  [
    'adminBookingMessages.entry.lines.most',
    entry.lines.most({ en: '20', ja: '20' }),
    { en: 'Up to 20 lines.', ja: '明細は 20 までです。' },
  ],
  [
    'adminBookingMessages.entry.lines.serviceChoice',
    entry.lines.serviceChoice(
      'Ladies Cut',
      { en: '60 min', ja: '60 分' },
      true,
    ),
    { en: 'Ladies Cut (60 min)', ja: 'Ladies Cut（60 分）' },
  ],
  [
    'adminBookingMessages.entry.storedSource',
    entry.storedSource('fax'),
    { en: 'fax', ja: 'fax' },
  ],
  [
    'adminBookingMessages.entry.checked.unread',
    entry.checked.unread([1]),
    {
      en: 'Whether the staff of line 1 are free could not be checked. Check your connection and try again.',
      ja: '明細 1 の担当の空きを確かめられませんでした。通信の状態を確かめて、もう一度お試しください。',
    },
  ],
  [
    'adminBookingMessages.entry.checked.taken',
    entry.checked.taken([1, 3]),
    {
      en: 'The staff of lines 1, 3 have an overlapping booking. The time a staff member keeps free before and after a booking counts as well. Change the staff member or the start time.',
      ja: '明細 1、3 の担当に、重なる予約があります。担当の前後の空け時間も、重なりに数えます。担当か開始の時刻を変えてください。',
    },
  ],
  [
    'adminBookingMessages.moves.move.movedLine',
    moves.move.movedLine(1, 'カット'),
    { en: 'Line 1: カット', ja: '明細 1 カット' },
  ],
  [
    'adminBookingMessages.moves.move.movedHours',
    moves.move.movedHours(HOURS, { en: 'Unassigned', ja: '未定' }),
    { en: '10:00–11:00, staff: Unassigned', ja: '10:00〜11:00 担当 未定' },
  ],
  [
    'adminBookingMessages.moves.move.unmovable',
    moves.move.unmovable(in_progress, [pending, confirmed]),
    {
      en: 'This booking is in the status “In progress”, so its date, time and staff cannot be changed. They can be changed for bookings in these statuses: Awaiting confirmation, Confirmed.',
      ja: 'この予約は施術中のため、日時と担当を変えられません。日時と担当を変えられるのは、確定待ち、確定の予約です。',
    },
  ],
  [
    'adminBookingMessages.moves.addition.staffDescription',
    moves.addition.staffDescription(entry.lines.noStaff),
    {
      en: 'A line whose staff is “Not decided” takes nobody’s time.',
      ja: '「決めない」明細は、誰の時間も占有しません。',
    },
  ],
  [
    'adminBookingMessages.moves.addition.startTimeDescription',
    moves.addition.startTimeDescription(DAY),
    {
      en: 'A time on the clock of the salon, on the day of the visit (Fri, November 20, 2026).',
      ja: '来店日（2026年11月20日（金））の、サロンの時計の時刻です。',
    },
  ],
  [
    'adminBookingMessages.moves.addition.closed',
    moves.addition.closed(termMessages.bookingStatus.completed, [
      pending,
      confirmed,
      in_progress,
    ]),
    {
      en: 'This booking is in the status “Completed”, so no line can be added to it. The lines can be changed for bookings in these statuses: Awaiting confirmation, Confirmed, In progress.',
      ja: 'この予約は完了のため、施術明細を足せません。施術明細を変えられるのは、確定待ち、確定、施術中の予約です。',
    },
  ],
  [
    'adminBookingMessages.moves.addition.full',
    moves.addition.full({ en: '20', ja: '20' }),
    {
      en: 'A booking has up to 20 lines. No more can be added to this one.',
      ja: '施術明細は 20 件までです。この予約には、もう足せません。',
    },
  ],
  [
    'adminBookingMessages.moves.line.finalPriceOf',
    moves.line.finalPriceOf(AMOUNT, false),
    { en: '¥5,500 (before tax)', ja: '￥5,500（税別）' },
  ],
  [
    'adminBookingMessages.moves.line.doneAt',
    moves.line.doneAt(MOMENT),
    {
      en: 'Done (Fri, November 20, 2026 at 10:05)',
      ja: '済み（2026年11月20日（金） 10:05）',
    },
  ],
  [
    'adminBookingMessages.moves.line.when',
    moves.line.when(DAY, HOURS),
    {
      en: 'Fri, November 20, 2026, 10:00–11:00',
      ja: '2026年11月20日（金） 10:00〜11:00',
    },
  ],
  [
    'adminBookingMessages.moves.removal.lineOf',
    moves.removal.lineOf('カット', HOURS),
    { en: 'カット (10:00–11:00)', ja: 'カット（10:00〜11:00）' },
  ],
  [
    'adminBookingMessages.moves.removal.description',
    moves.removal.description(moves.removal.lineOf('カット', HOURS)),
    {
      en: 'カット (10:00–11:00) will be taken off the booking. The time and the amounts of the booking are worked out again from the lines that stay. A line taken off cannot be put back.',
      ja: 'カット（10:00〜11:00）を、予約から外します。予約の時刻と金額は、残る明細から算出し直します。外した明細は、元に戻せません。',
    },
  ],
  [
    'adminBookingMessages.moves.removal.closed',
    moves.removal.closed(termMessages.bookingStatus.cancelled),
    {
      en: 'This booking is in the status “Cancelled”, so no line can be taken off it.',
      ja: 'この予約はキャンセルのため、施術明細を外せません。',
    },
  ],
  [
    'adminBookingMessages.moves.check.overlapping',
    moves.check.overlapping('BK-4F7H-2KQM', HOURS),
    { en: 'BK-4F7H-2KQM 10:00–11:00', ja: 'BK-4F7H-2KQM 10:00〜11:00' },
  ],
]

describe('the messages of the bookings of the admin application', () => {
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
      messagesOf({ adminBookingMessages }, '').made.toSorted(),
    )
  })

  it('should name one line in the singular', () => {
    // Assert
    expect(adminBookingMessages.linesNamed([2])).toEqual({
      en: 'Line 2',
      ja: '明細 2',
    })
    expect(entry.checked.taken([2]).en).toMatch(/^The staff of line 2 have /)
  })

  it('should say that a service the salon takes no bookings for is not taken, and leave out an amount without a discount', () => {
    // Assert
    expect([
      entry.lines.serviceChoice(
        'Head Spa',
        { en: '30 min', ja: '30 分' },
        false,
      ),
      adminBookingMessages.amountWithTax(AMOUNT, null, true),
    ]).toEqual([
      {
        en: 'Head Spa (30 min) (not taking bookings)',
        ja: 'Head Spa（30 分）（受付停止中）',
      },
      { en: '¥5,500 (tax included)', ja: '￥5,500（税込）' },
    ])
  })
})
