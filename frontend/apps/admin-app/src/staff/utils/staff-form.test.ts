import type { ModelsStaffUpdateRequest } from '@beauty-salon-frontend/api-client'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminStaffMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { describe, expect, it } from 'vitest'
import { aNewMember, aStaffMember } from '../components/examples'
import {
  afterStaffWrite,
  readStaffChange,
  readStaffEntry,
  type StaffWriteAttempt,
} from './staff-form'

/** What keeps the member of the account active */
const OWN_RECORD_STAYS_ACTIVE =
  adminStaffMessages.form.errors.ownRecordStaysActive

/** The values of a member as the form of `aStaffMember` holds them */
const FILLED: Record<string, string> = {
  lastName: '田中',
  firstName: '美咲',
  lastNameKana: 'タナカ',
  firstNameKana: 'ミサキ',
  displayName: '田中 美咲',
  email: 'misaki.tanaka@example.com',
  phoneNumber: '090-1234-5678',
  alternativePhone: '',
  staffCode: 'STF010',
  level: 'senior',
  position: 'トップスタイリスト',
  employmentType: '正社員',
  hireDate: '2018-04-01',
  baseSalary: '280000',
  commissionRate: '12.5',
  specialties: 'カット、カラー',
  certifications: '美容師免許、管理美容師',
  yearsOfExperience: '8',
  bio: 'ショートカットと、透明感のあるカラーが得意です。\nお気軽にご相談ください。',
  imageUrl: 'https://photos.example.com/staff/misaki.jpg',
  canReceiveBookings: 'on',
  maxConcurrentBookings: '2',
  bufferTimeBefore: '0',
  bufferTimeAfter: '15',
  isActive: 'on',
}

/** A form with the values of `FILLED` changed; `undefined` leaves the control out, as an unchecked box is */
const formOf = (changes: Record<string, string | undefined> = {}): FormData => {
  const values = new FormData()
  for (const [name, value] of Object.entries({ ...FILLED, ...changes })) {
    if (value !== undefined) {
      values.set(name, value)
    }
  }

  return values
}

const {
  id: _id,
  salonId: _s,
  userId: _u,
  createdAt: _c,
  updatedAt: _up,
  ...fields
} = aStaffMember()

describe('readStaffEntry', () => {
  it('should read every value of a member, as the API takes them', () => {
    expect(readStaffEntry(formOf())).toEqual({
      type: 'valid',
      value: fields,
    })
  })

  it('should send what was left empty as nothing, and a member who neither works nor takes bookings yet', () => {
    // Act
    const read = readStaffEntry(
      formOf({
        lastNameKana: ' ',
        firstNameKana: '',
        staffCode: '',
        position: '',
        employmentType: '',
        hireDate: '',
        baseSalary: '',
        commissionRate: '',
        specialties: '',
        certifications: '、 ,',
        yearsOfExperience: '',
        bio: '  ',
        imageUrl: '',
        canReceiveBookings: undefined,
        isActive: undefined,
      }),
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        ...fields,
        lastNameKana: null,
        firstNameKana: null,
        staffCode: null,
        position: null,
        employmentType: null,
        hireDate: null,
        baseSalary: null,
        commissionRate: null,
        specialties: [],
        certifications: [],
        yearsOfExperience: null,
        bio: null,
        imageUrl: null,
        canReceiveBookings: false,
        isActive: false,
      },
    })
  })

  it('should read the numbers as a person types them, and the words of a list once each', () => {
    // Act
    const read = readStaffEntry(
      formOf({
        baseSalary: '２８０，０００',
        commissionRate: '１２．５',
        maxConcurrentBookings: ' 2 ',
        specialties: 'カット, カラー，カット',
      }),
    )

    // Assert
    expect(read).toMatchObject({
      type: 'valid',
      value: {
        baseSalary: 280000,
        commissionRate: 12.5,
        maxConcurrentBookings: 2,
        specialties: ['カット', 'カラー'],
      },
    })
  })

  it.each<[string, Record<string, string>]>([
    [
      'the most a value may be',
      {
        commissionRate: '100',
        yearsOfExperience: '100',
        baseSalary: '2147483647',
        maxConcurrentBookings: '10',
        bufferTimeBefore: '120',
        bufferTimeAfter: '120',
        hireDate: '2999-12-31',
      },
    ],
    [
      'the least a value may be',
      {
        commissionRate: '0.01',
        yearsOfExperience: '0',
        baseSalary: '0',
        maxConcurrentBookings: '1',
        hireDate: '1900-01-01',
      },
    ],
    [
      'texts as long as they may be',
      {
        lastName: 'あ'.repeat(100),
        displayName: 'あ'.repeat(255),
        staffCode: 'A'.repeat(50),
        employmentType: 'あ'.repeat(50),
        imageUrl: `https://photos.example.com/${'a'.repeat(473)}`,
      },
    ],
  ])('should take %s', (_case, changes) => {
    expect(readStaffEntry(formOf(changes)).type).toBe('valid')
  })

  it.each<[string, Record<string, string>, string, LocalizedText]>([
    [
      'no family name',
      { lastName: ' ' },
      'lastName',
      { en: 'Enter the last name.', ja: '姓を入力してください。' },
    ],
    [
      'a given name too long',
      { firstName: 'あ'.repeat(101) },
      'firstName',
      {
        en: 'Enter up to 100 characters.',
        ja: '100 文字以内で入力してください。',
      },
    ],
    [
      'a kana too long',
      { lastNameKana: 'ア'.repeat(101) },
      'lastNameKana',
      {
        en: 'Enter up to 100 characters.',
        ja: '100 文字以内で入力してください。',
      },
    ],
    [
      'no name for the customers',
      { displayName: '' },
      'displayName',
      { en: 'Enter the display name.', ja: '表示名を入力してください。' },
    ],
    [
      'a name for the customers too long',
      { displayName: 'あ'.repeat(256) },
      'displayName',
      {
        en: 'Enter up to 255 characters.',
        ja: '255 文字以内で入力してください。',
      },
    ],
    [
      'an address of mail that is none',
      { email: 'misaki' },
      'email',
      {
        en: 'Enter an email address in a form such as hanako@example.com.',
        ja: 'メールアドレスは、hanako@example.com のような形で入力してください。',
      },
    ],
    [
      'a phone number too short',
      { phoneNumber: '090-1234' },
      'phoneNumber',
      {
        en: 'Enter a phone number in digits and hyphens, with the area code (for example 03-1234-5678).',
        ja: '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。',
      },
    ],
    [
      'a second phone number of letters',
      { alternativePhone: 'なし' },
      'alternativePhone',
      {
        en: 'Enter a phone number in digits and hyphens, with the area code (for example 03-1234-5678).',
        ja: '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。',
      },
    ],
    [
      'a staff code too long',
      { staffCode: 'A'.repeat(51) },
      'staffCode',
      {
        en: 'Enter up to 50 characters.',
        ja: '50 文字以内で入力してください。',
      },
    ],
    [
      'no level',
      { level: '' },
      'level',
      { en: 'Choose the level.', ja: 'レベルを選んでください。' },
    ],
    [
      'a level that is none',
      { level: 'master' },
      'level',
      { en: 'Choose the level.', ja: 'レベルを選んでください。' },
    ],
    [
      'a position too long',
      { position: 'あ'.repeat(101) },
      'position',
      {
        en: 'Enter up to 100 characters.',
        ja: '100 文字以内で入力してください。',
      },
    ],
    [
      'a kind of employment too long',
      { employmentType: 'あ'.repeat(51) },
      'employmentType',
      {
        en: 'Enter up to 50 characters.',
        ja: '50 文字以内で入力してください。',
      },
    ],
    [
      'a hire before 1900',
      { hireDate: '1899-12-31' },
      'hireDate',
      {
        en: 'Enter a hire date from January 1, 1900 to December 31, 2999.',
        ja: '入社日は、1900 年 1 月 1 日から 2999 年 12 月 31 日までの日付を入力してください。',
      },
    ],
    [
      'a hire on no day',
      { hireDate: '2026-02-30' },
      'hireDate',
      {
        en: 'Enter a hire date from January 1, 1900 to December 31, 2999.',
        ja: '入社日は、1900 年 1 月 1 日から 2999 年 12 月 31 日までの日付を入力してください。',
      },
    ],
    [
      'a salary below nothing',
      { baseSalary: '-1' },
      'baseSalary',
      {
        en: 'Enter the base salary as a whole number of yen from 0.',
        ja: '基本給は、0 以上の円の整数で入力してください。',
      },
    ],
    [
      'a salary of a fraction of a yen',
      { baseSalary: '1000.5' },
      'baseSalary',
      {
        en: 'Enter the base salary as a whole number of yen from 0.',
        ja: '基本給は、0 以上の円の整数で入力してください。',
      },
    ],
    [
      'a salary beyond the column',
      { baseSalary: '2147483648' },
      'baseSalary',
      {
        en: 'Enter the base salary as a whole number of yen from 0.',
        ja: '基本給は、0 以上の円の整数で入力してください。',
      },
    ],
    [
      'a rate above a hundred',
      { commissionRate: '100.01' },
      'commissionRate',
      {
        en: 'Enter the commission rate as a number from 0 to 100, with up to 2 decimal places.',
        ja: '歩合率は、0 から 100 までの数で、小数第 2 位まで入力してください。',
      },
    ],
    [
      'a rate of three decimals',
      { commissionRate: '12.345' },
      'commissionRate',
      {
        en: 'Enter the commission rate as a number from 0 to 100, with up to 2 decimal places.',
        ja: '歩合率は、0 から 100 までの数で、小数第 2 位まで入力してください。',
      },
    ],
    [
      'years above a hundred',
      { yearsOfExperience: '101' },
      'yearsOfExperience',
      {
        en: 'Enter the years of experience as a whole number from 0 to 100.',
        ja: '経験年数は、0 から 100 までの整数で入力してください。',
      },
    ],
    [
      'years of a fraction',
      { yearsOfExperience: '2.5' },
      'yearsOfExperience',
      {
        en: 'Enter the years of experience as a whole number from 0 to 100.',
        ja: '経験年数は、0 から 100 までの整数で入力してください。',
      },
    ],
    [
      'an address of a photo that is not of the web',
      { imageUrl: 'ftp://photos.example.com/a.jpg' },
      'imageUrl',
      {
        en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com), up to 500 characters.',
        ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
      },
    ],
    [
      'an address of a photo too long',
      { imageUrl: `https://photos.example.com/${'a'.repeat(474)}` },
      'imageUrl',
      {
        en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com), up to 500 characters.',
        ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
      },
    ],
    [
      'no bookings at a time',
      { maxConcurrentBookings: '0' },
      'maxConcurrentBookings',
      {
        en: 'Enter the number of concurrent bookings as a whole number from 1 to 10.',
        ja: '同時に担当できる予約の数は、1 から 10 までの整数で入力してください。',
      },
    ],
    [
      'more bookings at a time than ten',
      { maxConcurrentBookings: '11' },
      'maxConcurrentBookings',
      {
        en: 'Enter the number of concurrent bookings as a whole number from 1 to 10.',
        ja: '同時に担当できる予約の数は、1 から 10 までの整数で入力してください。',
      },
    ],
    [
      'no bookings at a time written',
      { maxConcurrentBookings: '' },
      'maxConcurrentBookings',
      {
        en: 'Enter the number of concurrent bookings as a whole number from 1 to 10.',
        ja: '同時に担当できる予約の数は、1 から 10 までの整数で入力してください。',
      },
    ],
    [
      'a time before a booking above two hours',
      { bufferTimeBefore: '121' },
      'bufferTimeBefore',
      {
        en: 'Enter whole minutes from 0 to 120.',
        ja: '0 から 120 までの分を、整数で入力してください。',
      },
    ],
    [
      'no time after a booking written',
      { bufferTimeAfter: '' },
      'bufferTimeAfter',
      {
        en: 'Enter whole minutes from 0 to 120.',
        ja: '0 から 120 までの分を、整数で入力してください。',
      },
    ],
  ])('should refuse %s at its control', (_case, changes, control, message) => {
    expect(readStaffEntry(formOf(changes))).toEqual({
      type: 'invalid',
      errors: { [control]: message },
    })
  })
})

describe('readStaffChange', () => {
  it('should find nothing changed in the values the member was opened with, compared as the form reads them', () => {
    // Arrange
    const shown = aStaffMember({ lastName: ' 田中 ', alternativePhone: ' ' })

    // Act
    const change = readStaffChange(
      formOf({ email: 'Misaki.Tanaka@Example.com' }),
      shown,
      false,
    )

    // Assert
    expect(change).toEqual({ type: 'unchanged' })
  })

  it('should send what was changed and nothing else, a value cleared as nothing', () => {
    // Act
    const change = readStaffChange(
      formOf({
        displayName: 'MISAKI',
        position: '',
        specialties: 'カット、カラー、パーマ',
        commissionRate: '15',
        canReceiveBookings: undefined,
      }),
      aStaffMember(),
      false,
    )

    // Assert
    expect(change).toEqual({
      type: 'valid',
      value: {
        displayName: 'MISAKI',
        position: null,
        specialties: ['カット', 'カラー', 'パーマ'],
        commissionRate: 15,
        canReceiveBookings: false,
      },
    })
  })

  it.each<[string, Record<string, string>, ModelsStaffUpdateRequest]>([
    [
      'the other telephone number',
      { alternativePhone: '03-1234-5678' },
      { alternativePhone: '03-1234-5678' },
    ],
    ['the introduction', { bio: '' }, { bio: null }],
    [
      'the time kept free before a booking',
      { bufferTimeBefore: '10' },
      { bufferTimeBefore: 10 },
    ],
  ])('should send %s alone when it alone was changed', (_, changes, value) => {
    // Act
    const change = readStaffChange(formOf(changes), aStaffMember(), false)

    // Assert
    expect(change).toEqual({ type: 'valid', value })
  })

  it('should fill in what the ledger did not have of a member', () => {
    // Act
    const change = readStaffChange(
      formOf({ lastNameKana: 'サトウ', firstNameKana: 'ケン', bio: '' }),
      aNewMember(),
      false,
    )

    // Assert
    expect(change).toMatchObject({
      type: 'valid',
      value: {
        lastName: '田中',
        lastNameKana: 'サトウ',
        firstNameKana: 'ケン',
        staffCode: 'STF010',
        isActive: true,
      },
    })
  })

  it('should keep the member the account is linked to active', () => {
    expect(
      readStaffChange(formOf({ isActive: undefined }), aStaffMember(), true),
    ).toEqual({
      type: 'invalid',
      errors: { isActive: OWN_RECORD_STAYS_ACTIVE },
    })
  })

  it('should let the account change anything else of its own member', () => {
    expect(
      readStaffChange(formOf({ position: 'オーナー' }), aStaffMember(), true),
    ).toEqual({ type: 'valid', value: { position: 'オーナー' } })
  })

  it('should leave an inactive member of the account inactive without a word', () => {
    expect(
      readStaffChange(
        formOf({ isActive: undefined }),
        aStaffMember({ isActive: false }),
        true,
      ),
    ).toEqual({ type: 'unchanged' })
  })

  it('should say what is wrong before anything is compared', () => {
    expect(
      readStaffChange(formOf({ email: '' }), aStaffMember(), false),
    ).toEqual({
      type: 'invalid',
      errors: {
        email: {
          en: 'Enter an email address.',
          ja: 'メールアドレスを入力してください。',
        },
      },
    })
  })
})

describe('afterStaffWrite', () => {
  it('should say at their controls what the API refused, every entry of a list at the list', () => {
    expect(
      afterStaffWrite(
        {
          type: 'invalid',
          values: [
            { field: 'specialties.1', rule: 'too_small' },
            { field: 'hireDate', rule: 'too_big' },
            { field: 'imageUrl', rule: 'invalid_format' },
            { field: 'salonId', rule: 'unrecognized_keys' },
          ],
        },
        'entry',
      ),
    ).toEqual({
      message: undefined,
      errors: {
        specialties: {
          en: 'This value was not accepted. Check what you entered.',
          ja: 'この値は受け付けられませんでした。入力を確かめてください。',
        },
        hireDate: {
          en: 'Enter a hire date from January 1, 1900 to December 31, 2999.',
          ja: '入社日は、1900 年 1 月 1 日から 2999 年 12 月 31 日までの日付を入力してください。',
        },
        imageUrl: {
          en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com), up to 500 characters.',
          ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
        },
      },
    })
  })

  it('should ask to check the values when the API refused none of the controls', () => {
    expect(
      afterStaffWrite(
        { type: 'invalid', values: [{ field: '', rule: 'invalid_type' }] },
        'change',
      ),
    ).toEqual({
      message: {
        en: 'Check what you entered and try again.',
        ja: '入力した内容を確かめて、もう一度お試しください。',
      },
      errors: {},
    })
  })

  it.each<
    [
      string,
      Exclude<StaffWriteAttempt, { type: 'written' } | { type: 'notFound' }>,
      string,
      LocalizedText,
    ]
  >([
    [
      'an address of mail',
      { type: 'duplicate', field: 'email' },
      'email',
      {
        en: 'A staff member with this email address is in the ledger already. Enter another email address.',
        ja: 'このメールアドレスのスタッフが、すでに台帳にいます。別のメールアドレスを入力してください。',
      },
    ],
    [
      'a staff code',
      { type: 'duplicate', field: 'staffCode' },
      'staffCode',
      {
        en: 'Another staff member uses this staff code (staff members removed from the ledger included). Enter another code.',
        ja: 'このスタッフコードは、ほかのスタッフが使っています（台帳から削除したスタッフも含みます）。別のコードを入力してください。',
      },
    ],
    [
      'the deactivation of the own member',
      { type: 'ownRecord' },
      'isActive',
      OWN_RECORD_STAYS_ACTIVE,
    ],
  ])(
    'should say at its control what keeps %s from being written',
    (_case, outcome, control, message) => {
      expect(afterStaffWrite(outcome, 'change')).toEqual({
        message: undefined,
        errors: { [control]: message },
      })
    },
  )

  it.each<
    [
      string,
      Exclude<StaffWriteAttempt, { type: 'written' } | { type: 'notFound' }>,
      'entry' | 'change',
      LocalizedText,
    ]
  >([
    [
      'a refusal of the account',
      { type: 'forbidden' },
      'entry',
      {
        en: 'This account cannot keep the staff ledger of this salon.',
        ja: 'このアカウントでは、このサロンのスタッフ台帳を扱えません。',
      },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      'change',
      {
        en: 'There are too many requests. Wait a while and try again.',
        ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      'a failed registration',
      { type: 'failed' },
      'entry',
      {
        en: 'Could not register the staff member. Check your connection and try again.',
        ja: 'スタッフを登録できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
    [
      'a failed change',
      { type: 'failed' },
      'change',
      {
        en: 'Could not save the staff member. Check your connection and try again.',
        ja: 'スタッフ情報を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])(
    'should say above the form what came of %s',
    (_case, outcome, write, message) => {
      expect(afterStaffWrite(outcome, write)).toEqual({ message, errors: {} })
    },
  )
})
