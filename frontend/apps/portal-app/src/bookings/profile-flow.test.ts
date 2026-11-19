import { describe, expect, it } from 'vitest'
import { afterProfile, readProfile } from './profile-flow'

const PHONE_MALFORMED =
  '電話番号は、数字とハイフンで、市外局番から入力してください（例: 03-1234-5678）。'

const form = (values: Record<string, string>): FormData => {
  const data = new FormData()
  for (const [name, value] of Object.entries(values)) {
    data.append(name, value)
  }

  return data
}

const FILLED = {
  lastName: '山田',
  firstName: '花子',
  phoneNumber: '090-5550-0199',
}

const errorsOf = (values: Record<string, string>) => {
  const read = readProfile(form(values))

  return read.type === 'invalid' ? read.errors : null
}

describe('readProfile', () => {
  it('should be the name and the phone number, and nothing said about the rest', () => {
    expect(readProfile(form(FILLED))).toEqual({
      type: 'valid',
      value: {
        lastName: '山田',
        firstName: '花子',
        phoneNumber: '090-5550-0199',
        lastNameKana: null,
        firstNameKana: null,
        alternativePhone: null,
        postalCode: null,
        prefecture: null,
        city: null,
        address: null,
        building: null,
        birthDate: null,
        gender: null,
        occupation: null,
        preferences: null,
        allowEmail: false,
        allowSms: false,
        allowMarketing: false,
      },
    })
  })

  it('should drop the spaces around what was typed', () => {
    expect(
      readProfile(
        form({
          lastName: '  山田 ',
          firstName: '\t花子\n',
          phoneNumber: ' 090-5550-0199 ',
        }),
      ),
    ).toMatchObject({ value: FILLED })
  })

  it.each([['allowEmail'], ['allowSms'], ['allowMarketing']])(
    'should say yes to %s when its box is ticked, and to nothing else',
    (name) => {
      expect(readProfile(form({ ...FILLED, [name]: 'on' }))).toMatchObject({
        value: {
          allowEmail: false,
          allowSms: false,
          allowMarketing: false,
          [name]: true,
        },
      })
    },
  )

  it('should ask for everything that is missing, each at its control', () => {
    expect(errorsOf({})).toEqual({
      lastName: '姓を入力してください。',
      firstName: '名を入力してください。',
      phoneNumber: '電話番号を入力してください。',
    })
  })

  it('should take spaces alone for nothing', () => {
    expect(
      errorsOf({ lastName: ' ', firstName: '　', phoneNumber: '\t' }),
    ).toEqual({
      lastName: '姓を入力してください。',
      firstName: '名を入力してください。',
      phoneNumber: '電話番号を入力してください。',
    })
  })

  it('should say at one control what is wrong with its value, and nothing at the others', () => {
    expect(errorsOf({ ...FILLED, firstName: '' })).toEqual({
      lastName: undefined,
      firstName: '名を入力してください。',
      phoneNumber: undefined,
    })
  })

  it('should take a name as long as the API takes', () => {
    expect(
      readProfile(
        form({
          ...FILLED,
          lastName: '山'.repeat(100),
          firstName: '花'.repeat(100),
        }),
      ),
    ).toMatchObject({ type: 'valid' })
  })

  it('should say that a name is too long when it is longer than that', () => {
    expect(
      errorsOf({
        ...FILLED,
        lastName: '山'.repeat(101),
        firstName: '花'.repeat(101),
      }),
    ).toMatchObject({
      lastName: '100 文字以内で入力してください。',
      firstName: '100 文字以内で入力してください。',
    })
  })

  it.each([
    '0312345678',
    '03-1234-5678',
    '090 5550 0199',
    '(03) 1234-5678',
    '+81 90-5550-0199',
    '+81-90-5550-0199-12',
  ])('should take the phone number %j', (phoneNumber) => {
    expect(readProfile(form({ ...FILLED, phoneNumber }))).toMatchObject({
      value: { phoneNumber },
    })
  })

  it.each([
    ['fewer digits than a number has', '03-1234-567'],
    ['a short number', '12345'],
    ['letters', '090-5550-019a'],
    ['digits of full width', '０９０-５５５０-０１９９'],
    ['a hyphen of full width', '090－5550－0199'],
    ['an extension written out', '03-1234-5678 内線 12'],
    ['more characters than the API takes', '+81 (90) 5550 - 0199 1'],
    ['separators alone', '----------'],
  ])('should say how to write a phone number for %s', (_case, phoneNumber) => {
    expect(errorsOf({ ...FILLED, phoneNumber })).toMatchObject({
      phoneNumber: PHONE_MALFORMED,
    })
  })
})

describe('afterProfile', () => {
  it('should say at its control what the API does not take', () => {
    expect(
      afterProfile({
        type: 'invalid',
        values: [{ field: 'phoneNumber', rule: 'invalid_format' }],
      }),
    ).toEqual({ message: undefined, errors: { phoneNumber: PHONE_MALFORMED } })
  })

  it.each([
    ['lastName', 'too_big', '100 文字以内で入力してください。'],
    ['lastName', 'too_small', '姓を入力してください。'],
    ['firstName', 'too_big', '100 文字以内で入力してください。'],
    ['firstName', 'custom', '名を入力してください。'],
    ['phoneNumber', 'too_big', PHONE_MALFORMED],
  ])(
    'should say of %s that broke the rule %s what to do',
    (field, rule, message) => {
      expect(
        afterProfile({ type: 'invalid', values: [{ field, rule }] }),
      ).toEqual({ message: undefined, errors: { [field]: message } })
    },
  )

  it('should say the first thing the API says about a value, and something at every value it names', () => {
    expect(
      afterProfile({
        type: 'invalid',
        values: [
          { field: 'lastName', rule: 'too_big' },
          { field: 'lastName', rule: 'too_small' },
          { field: 'phoneNumber', rule: 'invalid_format' },
        ],
      }),
    ).toEqual({
      message: undefined,
      errors: {
        lastName: '100 文字以内で入力してください。',
        phoneNumber: PHONE_MALFORMED,
      },
    })
  })

  it.each([
    [
      'a value the form has no control for',
      [{ field: 'birthDate', rule: 'invalid_format' }],
    ],
    ['nothing', []],
  ])(
    'should say that the values are to be looked at when the API names %s',
    (_case, values) => {
      expect(afterProfile({ type: 'invalid', values })).toEqual({
        message: '入力した内容を確かめて、もう一度お試しください。',
        errors: {},
      })
    },
  )

  it('should say at the control it has what the API names, beside a value it has no control for', () => {
    expect(
      afterProfile({
        type: 'invalid',
        values: [
          { field: 'gender', rule: 'invalid_value' },
          { field: 'firstName', rule: 'too_small' },
        ],
      }),
    ).toEqual({
      message: undefined,
      errors: { firstName: '名を入力してください。' },
    })
  })

  it('should say that the account cannot have the profile, without saying why', () => {
    expect(afterProfile({ type: 'refused' })).toEqual({
      message:
        'このアカウントでは、お客様の情報を登録できませんでした。ページを読み込み直しても登録できないときは、サロンにお問い合わせください。',
      errors: {},
    })
  })

  it('should ask to wait after too many requests', () => {
    expect(afterProfile({ type: 'tooManyRequests' })).toEqual({
      message:
        'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      errors: {},
    })
  })

  it('should say that nothing was sent when there was no answer to act on', () => {
    expect(afterProfile({ type: 'failed' })).toEqual({
      message:
        '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    })
  })
})
