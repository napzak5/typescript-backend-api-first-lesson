import { formOf } from '@beauty-salon-frontend/testing/forms'
import { describe, expect, it } from 'vitest'
import { forTheCustomer, NOW } from '../components/examples'
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

const FILLED = { period: '7', maxDownloads: '', password: '' }

/** Who shares a file */
const SHARERS = {
  en: 'Only the owners and managers of the salon and administrators can issue and revoke the share links of files.',
  ja: 'ファイルの共有リンクを発行し、取り消せるのは、サロンのオーナー、マネージャー、管理者です。',
}

const TOO_MANY_REQUESTS = {
  en: 'There are too many requests. Wait a while and try again.',
  ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
}

const LIMIT_ERROR = {
  en: 'Enter the download limit as a whole number from 1 to 2,147,483,647. Leave it empty for no limit.',
  ja: '回数の上限は、1 から 2,147,483,647 までの整数で入力してください。上限を付けないときは、空のままにしてください。',
}

const PASSWORD_LENGTH_ERROR = {
  en: 'Enter a password of 8 to 128 characters. Leave it empty for no password.',
  ja: 'パスワードは、8 文字から 128 文字で入力してください。パスワードを付けないときは、空のままにしてください。',
}

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
    expect(readShareLinkEntry(formOf(FILLED), NOW)).toEqual({
      type: 'valid',
      value: {
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
      readShareLinkEntry(formOf({ ...FILLED, maxDownloads: typed }), NOW),
    ).toMatchObject({ type: 'valid', value: { maxDownloads: limit } })
  })

  it.each<[string, string]>([
    ['nought', '0'],
    ['a negative number', '-1'],
    ['a fraction', '1.5'],
    ['a word', '三'],
    ['more than the API takes', '2147483648'],
  ])('should refuse a limit of %s at its control', (_, typed) => {
    expect(
      readShareLinkEntry(formOf({ ...FILLED, maxDownloads: typed }), NOW),
    ).toEqual({
      type: 'invalid',
      errors: { maxDownloads: LIMIT_ERROR },
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
      readShareLinkEntry(formOf({ ...FILLED, password }), NOW),
    ).toMatchObject({ type: 'valid', value: { password } })
  })

  it.each<[string, string]>([
    ['of 7 characters', 'umiheya'],
    ['of 129 characters', 'a'.repeat(129)],
    [
      'of 8 code points that are 4 characters once composed',
      'カ\u3099キ\u3099ク\u3099ケ\u3099',
    ],
  ])('should refuse a password %s at its control', (_, password) => {
    expect(readShareLinkEntry(formOf({ ...FILLED, password }), NOW)).toEqual({
      type: 'invalid',
      errors: { password: PASSWORD_LENGTH_ERROR },
    })
  })

  it('should refuse a period the form does not offer, and say every refusal at once', () => {
    expect(
      readShareLinkEntry(
        formOf({ period: '31', maxDownloads: '0', password: 'short' }),
        NOW,
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        period: {
          en: 'Choose how long the link is valid for.',
          ja: '有効期間を選んでください。',
        },
        maxDownloads: LIMIT_ERROR,
        password: PASSWORD_LENGTH_ERROR,
      },
    })
  })
})

describe('afterIssuing', () => {
  it.each<[string, { field: string; rule: string }[], Record<string, unknown>]>(
    [
      [
        'a password too easy to guess',
        [{ field: 'password', rule: 'blocklisted' }],
        {
          password: {
            en: 'This password is easy to guess. Sequences, rows of the keyboard, repeated characters and common passwords cannot be used. Choose another password.',
            ja: '推測されやすいパスワードです。連番、キーボードの並び、同じ文字の繰り返し、よく使われるパスワードは使えません。ほかのパスワードにしてください。',
          },
        },
      ],
      [
        'a password of a length the API does not take',
        [{ field: 'password', rule: 'too_small' }],
        { password: PASSWORD_LENGTH_ERROR },
      ],
      [
        'an end the clock of the device put out of the 30 days',
        [{ field: 'expiresAt', rule: 'too_big' }],
        {
          period: {
            en: 'Could not set the expiry. Check that the clock of this device is right, and issue the link again.',
            ja: '有効期限を決められませんでした。この端末の時計が正しいか確かめて、もう一度発行してください。',
          },
        },
      ],
      [
        'a limit',
        [{ field: 'maxDownloads', rule: 'too_small' }],
        { maxDownloads: LIMIT_ERROR },
      ],
    ],
  )(
    'should say at its control that the API refused %s',
    (_, values, errors) => {
      expect(afterIssuing({ type: 'invalid', values })).toEqual({
        message: undefined,
        errors,
      })
    },
  )

  it('should ask to check the values when the API refused one the form has no control of', () => {
    expect(
      afterIssuing({
        type: 'invalid',
        values: [{ field: 'token', rule: 'unrecognized_keys' }],
      }),
    ).toEqual({
      message: {
        en: 'Check what you entered and try again.',
        ja: '入力した内容を確かめて、もう一度お試しください。',
      },
      errors: {},
    })
  })

  it.each<[string, Parameters<typeof afterIssuing>[0], unknown]>([
    [
      'a file whose upload was not finished',
      { type: 'notUploaded' },
      {
        en: 'A file whose upload is not finished cannot be shared. Issue a share link once the upload is finished.',
        ja: 'アップロードが済んでいないファイルは、共有できません。アップロードが済んでから、共有リンクを発行してください。',
      },
    ],
    [
      'a role that shares no file',
      { type: 'forbidden' },
      {
        en: `This account cannot share this file. ${SHARERS.en}`,
        ja: `このアカウントでは、このファイルを共有できません。${SHARERS.ja}`,
      },
    ],
    ['too many requests', { type: 'tooManyRequests' }, TOO_MANY_REQUESTS],
    [
      'a failure',
      { type: 'failed' },
      {
        en: 'Could not issue the share link. Check your connection and try again.',
        ja: '共有リンクを発行できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])(
    'should say above the form why %s was not shared',
    (_, outcome, message) => {
      expect(afterIssuing(outcome)).toEqual({ message, errors: {} })
    },
  )
})

describe('shareAddressOf', () => {
  it('should give the token in the fragment of the address of the portal', () => {
    expect(shareAddressOf('https://beauty-salon.example', 'abc_-9')).toBe(
      'https://beauty-salon.example/share#token=abc_-9',
    )
  })
})

describe('stateOf and stateNameOf', () => {
  it.each<[string, Partial<typeof forTheCustomer>, string, string]>([
    ['a link before its end, below its limit', {}, 'Usable', '使える'],
    [
      'a link without a limit',
      { maxDownloads: null, downloadCount: 900 },
      'Usable',
      '使える',
    ],
    [
      'a link at its end',
      { expiresAt: NOW.toISOString() },
      'Expired',
      '期限切れ',
    ],
    [
      'a link at its limit',
      { maxDownloads: 1, downloadCount: 1 },
      'Download limit reached',
      '回数の上限に達した',
    ],
    [
      'a link at its end and at its limit',
      {
        expiresAt: '2026-11-21T00:00:00.000Z',
        maxDownloads: 1,
        downloadCount: 1,
      },
      'Expired',
      '期限切れ',
    ],
  ])('should say of %s that it is %o', (_, changed, en, ja) => {
    expect(
      stateNameOf(stateOf({ ...forTheCustomer, ...changed }, NOW)),
    ).toEqual({ en, ja })
  })
})

describe('the words of a link', () => {
  it('should say how often a link gave its file, against its limit, with the separators of the language', () => {
    expect([
      downloadsNameOf({ downloadCount: 1, maxDownloads: 3 }),
      downloadsNameOf({ downloadCount: 1200, maxDownloads: null }),
      downloadsNameOf({ downloadCount: 0, maxDownloads: 1 }),
    ]).toEqual([
      { en: '1 time (limit: 3 times)', ja: '1 回（上限 3 回）' },
      { en: '1,200 times (no limit)', ja: '1,200 回（上限なし）' },
      { en: '0 times (limit: 1 time)', ja: '0 回（上限 1 回）' },
    ])
  })

  it('should say the limit of a link, and whether it has a password', () => {
    expect([
      limitNameOf(5),
      limitNameOf(null),
      passwordNameOf(true),
      passwordNameOf(false),
    ]).toEqual([
      { en: '5 times', ja: '5 回' },
      { en: 'No limit', ja: '上限なし' },
      { en: 'Set', ja: 'あり' },
      { en: 'None', ja: 'なし' },
    ])
  })
})

describe('afterRevoking', () => {
  it.each<[string, Parameters<typeof afterRevoking>[0], unknown]>([
    [
      'a role that shares no file',
      { type: 'forbidden' },
      {
        en: `This account cannot revoke this share link. ${SHARERS.en}`,
        ja: `このアカウントでは、この共有リンクを取り消せません。${SHARERS.ja}`,
      },
    ],
    ['too many requests', { type: 'tooManyRequests' }, TOO_MANY_REQUESTS],
    [
      'a failure',
      { type: 'failed' },
      {
        en: 'Could not revoke the share link. Check your connection and try again.',
        ja: '共有リンクを取り消せませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])(
    'should say in the dialog why %s did not revoke the link',
    (_, outcome, message) => {
      expect(afterRevoking(outcome)).toEqual(message)
    },
  )
})
