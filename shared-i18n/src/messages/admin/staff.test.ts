import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import { messagesOf } from '../__tests__/found-messages'
import { adminStaffMessages } from './index'

const { entry, form, introduction, removal, values } = adminStaffMessages

/** A display name, which stands in every language as it was written */
const NAME = '田中 美咲'

/** Every message that is made from a value, with the value and what it says */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'adminStaffMessages.named',
    adminStaffMessages.named(NAME),
    { en: NAME, ja: NAME },
  ],
  [
    'adminStaffMessages.called',
    adminStaffMessages.called(NAME),
    { en: NAME, ja: '田中 美咲 さん' },
  ],
  [
    'adminStaffMessages.fullName',
    adminStaffMessages.fullName('田中 美咲', 'タナカ ミサキ'),
    { en: '田中 美咲 (タナカ ミサキ)', ja: '田中 美咲（タナカ ミサキ）' },
  ],
  [
    'adminStaffMessages.values.concurrentBookingsOf',
    values.concurrentBookingsOf(3),
    { en: 'Up to 3 bookings', ja: '3 件まで' },
  ],
  [
    'adminStaffMessages.values.yearsOf',
    values.yearsOf(12),
    { en: '12 years', ja: '12 年' },
  ],
  [
    'adminStaffMessages.introduction.yearsOfExperienceDescription',
    introduction.yearsOfExperienceDescription(100),
    { en: 'A whole number from 0 to 100.', ja: '0 から 100 までの整数。' },
  ],
  [
    'adminStaffMessages.introduction.yearsOfExperienceError',
    introduction.yearsOfExperienceError(100),
    {
      en: 'Enter the years of experience as a whole number from 0 to 100.',
      ja: '経験年数は、0 から 100 までの整数で入力してください。',
    },
  ],
  [
    'adminStaffMessages.form.commissionRateDescription',
    form.commissionRateDescription(100),
    {
      en: 'From 0 to 100, with up to 2 decimal places.',
      ja: '0 から 100 まで。小数第 2 位まで。',
    },
  ],
  [
    'adminStaffMessages.form.maxConcurrentBookingsDescription',
    form.maxConcurrentBookingsDescription(10),
    { en: 'From 1 to 10.', ja: '1 から 10 まで。' },
  ],
  [
    'adminStaffMessages.form.bufferTimeBeforeDescription',
    form.bufferTimeBeforeDescription(120),
    {
      en: 'Time to prepare. From 0 to 120.',
      ja: '準備の時間。0 から 120 まで。',
    },
  ],
  [
    'adminStaffMessages.form.bufferTimeAfterDescription',
    form.bufferTimeAfterDescription(120),
    {
      en: 'Time to tidy up. From 0 to 120.',
      ja: '片付けの時間。0 から 120 まで。',
    },
  ],
  [
    'adminStaffMessages.form.errors.commissionRate',
    form.errors.commissionRate(100),
    {
      en: 'Enter the commission rate as a number from 0 to 100, with up to 2 decimal places.',
      ja: '歩合率は、0 から 100 までの数で、小数第 2 位まで入力してください。',
    },
  ],
  [
    'adminStaffMessages.form.errors.maxConcurrentBookings',
    form.errors.maxConcurrentBookings(10),
    {
      en: 'Enter the number of concurrent bookings as a whole number from 1 to 10.',
      ja: '同時に担当できる予約の数は、1 から 10 までの整数で入力してください。',
    },
  ],
  [
    'adminStaffMessages.form.errors.bufferTime',
    form.errors.bufferTime(120),
    {
      en: 'Enter whole minutes from 0 to 120.',
      ja: '0 から 120 までの分を、整数で入力してください。',
    },
  ],
  [
    'adminStaffMessages.entry.done',
    entry.done(NAME),
    {
      en: 'Registered 田中 美咲 in the staff ledger.',
      ja: '田中 美咲 さんを、スタッフ台帳に登録しました。',
    },
  ],
  [
    'adminStaffMessages.removal.title',
    removal.title(NAME),
    {
      en: 'Remove 田中 美咲 from the staff ledger?',
      ja: '田中 美咲 さんを、スタッフ台帳から削除しますか？',
    },
  ],
  [
    'adminStaffMessages.removal.done',
    removal.done(NAME),
    {
      en: 'Removed 田中 美咲 from the staff ledger.',
      ja: '田中 美咲 さんを、スタッフ台帳から削除しました。',
    },
  ],
  [
    'adminStaffMessages.removal.busy',
    removal.busy(NAME),
    {
      en: '田中 美咲 is assigned to bookings that are not finished (Draft, Awaiting confirmation, Confirmed, In progress), so they cannot be removed. Complete or cancel those bookings, or give them to another staff member by changing their date and time, then remove the staff member.',
      ja: '田中 美咲 さんは、終わっていない予約（下書き、確定待ち、確定、施術中）を担当しているため、削除できません。予約を完了するか、キャンセルするか、日時の変更で担当をほかのスタッフに替えてから、削除してください。',
    },
  ],
]

describe('the messages of the staff of the admin application', () => {
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
      messagesOf({ adminStaffMessages }, '').made.toSorted(),
    )
  })

  it('should name a member alone when there is no reading of the name', () => {
    // Assert
    expect(adminStaffMessages.fullName(NAME, '')).toEqual({
      en: NAME,
      ja: NAME,
    })
  })

  it('should count one booking and one year as one', () => {
    // Assert
    expect(values.concurrentBookingsOf(1)).toEqual({
      en: 'Up to 1 booking',
      ja: '1 件まで',
    })
    expect(values.yearsOf(1)).toEqual({ en: '1 year', ja: '1 年' })
  })

  it('should say a refused removal and who keeps the ledger, one sentence after another', () => {
    // Assert
    expect(removal.forbidden).toEqual({
      en: 'This account cannot remove staff members of this salon. Only the owner of the salon and administrators can keep the staff ledger.',
      ja: 'このアカウントでは、このサロンのスタッフを削除できません。スタッフ台帳を扱えるのは、サロンのオーナーと管理者です。',
    })
  })
})
