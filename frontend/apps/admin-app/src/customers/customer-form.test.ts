import type { ModelsCustomerResponse } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { aCustomer } from '../bookings/components/examples'
import {
  afterCustomerWrite,
  type CustomerWriteAttempt,
  NO_REFERRER,
  PREFERENCE_NOTES,
  PREFERRED_SERVICES,
  type Referrer,
  readCustomerChange,
  readCustomerEntry,
  referrerIdOf,
  referrerNameOf,
} from './customer-form'

/** A customer of the ledger who referred others */
const REFERRER_ID = '7c1e4b9a-3d52-4f86-a0b7-9e2d6c8f1a45'

const TODAY = '2026-11-20'

/** The controls of the form as a new one holds them, with what a test fills in */
const FILLED: [string, string][] = [
  ['lastName', '山田'],
  ['firstName', '花子'],
  ['lastNameKana', ''],
  ['firstNameKana', ''],
  ['email', 'Hanako@Example.com'],
  ['phoneNumber', '090-1234-5678'],
  ['alternativePhone', ''],
  ['postalCode', ''],
  ['prefecture', ''],
  ['city', ''],
  ['address', ''],
  ['building', ''],
  ['birthDate', ''],
  ['gender', ''],
  ['occupation', ''],
  ['membershipTier', 'regular'],
  ['customerStatus', 'active'],
  ['isActive', 'on'],
  ['tags', ''],
  ['referralCode', ''],
  ['referredBy', ''],
  [PREFERENCE_NOTES, ''],
  ['hairType', ''],
  ['hairThickness', ''],
  ['scalpCondition', ''],
  ['notes', ''],
  ['internalNotes', ''],
]

/** A form filled in as `FILLED`, with other values for some controls, and checkboxes and kinds of service added */
const formOf = (
  values: Record<string, string> = {},
  added: [string, string][] = [],
): FormData => {
  const form = new FormData()
  for (const [name, value] of FILLED) {
    form.append(name, values[name] ?? value)
  }
  for (const [name, value] of added) {
    form.append(name, value)
  }

  return form
}

/** The form as it opens for a customer: what the ledger holds, at every control */
const formOfCustomer = (
  customer: ModelsCustomerResponse,
  values: Record<string, string> = {},
): FormData => {
  const checked: [string, string][] = customer.allowEmail
    ? [['allowEmail', 'on']]
    : []

  return formOf(
    {
      lastName: customer.lastName,
      firstName: customer.firstName,
      lastNameKana: customer.lastNameKana ?? '',
      firstNameKana: customer.firstNameKana ?? '',
      email: customer.email,
      phoneNumber: customer.phoneNumber,
      membershipTier: customer.membershipTier,
      customerStatus: customer.customerStatus,
      tags: customer.tags.join('、'),
      referredBy: customer.referredBy ?? '',
      ...values,
    },
    checked,
  )
}

describe('readCustomerEntry', () => {
  it('should read a new customer, with nothing as null and nobody who referred them', () => {
    // Act
    const read = readCustomerEntry(formOf(), TODAY)

    // Assert
    expect(read).toEqual({
      type: 'valid',
      request: {
        lastName: '山田',
        firstName: '花子',
        lastNameKana: null,
        firstNameKana: null,
        email: 'Hanako@Example.com',
        phoneNumber: '090-1234-5678',
        alternativePhone: null,
        postalCode: null,
        prefecture: null,
        city: null,
        address: null,
        building: null,
        birthDate: null,
        gender: null,
        occupation: null,
        membershipTier: 'regular',
        preferences: null,
        notes: null,
        internalNotes: null,
        tags: [],
        referredBy: null,
        referralCode: null,
        allowMarketing: false,
        allowSms: false,
        allowEmail: false,
        isActive: true,
        hairType: null,
        hairThickness: null,
        scalpCondition: null,
        customerStatus: 'active',
      },
    })
  })

  it('should read the customer who referred the new one, as the form holds them', () => {
    // Act
    const read = readCustomerEntry(formOf({ referredBy: REFERRER_ID }), TODAY)

    // Assert
    expect(read).toMatchObject({
      type: 'valid',
      request: { referredBy: REFERRER_ID },
    })
  })

  it('should read every value that was given, without the spaces around it', () => {
    // Act
    const read = readCustomerEntry(
      formOf(
        {
          lastName: ' 山田 ',
          lastNameKana: 'ヤマダ',
          firstNameKana: 'ハナコ',
          alternativePhone: '03-1234-5678',
          postalCode: '150-0001',
          prefecture: '東京都',
          city: '渋谷区',
          address: '神宮前 4-1-1',
          building: 'ハイツ 101',
          birthDate: '1990-04-01',
          gender: 'female',
          occupation: '会社員',
          membershipTier: 'gold',
          customerStatus: 'vip',
          tags: 'VIP、常連、VIP',
          referralCode: 'HANAKO-2026',
          [PREFERENCE_NOTES]: ' 炭酸泉が好き ',
          hairType: 'wavy',
          hairThickness: 'thin',
          scalpCondition: 'sensitive',
          notes: '駐車場を使う',
          internalNotes: '前回、カラーで頭皮がしみた',
        },
        [
          ['allowEmail', 'on'],
          ['allowSms', 'on'],
          ['allowMarketing', 'on'],
          [PREFERRED_SERVICES, 'spa'],
          [PREFERRED_SERVICES, 'cut'],
        ],
      ),
      TODAY,
    )

    // Assert
    expect(read).toMatchObject({
      type: 'valid',
      request: {
        lastName: '山田',
        lastNameKana: 'ヤマダ',
        firstNameKana: 'ハナコ',
        alternativePhone: '03-1234-5678',
        postalCode: '150-0001',
        prefecture: '東京都',
        city: '渋谷区',
        address: '神宮前 4-1-1',
        building: 'ハイツ 101',
        birthDate: '1990-04-01',
        gender: 'female',
        occupation: '会社員',
        membershipTier: 'gold',
        customerStatus: 'vip',
        isActive: true,
        tags: ['VIP', '常連'],
        referralCode: 'HANAKO-2026',
        preferences: {
          preferredServices: ['cut', 'spa'],
          notes: '炭酸泉が好き',
        },
        hairType: 'wavy',
        hairThickness: 'thin',
        scalpCondition: 'sensitive',
        notes: '駐車場を使う',
        internalNotes: '前回、カラーで頭皮がしみた',
        allowEmail: true,
        allowSms: true,
        allowMarketing: true,
      },
    })
  })

  it('should read a customer who is not active when the checkbox is left unchecked', () => {
    // Arrange
    const form = formOf()
    form.delete('isActive')

    // Act, Assert
    expect(readCustomerEntry(form, TODAY)).toMatchObject({
      type: 'valid',
      request: { isActive: false },
    })
  })

  it('should read the kinds of service alone as what a customer likes', () => {
    // Act, Assert
    expect(
      readCustomerEntry(formOf({}, [[PREFERRED_SERVICES, 'color']]), TODAY),
    ).toMatchObject({
      type: 'valid',
      request: { preferences: { preferredServices: ['color'], notes: null } },
    })
  })

  it('should say what is missing', () => {
    // Act
    const read = readCustomerEntry(
      formOf({ lastName: ' ', firstName: '', email: '', phoneNumber: '' }),
      TODAY,
    )

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: {
        lastName: '姓を入力してください。',
        firstName: '名を入力してください。',
        email: 'メールアドレスを入力してください。',
        phoneNumber: '電話番号を入力してください。',
      },
    })
  })

  it.each<[string, Record<string, string>, Record<string, string>]>([
    [
      'names too long',
      { lastName: 'あ'.repeat(101), firstNameKana: 'ア'.repeat(101) },
      {
        lastName: '100 文字以内で入力してください。',
        firstNameKana: '100 文字以内で入力してください。',
      },
    ],
    ['a name of the longest length', { lastName: 'あ'.repeat(100) }, {}],
    [
      'an address of mail that is none',
      { email: 'hanako@' },
      {
        email:
          'メールアドレスは、hanako@example.com のような形で入力してください。',
      },
    ],
    [
      'an address of mail too long',
      { email: `${'a'.repeat(244)}@example.com` },
      { email: '255 文字以内で入力してください。' },
    ],
    [
      'phone numbers that are none',
      { phoneNumber: '090-1234', alternativePhone: '03-1234-567a' },
      {
        phoneNumber:
          '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。',
        alternativePhone:
          '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。',
      },
    ],
    [
      'the parts of an address too long',
      {
        postalCode: '1'.repeat(11),
        prefecture: 'あ'.repeat(51),
        city: 'あ'.repeat(101),
        address: 'あ'.repeat(256),
        building: 'あ'.repeat(256),
      },
      {
        postalCode: '10 文字以内で入力してください。',
        prefecture: '50 文字以内で入力してください。',
        city: '100 文字以内で入力してください。',
        address: '255 文字以内で入力してください。',
        building: '255 文字以内で入力してください。',
      },
    ],
    [
      'an occupation and a referral code too long',
      { occupation: 'あ'.repeat(101), referralCode: 'A'.repeat(51) },
      {
        occupation: '100 文字以内で入力してください。',
        referralCode: '50 文字以内で入力してください。',
      },
    ],
    [
      'a day of birth to come',
      { birthDate: '2026-11-21' },
      {
        birthDate:
          '生年月日は、1900 年 1 月 1 日から今日までの日付を入力してください。',
      },
    ],
    [
      'a day of birth before 1900',
      { birthDate: '1899-12-31' },
      {
        birthDate:
          '生年月日は、1900 年 1 月 1 日から今日までの日付を入力してください。',
      },
    ],
    [
      'values that are none of the choices',
      {
        gender: 'unknown',
        membershipTier: '',
        customerStatus: 'gone',
        hairType: 'bald',
        hairThickness: 'x',
        scalpCondition: 'y',
      },
      {
        gender: '選択肢から選んでください。',
        membershipTier: '選択肢から選んでください。',
        customerStatus: '選択肢から選んでください。',
        hairType: '選択肢から選んでください。',
        hairThickness: '選択肢から選んでください。',
        scalpCondition: '選択肢から選んでください。',
      },
    ],
  ])('should say what is wrong with %s', (_case, values, errors) => {
    // Act
    const read = readCustomerEntry(formOf(values), TODAY)

    // Assert
    expect(read.type === 'invalid' ? read.errors : {}).toEqual(errors)
  })

  it('should take today as a day of birth', () => {
    // Act, Assert
    expect(readCustomerEntry(formOf({ birthDate: TODAY }), TODAY).type).toBe(
      'valid',
    )
  })
})

describe('readCustomerChange', () => {
  const customer = aCustomer({
    tags: ['VIP'],
    lastNameKana: 'ヤマダ',
    firstNameKana: 'ハナコ',
    allowEmail: true,
  })

  it('should ask for nothing when the form is sent as it was opened', () => {
    // Act, Assert
    expect(
      readCustomerChange(formOfCustomer(customer), customer, TODAY),
    ).toEqual({ type: 'unchanged' })
  })

  it('should send the customer who referred them when another was chosen, and nothing else', () => {
    // Arrange
    const referred = aCustomer({ ...customer, referredBy: REFERRER_ID })
    const other = '2b8f5d1c-6e94-4a37-b1c0-8d4e7f2a9b63'

    // Act, Assert
    expect(
      readCustomerChange(
        formOfCustomer(referred, { referredBy: other }),
        referred,
        TODAY,
      ),
    ).toEqual({ type: 'valid', request: { referredBy: other } })
  })

  it('should send no referrer when the one they had was taken away', () => {
    // Arrange
    const referred = aCustomer({ ...customer, referredBy: REFERRER_ID })

    // Act, Assert
    expect(
      readCustomerChange(
        formOfCustomer(referred, { referredBy: '' }),
        referred,
        TODAY,
      ),
    ).toEqual({ type: 'valid', request: { referredBy: null } })
  })

  it('should ask for nothing when the referrer is the one the customer has', () => {
    // Arrange
    const referred = aCustomer({ ...customer, referredBy: REFERRER_ID })

    // Act, Assert
    expect(
      readCustomerChange(formOfCustomer(referred), referred, TODAY),
    ).toEqual({ type: 'unchanged' })
  })

  it('should take an address of mail written in capitals as the same', () => {
    // Act, Assert
    expect(
      readCustomerChange(
        formOfCustomer(customer, { email: 'HANAKO@example.com' }),
        customer,
        TODAY,
      ),
    ).toEqual({ type: 'unchanged' })
  })

  it('should take a customer whose values have spaces around them as the form shows them', () => {
    // Arrange
    const spaced = aCustomer({ ...customer, lastName: ' 山田 ', notes: ' ' })

    // Act, Assert
    expect(readCustomerChange(formOfCustomer(spaced), spaced, TODAY)).toEqual({
      type: 'unchanged',
    })
  })

  it('should send what was changed and nothing else', () => {
    // Act
    const read = readCustomerChange(
      formOfCustomer(customer, {
        phoneNumber: '080-9876-5432',
        lastNameKana: '',
        tags: 'VIP、常連',
        customerStatus: 'inactive',
        internalNotes: '電話に出ないことが多い',
      }),
      customer,
      TODAY,
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      request: {
        phoneNumber: '080-9876-5432',
        lastNameKana: null,
        tags: ['VIP', '常連'],
        customerStatus: 'inactive',
        internalNotes: '電話に出ないことが多い',
      },
    })
  })

  it.each<[string, Record<string, string>, Record<string, unknown>]>([
    ['a name', { firstName: '華子' }, { firstName: '華子' }],
    [
      'an address of mail',
      { email: 'new@example.com' },
      { email: 'new@example.com' },
    ],
    ['a rank', { membershipTier: 'gold' }, { membershipTier: 'gold' }],
    [
      'a day of birth',
      { birthDate: '1990-04-01' },
      { birthDate: '1990-04-01' },
    ],
    ['a gender', { gender: 'female' }, { gender: 'female' }],
    ['a building', { building: 'ハイツ 101' }, { building: 'ハイツ 101' }],
    ['the hair', { hairType: 'curly' }, { hairType: 'curly' }],
    ['a referral code', { referralCode: 'HANAKO' }, { referralCode: 'HANAKO' }],
    ['a note', { notes: '駐車場を使う' }, { notes: '駐車場を使う' }],
    [
      'what a customer likes',
      { [PREFERENCE_NOTES]: '静かに過ごしたい' },
      { preferences: { preferredServices: [], notes: '静かに過ごしたい' } },
    ],
  ])('should send a change of %s', (_case, values, request) => {
    // Act, Assert
    expect(
      readCustomerChange(formOfCustomer(customer, values), customer, TODAY),
    ).toEqual({ type: 'valid', request })
  })

  it('should send the permissions to reach a customer that were changed', () => {
    // Arrange
    const form = formOfCustomer(customer)
    form.delete('allowEmail')
    form.append('allowMarketing', 'on')

    // Act, Assert
    expect(readCustomerChange(form, customer, TODAY)).toEqual({
      type: 'valid',
      request: { allowEmail: false, allowMarketing: true },
    })
  })

  it('should clear what a customer likes when nothing is chosen and nothing written', () => {
    // Arrange
    const liking = aCustomer({
      ...customer,
      preferences: { preferredServices: ['cut'], notes: null },
    })

    // Act, Assert
    expect(readCustomerChange(formOfCustomer(liking), liking, TODAY)).toEqual({
      type: 'valid',
      request: { preferences: null },
    })
  })

  it('should keep what a customer likes when the form shows it as it is', () => {
    // Arrange
    const liking = aCustomer({
      ...customer,
      preferences: { preferredServices: ['spa', 'cut'], notes: ' 静かに ' },
    })
    const form = formOfCustomer(liking, { [PREFERENCE_NOTES]: '静かに' })
    form.append(PREFERRED_SERVICES, 'cut')
    form.append(PREFERRED_SERVICES, 'spa')

    // Act, Assert
    expect(readCustomerChange(form, liking, TODAY)).toEqual({
      type: 'unchanged',
    })
  })

  it('should say what is wrong before anything is compared', () => {
    // Act, Assert
    expect(
      readCustomerChange(
        formOfCustomer(customer, { email: '' }),
        customer,
        TODAY,
      ),
    ).toEqual({
      type: 'invalid',
      errors: { email: 'メールアドレスを入力してください。' },
    })
  })
})

describe('afterCustomerWrite', () => {
  it.each<
    [
      string,
      Exclude<CustomerWriteAttempt, { type: 'written' } | { type: 'notFound' }>,
      unknown,
    ]
  >([
    [
      'values refused at their controls, the first said of each',
      {
        type: 'invalid',
        values: [
          { field: 'birthDate', rule: 'too_big' },
          { field: 'tags.1', rule: 'custom' },
          { field: 'tags.0', rule: 'too_small' },
          { field: `${PREFERRED_SERVICES}.0`, rule: 'invalid_value' },
        ],
      },
      {
        message: undefined,
        errors: {
          birthDate:
            '生年月日は、1900 年 1 月 1 日から今日までの日付を入力してください。',
          tags: 'この値は受け付けられませんでした。入力を確かめてください。',
          [PREFERRED_SERVICES]:
            'この値は受け付けられませんでした。入力を確かめてください。',
        },
      },
    ],
    [
      'what a customer likes, refused as a whole',
      { type: 'invalid', values: [{ field: 'preferences', rule: 'custom' }] },
      {
        message: undefined,
        errors: {
          [PREFERRED_SERVICES]:
            'この値は受け付けられませんでした。入力を確かめてください。',
        },
      },
    ],
    [
      'a referrer who is not in the ledger',
      { type: 'invalid', values: [{ field: 'referredBy', rule: 'not_found' }] },
      {
        message: undefined,
        errors: {
          referredBy:
            '選んだお客様は、台帳にいません。紹介元を選び直すか、外してください。',
        },
      },
    ],
    [
      'the customer themselves as their referrer',
      { type: 'invalid', values: [{ field: 'referredBy', rule: 'circular' }] },
      {
        message: undefined,
        errors: {
          referredBy:
            'お客様ご自身は、紹介元に選べません。ほかのお客様を選んでください。',
        },
      },
    ],
    [
      'a value the form has no control for',
      {
        type: 'invalid',
        values: [{ field: 'loyaltyPoints', rule: 'unrecognized_keys' }],
      },
      {
        message: '入力した内容を確かめて、もう一度お試しください。',
        errors: {},
      },
    ],
    [
      'an address of mail another customer has',
      { type: 'duplicate', field: 'email' },
      {
        message: undefined,
        errors: {
          email:
            'このメールアドレスのお客様が、すでに台帳にいます。台帳で探すか、別のメールアドレスを入力してください。',
        },
      },
    ],
    [
      'a referral code another customer has',
      { type: 'duplicate', field: 'referralCode' },
      {
        message: undefined,
        errors: {
          referralCode:
            'この紹介コードは、ほかのお客様が使っています（台帳から削除したお客様も含みます）。別のコードを入力してください。',
        },
      },
    ],
    [
      'a refusal of the account',
      { type: 'forbidden' },
      { message: 'このアカウントでは、顧客台帳を扱えません。', errors: {} },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      {
        message:
          'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
        errors: {},
      },
    ],
  ])('should say after %s', (_case, outcome, said) => {
    // Act, Assert
    expect(afterCustomerWrite(outcome, 'entry')).toEqual(said)
  })

  it.each<['entry' | 'change', string]>([
    [
      'entry',
      'お客様を登録できませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
    [
      'change',
      '台帳を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])('should say that the %s failed', (write, message) => {
    // Act, Assert
    expect(afterCustomerWrite({ type: 'failed' }, write)).toEqual({
      message,
      errors: {},
    })
  })
})

describe('the referrer', () => {
  it.each<[string, Referrer, string, string]>([
    ['nobody', NO_REFERRER, '', 'なし'],
    [
      'a customer of the ledger',
      { type: 'customer', id: REFERRER_ID, name: '山田 花子' },
      REFERRER_ID,
      '山田 花子 様',
    ],
    [
      'a customer who was removed',
      { type: 'gone', id: REFERRER_ID },
      REFERRER_ID,
      '台帳にいないお客様',
    ],
  ])('should hold and name %s', (_case, referrer, id, name) => {
    // Act, Assert
    expect([referrerIdOf(referrer), referrerNameOf(referrer)]).toEqual([
      id,
      name,
    ])
  })
})
