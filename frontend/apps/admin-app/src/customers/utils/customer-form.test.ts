import type { ModelsCustomerResponse } from '@beauty-salon-frontend/api-client'
import {
  PREFERENCE_NOTES,
  PREFERRED_SERVICES,
} from '@beauty-salon-frontend/fields'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import { aCustomer } from '../../bookings/components/examples'
import {
  afterCustomerWrite,
  type CustomerWriteAttempt,
  NO_REFERRER,
  type Referrer,
  readCustomerChange,
  readCustomerEntry,
  referrerIdOf,
  referrerNameOf,
} from './customer-form'

/** A customer of the ledger who referred others */
const REFERRER_ID = '7c1e4b9a-3d52-4f86-a0b7-9e2d6c8f1a45'

const TODAY = '2026-11-20'

const LAST_NAME_MISSING = {
  en: 'Enter the last name.',
  ja: '姓を入力してください。',
}
const FIRST_NAME_MISSING = {
  en: 'Enter the first name.',
  ja: '名を入力してください。',
}
const EMAIL_MISSING = {
  en: 'Enter an email address.',
  ja: 'メールアドレスを入力してください。',
}
const PHONE_MISSING = {
  en: 'Enter a phone number.',
  ja: '電話番号を入力してください。',
}
const EMAIL_MALFORMED = {
  en: 'Enter an email address in a form such as hanako@example.com.',
  ja: 'メールアドレスは、hanako@example.com のような形で入力してください。',
}
const PHONE_MALFORMED = {
  en: 'Enter a phone number in digits and hyphens, with the area code (for example 03-1234-5678).',
  ja: '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。',
}
const BIRTH_DATE_OUT_OF_RANGE = {
  en: 'Enter a date of birth from January 1, 1900 to today.',
  ja: '生年月日は、1900 年 1 月 1 日から今日までの日付を入力してください。',
}
const UNLISTED = {
  en: 'Choose one of the options.',
  ja: '選択肢から選んでください。',
}
const REFUSED_VALUE = {
  en: 'This value was not accepted. Check what you entered.',
  ja: 'この値は受け付けられませんでした。入力を確かめてください。',
}
const CHECK_THE_VALUES = {
  en: 'Check what you entered and try again.',
  ja: '入力した内容を確かめて、もう一度お試しください。',
}
const REFERRER_ABSENT = {
  en: 'The customer you chose is not in the ledger. Choose the referrer again, or remove it.',
  ja: '選んだお客様は、台帳にいません。紹介元を選び直すか、外してください。',
}
const REFERRER_THEMSELVES = {
  en: 'A customer cannot be their own referrer. Choose another customer.',
  ja: 'お客様ご自身は、紹介元に選べません。ほかのお客様を選んでください。',
}
const EMAIL_TAKEN = {
  en: 'A customer with this email address is already in the ledger. Search for them in the ledger, or enter another email address.',
  ja: 'このメールアドレスのお客様が、すでに台帳にいます。台帳で探すか、別のメールアドレスを入力してください。',
}
const CODE_TAKEN = {
  en: 'Another customer uses this referral code (customers removed from the ledger included). Enter another code.',
  ja: 'この紹介コードは、ほかのお客様が使っています（台帳から削除したお客様も含みます）。別のコードを入力してください。',
}
const CANNOT_HANDLE = {
  en: 'This account cannot work with the customer ledger.',
  ja: 'このアカウントでは、顧客台帳を扱えません。',
}
const TOO_MANY_REQUESTS = {
  en: 'There are too many requests. Wait a while and try again.',
  ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
}
const ENTRY_FAILED = {
  en: 'The customer could not be registered. Check your connection and try again.',
  ja: 'お客様を登録できませんでした。通信の状態を確かめて、もう一度お試しください。',
}
const CHANGE_FAILED = {
  en: 'The record could not be changed. Check your connection and try again.',
  ja: '台帳を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
}
const GONE_REFERRER = {
  en: 'A customer no longer in the ledger',
  ja: '台帳にいないお客様',
}

/** What is said of a text longer than a control takes */
const upTo = (most: number): LocalizedText => ({
  en: `Enter up to ${most} characters.`,
  ja: `${most} 文字以内で入力してください。`,
})

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
      value: {
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
      value: { referredBy: REFERRER_ID },
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
      value: {
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
      value: { isActive: false },
    })
  })

  it('should read the kinds of service alone as what a customer likes', () => {
    // Act, Assert
    expect(
      readCustomerEntry(formOf({}, [[PREFERRED_SERVICES, 'color']]), TODAY),
    ).toMatchObject({
      type: 'valid',
      value: { preferences: { preferredServices: ['color'], notes: null } },
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
        lastName: LAST_NAME_MISSING,
        firstName: FIRST_NAME_MISSING,
        email: EMAIL_MISSING,
        phoneNumber: PHONE_MISSING,
      },
    })
  })

  it.each<[string, Record<string, string>, Record<string, LocalizedText>]>([
    [
      'names too long',
      { lastName: 'あ'.repeat(101), firstNameKana: 'ア'.repeat(101) },
      {
        lastName: upTo(100),
        firstNameKana: upTo(100),
      },
    ],
    ['a name of the longest length', { lastName: 'あ'.repeat(100) }, {}],
    [
      'an address of mail that is none',
      { email: 'hanako@' },
      {
        email: EMAIL_MALFORMED,
      },
    ],
    [
      'an address of mail too long',
      { email: `${'a'.repeat(244)}@example.com` },
      { email: upTo(255) },
    ],
    [
      'phone numbers that are none',
      { phoneNumber: '090-1234', alternativePhone: '03-1234-567a' },
      {
        phoneNumber: PHONE_MALFORMED,
        alternativePhone: PHONE_MALFORMED,
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
        postalCode: upTo(10),
        prefecture: upTo(50),
        city: upTo(100),
        address: upTo(255),
        building: upTo(255),
      },
    ],
    [
      'an occupation and a referral code too long',
      { occupation: 'あ'.repeat(101), referralCode: 'A'.repeat(51) },
      {
        occupation: upTo(100),
        referralCode: upTo(50),
      },
    ],
    [
      'a day of birth to come',
      { birthDate: '2026-11-21' },
      {
        birthDate: BIRTH_DATE_OUT_OF_RANGE,
      },
    ],
    [
      'a day of birth before 1900',
      { birthDate: '1899-12-31' },
      {
        birthDate: BIRTH_DATE_OUT_OF_RANGE,
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
        gender: UNLISTED,
        membershipTier: UNLISTED,
        customerStatus: UNLISTED,
        hairType: UNLISTED,
        hairThickness: UNLISTED,
        scalpCondition: UNLISTED,
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
    ).toEqual({ type: 'valid', value: { referredBy: other } })
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
    ).toEqual({ type: 'valid', value: { referredBy: null } })
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
      value: {
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
    ['a last name', { lastName: '佐藤' }, { lastName: '佐藤' }],
    [
      'a first name in kana',
      { firstNameKana: 'ハナ' },
      { firstNameKana: 'ハナ' },
    ],
    [
      'another phone number',
      { alternativePhone: '03-1234-5678' },
      { alternativePhone: '03-1234-5678' },
    ],
    ['a postal code', { postalCode: '150-0001' }, { postalCode: '150-0001' }],
    ['a prefecture', { prefecture: '東京都' }, { prefecture: '東京都' }],
    ['a city', { city: '渋谷区' }, { city: '渋谷区' }],
    ['an address', { address: '神宮前 1-2-3' }, { address: '神宮前 1-2-3' }],
    ['an occupation', { occupation: '会社員' }, { occupation: '会社員' }],
    [
      'the thickness of the hair',
      { hairThickness: 'thin' },
      { hairThickness: 'thin' },
    ],
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
    ).toEqual({ type: 'valid', value: request })
  })

  it('should send the permissions to reach a customer that were changed', () => {
    // Arrange
    const form = formOfCustomer(customer)
    form.delete('allowEmail')
    form.append('allowMarketing', 'on')
    form.append('allowSms', 'on')

    // Act, Assert
    expect(readCustomerChange(form, customer, TODAY)).toEqual({
      type: 'valid',
      value: { allowEmail: false, allowMarketing: true, allowSms: true },
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
      value: { preferences: null },
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
      errors: { email: EMAIL_MISSING },
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
          { field: 'city', rule: 'too_big' },
          { field: 'referralCode', rule: 'too_big' },
        ],
      },
      {
        message: undefined,
        errors: {
          birthDate: BIRTH_DATE_OUT_OF_RANGE,
          tags: REFUSED_VALUE,
          [PREFERRED_SERVICES]: UNLISTED,
          city: upTo(100),
          referralCode: REFUSED_VALUE,
        },
      },
    ],
    [
      'what a customer likes, refused as a whole',
      { type: 'invalid', values: [{ field: 'preferences', rule: 'custom' }] },
      {
        message: undefined,
        errors: { [PREFERRED_SERVICES]: UNLISTED },
      },
    ],
    [
      'a referrer who is not in the ledger',
      { type: 'invalid', values: [{ field: 'referredBy', rule: 'not_found' }] },
      {
        message: undefined,
        errors: {
          referredBy: REFERRER_ABSENT,
        },
      },
    ],
    [
      'the customer themselves as their referrer',
      { type: 'invalid', values: [{ field: 'referredBy', rule: 'circular' }] },
      {
        message: undefined,
        errors: {
          referredBy: REFERRER_THEMSELVES,
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
        message: CHECK_THE_VALUES,
        errors: {},
      },
    ],
    [
      'an address of mail another customer has',
      { type: 'duplicate', field: 'email' },
      {
        message: undefined,
        errors: {
          email: EMAIL_TAKEN,
        },
      },
    ],
    [
      'a referral code another customer has',
      { type: 'duplicate', field: 'referralCode' },
      {
        message: undefined,
        errors: {
          referralCode: CODE_TAKEN,
        },
      },
    ],
    [
      'a refusal of the account',
      { type: 'forbidden' },
      { message: CANNOT_HANDLE, errors: {} },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      {
        message: TOO_MANY_REQUESTS,
        errors: {},
      },
    ],
  ])('should say after %s', (_case, outcome, said) => {
    // Act, Assert
    expect(afterCustomerWrite(outcome, 'entry')).toEqual(said)
  })

  it.each<['entry' | 'change', LocalizedText]>([
    ['entry', ENTRY_FAILED],
    ['change', CHANGE_FAILED],
  ])('should say that the %s failed', (write, message) => {
    // Act, Assert
    expect(afterCustomerWrite({ type: 'failed' }, write)).toEqual({
      message,
      errors: {},
    })
  })
})

describe('the referrer', () => {
  it.each<[string, Referrer, string, LocalizedText]>([
    ['nobody', NO_REFERRER, '', { en: 'None', ja: 'なし' }],
    [
      'a customer of the ledger',
      { type: 'customer', id: REFERRER_ID, name: '山田 花子' },
      REFERRER_ID,
      { en: '山田 花子', ja: '山田 花子 様' },
    ],
    [
      'a customer who was removed',
      { type: 'gone', id: REFERRER_ID },
      REFERRER_ID,
      GONE_REFERRER,
    ],
  ])('should hold and name %s', (_case, referrer, id, name) => {
    // Act, Assert
    expect([referrerIdOf(referrer), referrerNameOf(referrer)]).toEqual([
      id,
      name,
    ])
  })
})
