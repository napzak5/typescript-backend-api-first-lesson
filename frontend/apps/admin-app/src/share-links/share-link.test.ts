import { describe, expect, it } from 'vitest'
import { forTheCustomer, NOW } from './components/examples'
import {
  afterIssuing,
  afterRevoking,
  downloadsNameOf,
  expiryAfter,
  limitNameOf,
  passwordNameOf,
  readShareLinkEntry,
  shareAddressOf,
  sharesFiles,
  stateNameOf,
  stateOf,
} from './share-link'

/** The values of a form, under the names of its controls */
const valuesOf = (entries: Record<string, string>): FormData => {
  const values = new FormData()
  for (const [name, value] of Object.entries(entries)) {
    values.set(name, value)
  }

  return values
}

const FILLED = { period: '7', maxDownloads: '', password: '' }

/** 10:00:42.5 in Tokyo, on 21 November 2026 */
const NOW_WITH_SECONDS = new Date('2026-11-21T01:00:42.500Z')

describe('sharesFiles', () => {
  it.each<[string, boolean]>([
    ['owner', true],
    ['manager', true],
    ['admin', true],
    ['staff', false],
    ['customer', false],
  ])('should tell whether the role %s shares files', (role, shares) => {
    expect(sharesFiles(role)).toBe(shares)
  })
})

describe('expiryAfter', () => {
  it.each<[number, string]>([
    [1, '2026-11-22T01:00:00.000Z'],
    [7, '2026-11-28T01:00:00.000Z'],
    [30, '2026-12-21T01:00:00.000Z'],
  ])(
    'should end a link of %i days that many times 24 hours later, cut to the minute',
    (days, end) => {
      expect(expiryAfter(days, NOW_WITH_SECONDS)).toBe(end)
    },
  )

  it('should never end a link of 30 days later than 720 hours after now', () => {
    const end = Date.parse(expiryAfter(30, NOW_WITH_SECONDS))

    expect(end - NOW_WITH_SECONDS.getTime()).toBeLessThanOrEqual(
      720 * 60 * 60 * 1000,
    )
  })
})

describe('readShareLinkEntry', () => {
  it('should ask for a link of the period chosen, without a limit or a password, when those are empty', () => {
    expect(readShareLinkEntry(valuesOf(FILLED), NOW)).toEqual({
      type: 'valid',
      request: {
        expiresAt: '2026-11-28T01:00:00.000Z',
        maxDownloads: null,
        password: null,
      },
    })
  })

  it.each<[string, string, number]>([
    ['digits', '3', 3],
    ['digits of full width', '１２', 12],
    ['a number with commas and spaces', ' 1,000 ', 1000],
    ['the largest the API takes', '2147483647', 2_147_483_647],
  ])('should take a limit of %s', (_, typed, limit) => {
    expect(
      readShareLinkEntry(valuesOf({ ...FILLED, maxDownloads: typed }), NOW),
    ).toMatchObject({ type: 'valid', request: { maxDownloads: limit } })
  })

  it.each<[string, string]>([
    ['nought', '0'],
    ['a negative number', '-1'],
    ['a fraction', '1.5'],
    ['a word', '三'],
    ['more than the API takes', '2147483648'],
  ])('should refuse a limit of %s at its control', (_, typed) => {
    expect(
      readShareLinkEntry(valuesOf({ ...FILLED, maxDownloads: typed }), NOW),
    ).toEqual({
      type: 'invalid',
      errors: {
        maxDownloads: expect.stringContaining('1 から 2,147,483,647'),
      },
    })
  })

  it.each<[string, string]>([
    ['of 8 characters', 'umi-heya'],
    ['of 128 characters', 'a'.repeat(128)],
    ['with spaces around it, as typed', '  umi no mieru heya  '],
    [
      'of characters of the NFD form, counted as the API counts them',
      'カ\u3099ラス窓のある部屋',
    ],
  ])('should send a password %s as it was typed', (_, password) => {
    expect(
      readShareLinkEntry(valuesOf({ ...FILLED, password }), NOW),
    ).toMatchObject({ type: 'valid', request: { password } })
  })

  it.each<[string, string]>([
    ['of 7 characters', 'umiheya'],
    ['of 129 characters', 'a'.repeat(129)],
    [
      'of 8 code points that are 4 characters once composed',
      'カ\u3099キ\u3099ク\u3099ケ\u3099',
    ],
  ])('should refuse a password %s at its control', (_, password) => {
    expect(readShareLinkEntry(valuesOf({ ...FILLED, password }), NOW)).toEqual({
      type: 'invalid',
      errors: { password: expect.stringContaining('8 文字から 128 文字') },
    })
  })

  it('should refuse a period the form does not offer, and say every refusal at once', () => {
    expect(
      readShareLinkEntry(
        valuesOf({ period: '31', maxDownloads: '0', password: 'short' }),
        NOW,
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        period: '有効期間を選んでください。',
        maxDownloads: expect.any(String),
        password: expect.any(String),
      },
    })
  })
})

describe('afterIssuing', () => {
  it.each<[string, { field: string; rule: string }[], Record<string, RegExp>]>([
    [
      'a password too easy to guess',
      [{ field: 'password', rule: 'blocklisted' }],
      { password: /推測されやすいパスワード/ },
    ],
    [
      'a password of a length the API does not take',
      [{ field: 'password', rule: 'too_small' }],
      { password: /8 文字から 128 文字/ },
    ],
    [
      'an end the clock of the device put out of the 30 days',
      [{ field: 'expiresAt', rule: 'too_big' }],
      { period: /端末の時計/ },
    ],
    [
      'a limit',
      [{ field: 'maxDownloads', rule: 'too_small' }],
      { maxDownloads: /1 から/ },
    ],
  ])('should say at its control that the API refused %s', (_, values, said) => {
    expect(afterIssuing({ type: 'invalid', values })).toEqual({
      message: undefined,
      errors: Object.fromEntries(
        Object.entries(said).map(([name, text]) => [
          name,
          expect.stringMatching(text),
        ]),
      ),
    })
  })

  it('should ask to check the values when the API refused one the form has no control of', () => {
    expect(
      afterIssuing({
        type: 'invalid',
        values: [{ field: 'token', rule: 'unrecognized_keys' }],
      }),
    ).toEqual({
      message: '入力した内容を確かめて、もう一度お試しください。',
      errors: {},
    })
  })

  it.each<[string, Parameters<typeof afterIssuing>[0], RegExp]>([
    [
      'a file whose upload was not finished',
      { type: 'notUploaded' },
      /アップロードが済んでいない/,
    ],
    [
      'a role that shares no file',
      { type: 'forbidden' },
      /オーナー、マネージャー、管理者/,
    ],
    ['too many requests', { type: 'tooManyRequests' }, /アクセスが多すぎます/],
    ['a failure', { type: 'failed' }, /共有リンクを発行できませんでした/],
  ])('should say above the form why %s was not shared', (_, outcome, said) => {
    expect(afterIssuing(outcome)).toEqual({
      message: expect.stringMatching(said),
      errors: {},
    })
  })
})

describe('shareAddressOf', () => {
  it('should give the token in the fragment of the address of the portal', () => {
    expect(shareAddressOf('https://beauty-salon.example', 'abc_-9')).toBe(
      'https://beauty-salon.example/share#token=abc_-9',
    )
  })
})

describe('stateOf and stateNameOf', () => {
  it.each<[string, Partial<typeof forTheCustomer>, string]>([
    ['a link before its end, below its limit', {}, '使える'],
    [
      'a link without a limit',
      { maxDownloads: null, downloadCount: 900 },
      '使える',
    ],
    ['a link at its end', { expiresAt: NOW.toISOString() }, '期限切れ'],
    [
      'a link at its limit',
      { maxDownloads: 1, downloadCount: 1 },
      '回数の上限に達した',
    ],
    [
      'a link at its end and at its limit',
      {
        expiresAt: '2026-11-21T00:00:00.000Z',
        maxDownloads: 1,
        downloadCount: 1,
      },
      '期限切れ',
    ],
  ])('should say of %s that it is 「%s」', (_, changed, name) => {
    expect(stateNameOf(stateOf({ ...forTheCustomer, ...changed }, NOW))).toBe(
      name,
    )
  })
})

describe('the words of a link', () => {
  it('should say how often a link gave its file, against its limit', () => {
    expect(downloadsNameOf({ downloadCount: 1, maxDownloads: 3 })).toBe(
      '1 回（上限 3 回）',
    )
    expect(downloadsNameOf({ downloadCount: 1200, maxDownloads: null })).toBe(
      '1,200 回（上限なし）',
    )
    expect(limitNameOf(5)).toBe('5 回')
    expect(limitNameOf(null)).toBe('上限なし')
    expect(passwordNameOf(true)).toBe('あり')
    expect(passwordNameOf(false)).toBe('なし')
  })
})

describe('afterRevoking', () => {
  it.each<[string, Parameters<typeof afterRevoking>[0], RegExp]>([
    [
      'a role that shares no file',
      { type: 'forbidden' },
      /取り消せません。.*オーナー、マネージャー、管理者/,
    ],
    ['too many requests', { type: 'tooManyRequests' }, /アクセスが多すぎます/],
    ['a failure', { type: 'failed' }, /共有リンクを取り消せませんでした/],
  ])(
    'should say in the dialog why %s did not revoke the link',
    (_, outcome, said) => {
      expect(afterRevoking(outcome)).toMatch(said)
    },
  )
})
