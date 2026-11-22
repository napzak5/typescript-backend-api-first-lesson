import { describe, expect, it } from 'vitest'
import { aNewMember, aStaffMember } from '../components/examples'
import {
  afterStaffWrite,
  OWN_RECORD_STAYS_ACTIVE,
  readStaffChange,
  readStaffEntry,
  type StaffWriteAttempt,
} from './staff-form'

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

  it.each<[string, Record<string, string>, string, string]>([
    ['no family name', { lastName: ' ' }, 'lastName', '姓を入力してください。'],
    [
      'a given name too long',
      { firstName: 'あ'.repeat(101) },
      'firstName',
      '100 文字以内で入力してください。',
    ],
    [
      'a kana too long',
      { lastNameKana: 'ア'.repeat(101) },
      'lastNameKana',
      '100 文字以内で入力してください。',
    ],
    [
      'no name for the customers',
      { displayName: '' },
      'displayName',
      '表示名を入力してください。',
    ],
    [
      'a name for the customers too long',
      { displayName: 'あ'.repeat(256) },
      'displayName',
      '255 文字以内で入力してください。',
    ],
    [
      'an address of mail that is none',
      { email: 'misaki' },
      'email',
      'メールアドレスは、hanako@example.com のような形で入力してください。',
    ],
    [
      'a phone number too short',
      { phoneNumber: '090-1234' },
      'phoneNumber',
      '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。',
    ],
    [
      'a second phone number of letters',
      { alternativePhone: 'なし' },
      'alternativePhone',
      '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。',
    ],
    [
      'a staff code too long',
      { staffCode: 'A'.repeat(51) },
      'staffCode',
      '50 文字以内で入力してください。',
    ],
    ['no level', { level: '' }, 'level', 'レベルを選んでください。'],
    [
      'a level that is none',
      { level: 'master' },
      'level',
      'レベルを選んでください。',
    ],
    [
      'a position too long',
      { position: 'あ'.repeat(101) },
      'position',
      '100 文字以内で入力してください。',
    ],
    [
      'a kind of employment too long',
      { employmentType: 'あ'.repeat(51) },
      'employmentType',
      '50 文字以内で入力してください。',
    ],
    [
      'a hire before 1900',
      { hireDate: '1899-12-31' },
      'hireDate',
      '入社日は、1900 年 1 月 1 日から 2999 年 12 月 31 日までの日付を入力してください。',
    ],
    [
      'a hire on no day',
      { hireDate: '2026-02-30' },
      'hireDate',
      '入社日は、1900 年 1 月 1 日から 2999 年 12 月 31 日までの日付を入力してください。',
    ],
    [
      'a salary below nothing',
      { baseSalary: '-1' },
      'baseSalary',
      '基本給は、0 以上の円の整数で入力してください。',
    ],
    [
      'a salary of a fraction of a yen',
      { baseSalary: '1000.5' },
      'baseSalary',
      '基本給は、0 以上の円の整数で入力してください。',
    ],
    [
      'a salary beyond the column',
      { baseSalary: '2147483648' },
      'baseSalary',
      '基本給は、0 以上の円の整数で入力してください。',
    ],
    [
      'a rate above a hundred',
      { commissionRate: '100.01' },
      'commissionRate',
      '歩合率は、0 から 100 までの数で、小数第 2 位まで入力してください。',
    ],
    [
      'a rate of three decimals',
      { commissionRate: '12.345' },
      'commissionRate',
      '歩合率は、0 から 100 までの数で、小数第 2 位まで入力してください。',
    ],
    [
      'years above a hundred',
      { yearsOfExperience: '101' },
      'yearsOfExperience',
      '経験年数は、0 から 100 までの整数で入力してください。',
    ],
    [
      'years of a fraction',
      { yearsOfExperience: '2.5' },
      'yearsOfExperience',
      '経験年数は、0 から 100 までの整数で入力してください。',
    ],
    [
      'an address of a photo that is not of the web',
      { imageUrl: 'ftp://photos.example.com/a.jpg' },
      'imageUrl',
      'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
    ],
    [
      'an address of a photo too long',
      { imageUrl: `https://photos.example.com/${'a'.repeat(474)}` },
      'imageUrl',
      'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
    ],
    [
      'no bookings at a time',
      { maxConcurrentBookings: '0' },
      'maxConcurrentBookings',
      '同時に担当できる予約の数は、1 から 10 までの整数で入力してください。',
    ],
    [
      'more bookings at a time than ten',
      { maxConcurrentBookings: '11' },
      'maxConcurrentBookings',
      '同時に担当できる予約の数は、1 から 10 までの整数で入力してください。',
    ],
    [
      'no bookings at a time written',
      { maxConcurrentBookings: '' },
      'maxConcurrentBookings',
      '同時に担当できる予約の数は、1 から 10 までの整数で入力してください。',
    ],
    [
      'a time before a booking above two hours',
      { bufferTimeBefore: '121' },
      'bufferTimeBefore',
      '0 から 120 までの分を、整数で入力してください。',
    ],
    [
      'no time after a booking written',
      { bufferTimeAfter: '' },
      'bufferTimeAfter',
      '0 から 120 までの分を、整数で入力してください。',
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
      errors: { email: 'メールアドレスを入力してください。' },
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
        specialties:
          'この値は受け付けられませんでした。入力を確かめてください。',
        hireDate:
          '入社日は、1900 年 1 月 1 日から 2999 年 12 月 31 日までの日付を入力してください。',
        imageUrl:
          'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
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
      message: '入力した内容を確かめて、もう一度お試しください。',
      errors: {},
    })
  })

  it.each<
    [
      string,
      Exclude<StaffWriteAttempt, { type: 'written' } | { type: 'notFound' }>,
      string,
      string,
    ]
  >([
    [
      'an address of mail',
      { type: 'duplicate', field: 'email' },
      'email',
      'このメールアドレスのスタッフが、すでに台帳にいます。別のメールアドレスを入力してください。',
    ],
    [
      'a staff code',
      { type: 'duplicate', field: 'staffCode' },
      'staffCode',
      'このスタッフコードは、ほかのスタッフが使っています（台帳から削除したスタッフも含みます）。別のコードを入力してください。',
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
      string,
    ]
  >([
    [
      'a refusal of the account',
      { type: 'forbidden' },
      'entry',
      'このアカウントでは、このサロンのスタッフ台帳を扱えません。',
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      'change',
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      'a failed registration',
      { type: 'failed' },
      'entry',
      'スタッフを登録できませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
    [
      'a failed change',
      { type: 'failed' },
      'change',
      'スタッフ情報を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])(
    'should say above the form what came of %s',
    (_case, outcome, write, message) => {
      expect(afterStaffWrite(outcome, write)).toEqual({ message, errors: {} })
    },
  )
})
