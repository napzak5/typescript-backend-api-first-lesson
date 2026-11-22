import type { ModelsCustomerProfileResponse } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { newProfile, profile } from './components/examples'
import {
  afterProfile,
  afterProfileChange,
  afterWholeProfile,
  PREFERENCE_NOTES,
  PREFERRED_SERVICES,
  readProfile,
  readProfileChange,
  readWholeProfile,
} from './profile-flow'

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

const TODAY = '2026-11-19'

const BIRTH_DATE_OUT_OF_RANGE =
  '生年月日は、1900 年 1 月 1 日から今日までの日付を入力してください。'
const UNLISTED = '選択肢から選んでください。'
const UNACCEPTABLE =
  'この値は受け付けられませんでした。入力を確かめてください。'

/** A box hands its name over when it is ticked, and nothing when it is not. */
const ticked = (name: string, allowed: boolean): [string, string][] =>
  allowed ? [[name, 'on']] : []

/** What the form of a profile hands over when it is sent as it was opened. */
const sentAsOpened = (
  shown: ModelsCustomerProfileResponse,
): [string, string][] => [
  ['lastName', shown.lastName],
  ['firstName', shown.firstName],
  ['lastNameKana', shown.lastNameKana ?? ''],
  ['firstNameKana', shown.firstNameKana ?? ''],
  ['phoneNumber', shown.phoneNumber],
  ['alternativePhone', shown.alternativePhone ?? ''],
  ['postalCode', shown.postalCode ?? ''],
  ['prefecture', shown.prefecture ?? ''],
  ['city', shown.city ?? ''],
  ['address', shown.address ?? ''],
  ['building', shown.building ?? ''],
  ['birthDate', shown.birthDate ?? ''],
  ['gender', shown.gender ?? ''],
  ['occupation', shown.occupation ?? ''],
  ...(shown.preferences?.preferredServices ?? []).map(
    (category): [string, string] => [PREFERRED_SERVICES, category],
  ),
  [PREFERENCE_NOTES, shown.preferences?.notes ?? ''],
  ...ticked('allowEmail', shown.allowEmail),
  ...ticked('allowSms', shown.allowSms),
  ...ticked('allowMarketing', shown.allowMarketing),
]

/**
 * The form of a profile, with the controls that were changed before it was
 * sent: the values of a name take the place of what the form opened with
 * (none for a box that was unticked).
 */
const filledWith = (
  shown: ModelsCustomerProfileResponse,
  changed: Record<string, string[]> = {},
): FormData => {
  const data = new FormData()
  for (const [name, value] of sentAsOpened(shown)) {
    if (changed[name] === undefined) {
      data.append(name, value)
    }
  }
  for (const [name, values] of Object.entries(changed)) {
    for (const value of values) {
      data.append(name, value)
    }
  }

  return data
}

const wholeErrorsOf = (changed: Record<string, string[]>) => {
  const read = readWholeProfile(filledWith(profile, changed), TODAY)

  return read.type === 'invalid' ? read.errors : null
}

/** The values that may be left empty, with the lengths the API takes */
const OPTIONAL_TEXTS: [string, number][] = [
  ['lastNameKana', 100],
  ['firstNameKana', 100],
  ['postalCode', 10],
  ['prefecture', 50],
  ['city', 100],
  ['address', 255],
  ['building', 255],
  ['occupation', 100],
]

describe('readWholeProfile', () => {
  it('should be everything the form holds, under the names of the request', () => {
    expect(readWholeProfile(filledWith(profile), TODAY)).toEqual({
      type: 'valid',
      value: {
        lastName: '山田',
        firstName: '花子',
        lastNameKana: 'ヤマダ',
        firstNameKana: 'ハナコ',
        phoneNumber: '090-5550-0199',
        alternativePhone: '03-5550-0142',
        postalCode: '150-0001',
        prefecture: '東京都',
        city: '渋谷区',
        address: '神宮前 1-2-3',
        building: 'こもれびハイツ 302',
        birthDate: '1990-05-15',
        gender: 'female',
        occupation: 'デザイナー',
        preferences: {
          preferredServices: ['cut', 'color'],
          notes: 'オーガニックの製品を使ってほしいです。',
        },
        allowEmail: true,
        allowSms: true,
        allowMarketing: false,
      },
    })
  })

  it('should say nothing (null) about what was left empty, and no to what was not ticked', () => {
    expect(readWholeProfile(filledWith(newProfile), TODAY)).toEqual({
      type: 'valid',
      value: {
        lastName: '佐藤',
        firstName: '健',
        lastNameKana: null,
        firstNameKana: null,
        phoneNumber: '080-5550-0117',
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

  it('should drop the spaces around what was typed, and take spaces alone for nothing', () => {
    expect(
      readWholeProfile(
        filledWith(profile, {
          lastName: [' 山田 '],
          building: ['　'],
          occupation: [' 美容師\n'],
          [PREFERENCE_NOTES]: [' \n '],
        }),
        TODAY,
      ),
    ).toMatchObject({
      type: 'valid',
      value: {
        lastName: '山田',
        building: null,
        occupation: '美容師',
        preferences: { preferredServices: ['cut', 'color'], notes: null },
      },
    })
  })

  it('should ask for the name and the phone number, and for nothing else', () => {
    const read = readWholeProfile(form({}), TODAY)

    expect(read).toEqual({
      type: 'invalid',
      errors: {
        lastName: '姓を入力してください。',
        firstName: '名を入力してください。',
        phoneNumber: '電話番号を入力してください。',
      },
    })
  })

  it('should say that a name is too long, and how to write a phone number, as the form of a first booking does', () => {
    expect(
      wholeErrorsOf({
        lastName: ['山'.repeat(101)],
        phoneNumber: ['090-5550-019a'],
      }),
    ).toEqual({
      lastName: '100 文字以内で入力してください。',
      phoneNumber: PHONE_MALFORMED,
    })
  })

  it.each(OPTIONAL_TEXTS)(
    'should take %s as long as the API takes it, %i characters, and say so when it is longer',
    (name, most) => {
      expect(
        readWholeProfile(
          filledWith(profile, { [name]: ['あ'.repeat(most)] }),
          TODAY,
        ),
      ).toMatchObject({ type: 'valid', value: { [name]: 'あ'.repeat(most) } })
      expect(wholeErrorsOf({ [name]: ['あ'.repeat(most + 1)] })).toEqual({
        [name]: `${most} 文字以内で入力してください。`,
      })
    },
  )

  it('should take a second phone number as it takes the first', () => {
    expect(
      readWholeProfile(
        filledWith(profile, { alternativePhone: ['+81 3-5550-0188'] }),
        TODAY,
      ),
    ).toMatchObject({ value: { alternativePhone: '+81 3-5550-0188' } })
    expect(wholeErrorsOf({ alternativePhone: ['03-1234-567'] })).toEqual({
      alternativePhone: PHONE_MALFORMED,
    })
  })

  it.each([
    ['the first day the API takes', '1900-01-01'],
    ['today', TODAY],
    ['the last day of February in a leap year', '2024-02-29'],
  ])('should take %s as a day of birth', (_case, birthDate) => {
    expect(
      readWholeProfile(filledWith(profile, { birthDate: [birthDate] }), TODAY),
    ).toMatchObject({ type: 'valid', value: { birthDate } })
  })

  it.each([
    ['the day before the first the API takes', '1899-12-31'],
    ['tomorrow', '2026-11-20'],
    ['a day the calendar does not have', '2023-02-29'],
    ['a month the calendar does not have', '2023-13-01'],
    ['a day written without its hyphens', '19900515'],
    ['a month without its day', '1990-05'],
    ['a year alone', '1990'],
    ['a day with a time', '1990-05-15T00:00:00Z'],
    ['words', 'きのう'],
  ])(
    'should say which days somebody can have been born on for %s',
    (_case, birthDate) => {
      expect(wholeErrorsOf({ birthDate: [birthDate] })).toEqual({
        birthDate: BIRTH_DATE_OUT_OF_RANGE,
      })
    },
  )

  it.each(['male', 'female', 'other', 'prefer_not_to_say'])(
    'should take the gender %s',
    (gender) => {
      expect(
        readWholeProfile(filledWith(profile, { gender: [gender] }), TODAY),
      ).toMatchObject({ type: 'valid', value: { gender } })
    },
  )

  it('should say to choose from the list for a gender the contract does not have', () => {
    expect(wholeErrorsOf({ gender: ['unknown'] })).toEqual({ gender: UNLISTED })
  })

  it('should name the kinds of service in the order of the contract, whatever order they were sent in', () => {
    expect(
      readWholeProfile(
        filledWith(profile, { [PREFERRED_SERVICES]: ['spa', 'cut', 'perm'] }),
        TODAY,
      ),
    ).toMatchObject({
      value: { preferences: { preferredServices: ['cut', 'perm', 'spa'] } },
    })
  })

  it('should name a kind once that was sent twice, and leave out what is no kind of the contract', () => {
    expect(
      readWholeProfile(
        filledWith(profile, {
          [PREFERRED_SERVICES]: ['spa', 'massage', 'spa'],
        }),
        TODAY,
      ),
    ).toMatchObject({ value: { preferences: { preferredServices: ['spa'] } } })
  })

  it('should be preferences with what there is when only a kind is chosen, or only something is written', () => {
    expect(
      readWholeProfile(
        filledWith(profile, { [PREFERENCE_NOTES]: [''] }),
        TODAY,
      ),
    ).toMatchObject({
      value: {
        preferences: { preferredServices: ['cut', 'color'], notes: null },
      },
    })
    expect(
      readWholeProfile(
        filledWith(profile, { [PREFERRED_SERVICES]: [] }),
        TODAY,
      ),
    ).toMatchObject({
      value: {
        preferences: {
          preferredServices: [],
          notes: 'オーガニックの製品を使ってほしいです。',
        },
      },
    })
  })

  it('should be no preferences at all when no kind is chosen and nothing is written', () => {
    expect(
      readWholeProfile(
        filledWith(profile, {
          [PREFERRED_SERVICES]: [],
          [PREFERENCE_NOTES]: ['  '],
        }),
        TODAY,
      ),
    ).toMatchObject({ type: 'valid', value: { preferences: null } })
  })

  it.each([['allowEmail'], ['allowSms'], ['allowMarketing']])(
    'should say yes to %s when its box is ticked, and to nothing else',
    (name) => {
      expect(
        readWholeProfile(filledWith(newProfile, { [name]: ['on'] }), TODAY),
      ).toMatchObject({
        value: {
          allowEmail: false,
          allowSms: false,
          allowMarketing: false,
          [name]: true,
        },
      })
    },
  )
})

describe('readProfileChange', () => {
  it.each([
    ['somebody who said everything', profile],
    ['somebody who said who they are and nothing else', newProfile],
  ])(
    'should have nothing to change when the form of %s is sent as it was opened',
    (_case, shown) => {
      expect(readProfileChange(filledWith(shown), shown, TODAY)).toEqual({
        type: 'unchanged',
      })
    },
  )

  it('should take for unchanged what only differs by how the form reads a value: spaces around it, nothing for null, the kinds in another order', () => {
    const shown: ModelsCustomerProfileResponse = {
      ...profile,
      lastName: ' 山田 ',
      phoneNumber: '090-5550-0199 ',
      lastNameKana: ' ヤマダ',
      building: '  ',
      occupation: '',
      preferences: { preferredServices: ['color', 'cut'], notes: '  ' },
    }

    expect(readProfileChange(filledWith(shown), shown, TODAY)).toEqual({
      type: 'unchanged',
    })
  })

  it('should take preferences without a kind and without a word for no preferences', () => {
    const shown: ModelsCustomerProfileResponse = {
      ...profile,
      preferences: { preferredServices: [], notes: null },
    }

    expect(readProfileChange(filledWith(shown), shown, TODAY)).toEqual({
      type: 'unchanged',
    })
  })

  it.each([
    ['lastName', '田中'],
    ['firstName', '葉子'],
    ['lastNameKana', 'タナカ'],
    ['firstNameKana', 'ヨウコ'],
    ['phoneNumber', '080-5550-0123'],
    ['alternativePhone', '03-5550-0188'],
    ['postalCode', '530-0001'],
    ['prefecture', '大阪府'],
    ['city', '大阪市北区'],
    ['address', '梅田 1-1-1'],
    ['building', 'うめだビル 5F'],
    ['birthDate', '1991-06-16'],
    ['gender', 'other'],
    ['occupation', '美容師'],
  ])('should send %s alone when it alone was changed', (name, value) => {
    expect(
      readProfileChange(
        filledWith(profile, { [name]: [value] }),
        profile,
        TODAY,
      ),
    ).toEqual({ type: 'valid', value: { [name]: value } })
  })

  it.each([
    ...OPTIONAL_TEXTS.map(([name]) => name),
    'alternativePhone',
    'birthDate',
    'gender',
  ])('should clear %s (null) when its control was emptied', (name) => {
    expect(
      readProfileChange(filledWith(profile, { [name]: [''] }), profile, TODAY),
    ).toEqual({ type: 'valid', value: { [name]: null } })
  })

  it('should send what is said for the first time, and nothing about what stays unsaid', () => {
    expect(
      readProfileChange(
        filledWith(newProfile, { city: ['渋谷区'] }),
        newProfile,
        TODAY,
      ),
    ).toEqual({ type: 'valid', value: { city: '渋谷区' } })
  })

  it('should send the preferences whole when a kind was added', () => {
    expect(
      readProfileChange(
        filledWith(profile, { [PREFERRED_SERVICES]: ['cut', 'color', 'spa'] }),
        profile,
        TODAY,
      ),
    ).toEqual({
      type: 'valid',
      value: {
        preferences: {
          preferredServices: ['cut', 'color', 'spa'],
          notes: 'オーガニックの製品を使ってほしいです。',
        },
      },
    })
  })

  it('should send the preferences whole when what is written was changed', () => {
    expect(
      readProfileChange(
        filledWith(profile, {
          [PREFERENCE_NOTES]: ['香りの強い製品は苦手です。'],
        }),
        profile,
        TODAY,
      ),
    ).toEqual({
      type: 'valid',
      value: {
        preferences: {
          preferredServices: ['cut', 'color'],
          notes: '香りの強い製品は苦手です。',
        },
      },
    })
  })

  it('should say preferences for the first time for somebody who had none', () => {
    expect(
      readProfileChange(
        filledWith(newProfile, { [PREFERRED_SERVICES]: ['perm'] }),
        newProfile,
        TODAY,
      ),
    ).toEqual({
      type: 'valid',
      value: { preferences: { preferredServices: ['perm'], notes: null } },
    })
  })

  it('should clear the preferences (null) when no kind is chosen any more and nothing is written', () => {
    expect(
      readProfileChange(
        filledWith(profile, {
          [PREFERRED_SERVICES]: [],
          [PREFERENCE_NOTES]: [''],
        }),
        profile,
        TODAY,
      ),
    ).toEqual({ type: 'valid', value: { preferences: null } })
  })

  it.each<[string, string[], boolean]>([
    ['allowEmail', [], false],
    ['allowSms', [], false],
    ['allowMarketing', ['on'], true],
  ])(
    'should send %s alone when its box alone was changed',
    (name, values, allowed) => {
      expect(
        readProfileChange(
          filledWith(profile, { [name]: values }),
          profile,
          TODAY,
        ),
      ).toEqual({ type: 'valid', value: { [name]: allowed } })
    },
  )

  it('should send everything that was changed together, and nothing else', () => {
    expect(
      readProfileChange(
        filledWith(profile, {
          lastName: ['田中'],
          building: [''],
          gender: ['prefer_not_to_say'],
          [PREFERRED_SERVICES]: ['treatment'],
          allowSms: [],
        }),
        profile,
        TODAY,
      ),
    ).toEqual({
      type: 'valid',
      value: {
        lastName: '田中',
        building: null,
        gender: 'prefer_not_to_say',
        preferences: {
          preferredServices: ['treatment'],
          notes: 'オーガニックの製品を使ってほしいです。',
        },
        allowSms: false,
      },
    })
  })

  it('should say what is wrong with what was typed, as for a new profile, and have nothing to send', () => {
    expect(
      readProfileChange(
        filledWith(profile, { firstName: [''], birthDate: ['2026-11-20'] }),
        profile,
        TODAY,
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        firstName: '名を入力してください。',
        birthDate: BIRTH_DATE_OUT_OF_RANGE,
      },
    })
  })

  it('should say what is wrong with a value although nothing was changed: what the salons have may be nothing the API takes from a customer', () => {
    const shown: ModelsCustomerProfileResponse = {
      ...profile,
      phoneNumber: '0000',
    }

    expect(readProfileChange(filledWith(shown), shown, TODAY)).toEqual({
      type: 'invalid',
      errors: { phoneNumber: PHONE_MALFORMED },
    })
  })
})

describe.each<[string, (values: { field: string; rule: string }[]) => unknown]>(
  [
    [
      'afterWholeProfile',
      (values) => afterWholeProfile({ type: 'invalid', values }),
    ],
    [
      'afterProfileChange',
      (values) => afterProfileChange({ type: 'invalid', values }),
    ],
  ],
)('%s, of values the API did not take', (_name, saysAfter) => {
  it.each([
    ['lastName', 'too_big', '100 文字以内で入力してください。'],
    ['firstName', 'invalid_format', '名を入力してください。'],
    ['phoneNumber', 'custom', PHONE_MALFORMED],
    ['alternativePhone', 'custom', PHONE_MALFORMED],
    ['lastNameKana', 'too_big', '100 文字以内で入力してください。'],
    ['firstNameKana', 'too_big', '100 文字以内で入力してください。'],
    ['postalCode', 'too_big', '10 文字以内で入力してください。'],
    ['prefecture', 'too_big', '50 文字以内で入力してください。'],
    ['city', 'too_big', '100 文字以内で入力してください。'],
    ['address', 'too_big', '255 文字以内で入力してください。'],
    ['building', 'too_big', '255 文字以内で入力してください。'],
    ['occupation', 'too_big', '100 文字以内で入力してください。'],
    ['occupation', 'invalid_format', UNACCEPTABLE],
    ['birthDate', 'too_big', BIRTH_DATE_OUT_OF_RANGE],
    ['birthDate', 'too_small', BIRTH_DATE_OUT_OF_RANGE],
    ['birthDate', 'invalid_format', BIRTH_DATE_OUT_OF_RANGE],
    ['gender', 'invalid_value', UNLISTED],
    [PREFERENCE_NOTES, 'invalid_format', UNACCEPTABLE],
  ])(
    'should say of %s that broke the rule %s what to do, at its control',
    (field, rule, message) => {
      expect(saysAfter([{ field, rule }])).toEqual({
        message: undefined,
        errors: { [field]: message },
      })
    },
  )

  it.each([
    ['one of the kinds', 'preferences.preferredServices.1', 'invalid_value'],
    ['the kinds together', 'preferences.preferredServices', 'custom'],
    ['the preferences as a whole', 'preferences', 'invalid_type'],
  ])(
    'should say at the one control of the kinds of service what the API says of %s',
    (_case, field, rule) => {
      expect(saysAfter([{ field, rule }])).toEqual({
        message: undefined,
        errors: { [PREFERRED_SERVICES]: UNLISTED },
      })
    },
  )

  it.each([
    [
      'a value the form has no control for',
      [{ field: 'membershipTier', rule: 'unrecognized_keys' }],
    ],
    ['nothing', []],
  ])(
    'should say that the values are to be looked at when the API names %s',
    (_case, values) => {
      expect(saysAfter(values)).toEqual({
        message: '入力した内容を確かめて、もう一度お試しください。',
        errors: {},
      })
    },
  )

  it('should say the first thing the API says about a value, and something at every control it names', () => {
    expect(
      saysAfter([
        { field: 'city', rule: 'too_big' },
        { field: 'city', rule: 'invalid_format' },
        { field: 'preferences.preferredServices.0', rule: 'invalid_value' },
        { field: 'preferences.preferredServices.2', rule: 'invalid_value' },
        { field: 'loyaltyPoints', rule: 'unrecognized_keys' },
        { field: 'birthDate', rule: 'too_big' },
      ]),
    ).toEqual({
      message: undefined,
      errors: {
        city: '100 文字以内で入力してください。',
        [PREFERRED_SERVICES]: UNLISTED,
        birthDate: BIRTH_DATE_OUT_OF_RANGE,
      },
    })
  })
})

describe('afterWholeProfile', () => {
  it('should say that the account cannot have the profile, without saying why', () => {
    expect(afterWholeProfile({ type: 'refused' })).toEqual({
      message:
        'このアカウントでは、お客様の情報を登録できませんでした。ページを読み込み直しても登録できないときは、サロンにお問い合わせください。',
      errors: {},
    })
  })
})

describe.each([
  ['afterWholeProfile', afterWholeProfile],
  ['afterProfileChange', afterProfileChange],
])('%s, of an attempt that can be made again', (_name, saysAfter) => {
  it('should ask to wait after too many requests', () => {
    expect(saysAfter({ type: 'tooManyRequests' })).toEqual({
      message:
        'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      errors: {},
    })
  })

  it('should say that nothing was sent when there was no answer to act on', () => {
    expect(saysAfter({ type: 'failed' })).toEqual({
      message:
        '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    })
  })
})
