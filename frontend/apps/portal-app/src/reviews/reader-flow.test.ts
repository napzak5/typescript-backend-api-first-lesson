import {
  ModelsReviewReportReasonType,
  type ModelsUserResponse,
  type ModelsUserRoleType,
} from '@beauty-salon-frontend/api-client'
import type { Session } from '@beauty-salon-frontend/session'
import { describe, expect, it } from 'vitest'
import { profile } from '../profile/components/examples'
import type { ProfileRead } from '../profile/profile-api'
import {
  afterReport,
  DETAILS,
  MAX_DETAILS_LENGTH,
  REASON,
  REASONS,
  readerOf,
  readReport,
} from './reader-flow'

const user = (role: ModelsUserRoleType): ModelsUserResponse => ({
  id: '0193a5b2-7c4e-7d1a-9f3b-2a6c8e4d1f07',
  email: 'hanako@example.com',
  role,
  status: 'active',
  emailVerified: true,
  lastPasswordChange: null,
  twoFactorStatus: 'disabled',
  failedLoginAttempts: 0,
  lockedUntil: null,
  lastLoginAt: '2026-11-19T01:00:00.000Z',
  lastLoginIp: null,
  customerId: null,
  staffId: null,
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-19T01:00:00.000Z',
})

const signedIn = (role: ModelsUserRoleType): Session => ({
  type: 'signedIn',
  user: user(role),
})

const FOUND: ProfileRead = { type: 'found', profile }

/** The form as a browser sends it: a group of which no reason is chosen sends nothing. */
const formOf = (reason: string | undefined, details: string): FormData => {
  const values = new FormData()
  if (reason !== undefined) {
    values.set(REASON, reason)
  }
  values.set(DETAILS, details)

  return values
}

describe('readerOf', () => {
  it('should be a visitor when nobody is signed in', () => {
    expect(readerOf({ type: 'signedOut' }, undefined)).toEqual({
      type: 'visitor',
    })
  })

  it('should be a customer, under the ID of the profile, for a customer whose profile was read', () => {
    expect(readerOf(signedIn('customer'), FOUND)).toEqual({
      type: 'customer',
      customerId: profile.id,
    })
  })

  it.each<[string, ProfileRead | undefined]>([
    ['is still being read', undefined],
    ['is none: the account has not said who its customer is', { type: 'none' }],
    ['was not read for too many requests', { type: 'tooManyRequests' }],
    ['was not read', { type: 'failed' }],
  ])(
    'should be somebody who only reads for a customer whose profile %s',
    (_case, read) => {
      expect(readerOf(signedIn('customer'), read)).toEqual({ type: 'other' })
    },
  )

  it.each<ModelsUserRoleType>(['staff', 'manager', 'owner', 'admin'])(
    'should be somebody who only reads for an account with the role %s, whatever profile there is',
    (role) => {
      expect(readerOf(signedIn(role), FOUND)).toEqual({ type: 'other' })
    },
  )

  it.each<[string, Session]>([
    ['is being asked for', { type: 'loading' }],
    ['could not be asked for', { type: 'unavailable', retry: () => undefined }],
  ])(
    'should be somebody who only reads, and no visitor, while the session %s: a session is stored',
    (_case, session) => {
      expect(readerOf(session, FOUND)).toEqual({ type: 'other' })
    },
  )
})

describe('REASONS', () => {
  it('should offer every reason the API takes, and no other, each once', () => {
    expect(REASONS.map(({ value }) => value).sort()).toEqual(
      Object.values(ModelsReviewReportReasonType).sort(),
    )
  })

  it('should offer the reason that needs words last', () => {
    expect(REASONS.at(-1)).toEqual({ value: 'other', label: 'その他' })
  })

  it('should name the controls after the properties of the request', () => {
    expect([REASON, DETAILS]).toEqual(['reason', 'details'])
  })
})

describe('readReport', () => {
  it.each(REASONS.filter(({ value }) => value !== 'other'))(
    'should read the reason $value without a word about it into a request whose details are null',
    ({ value }) => {
      expect(readReport(formOf(value, ''))).toEqual({
        type: 'valid',
        value: { reason: value, details: null },
      })
    },
  )

  it('should read what was said about a reason with it', () => {
    expect(readReport(formOf('spam', '店の宣伝だけが書かれています'))).toEqual({
      type: 'valid',
      value: { reason: 'spam', details: '店の宣伝だけが書かれています' },
    })
  })

  it('should send the details without the spaces and the line breaks around them', () => {
    expect(
      readReport(formOf('other', ' \n　予約と関係がありません \n')),
    ).toEqual({
      type: 'valid',
      value: { reason: 'other', details: '予約と関係がありません' },
    })
  })

  it('should send details of spaces alone as null: the API takes no text of spaces', () => {
    expect(readReport(formOf('inappropriate', ' 　\n'))).toEqual({
      type: 'valid',
      value: { reason: 'inappropriate', details: null },
    })
  })

  it.each<[string, string | undefined]>([
    ['none was chosen', undefined],
    ['the value is none of the list', 'boring'],
    ['the value is empty', ''],
  ])('should say that a reason is missing when %s', (_case, reason) => {
    expect(readReport(formOf(reason, '何かがおかしいです'))).toEqual({
      type: 'invalid',
      errors: { reason: '通報の理由を選んでください。' },
    })
  })

  it.each([
    ['nothing', ''],
    ['spaces alone', ' 　\n'],
  ])(
    'should ask what the matter is when the reason the list does not name comes with %s',
    (_case, details) => {
      expect(readReport(formOf('other', details))).toEqual({
        type: 'invalid',
        errors: {
          details: '「その他」を選んだときは、何が問題かを入力してください。',
        },
      })
    },
  )

  it('should take details as long as the column, counted without the spaces around them', () => {
    const details = 'あ'.repeat(MAX_DETAILS_LENGTH)

    expect(readReport(formOf('other', ` ${details} `))).toEqual({
      type: 'valid',
      value: { reason: 'other', details },
    })
  })

  it('should say that details one character longer than the column are too long', () => {
    expect(
      readReport(formOf('spam', 'あ'.repeat(MAX_DETAILS_LENGTH + 1))),
    ).toEqual({
      type: 'invalid',
      errors: { details: '2000 文字以内で入力してください。' },
    })
  })

  it('should say one thing at a time: the reason first', () => {
    expect(
      readReport(formOf(undefined, 'あ'.repeat(MAX_DETAILS_LENGTH + 1))),
    ).toEqual({
      type: 'invalid',
      errors: { reason: '通報の理由を選んでください。' },
    })
  })

  it('should read a form without the control of the details as one without details', () => {
    const values = new FormData()
    values.set(REASON, 'spam')

    expect(readReport(values)).toEqual({
      type: 'valid',
      value: { reason: 'spam', details: null },
    })
  })
})

describe('afterReport', () => {
  it.each([
    [
      'the rule that ties them to the reason',
      'custom',
      '「その他」を選んだときは、何が問題かを入力してください。',
    ],
    ['their length', 'too_big', '2000 文字以内で入力してください。'],
    [
      'another rule',
      'too_small',
      'この内容は送信できません。入力し直してください。',
    ],
  ])(
    'should say at the details what the API did not take, for %s',
    (_case, rule, message) => {
      expect(
        afterReport({
          type: 'invalid',
          values: [{ field: 'details', rule }],
        }),
      ).toEqual({ message: undefined, errors: { details: message } })
    },
  )

  it('should say at the reasons that the API took none', () => {
    expect(
      afterReport({
        type: 'invalid',
        values: [{ field: 'reason', rule: 'invalid_value' }],
      }),
    ).toEqual({
      message: undefined,
      errors: { reason: '通報の理由を選んでください。' },
    })
  })

  it('should say at both controls what the API did not take of both', () => {
    expect(
      afterReport({
        type: 'invalid',
        values: [
          { field: 'details', rule: 'too_big' },
          { field: 'reason', rule: 'invalid_value' },
        ],
      }),
    ).toEqual({
      message: undefined,
      errors: {
        reason: '通報の理由を選んでください。',
        details: '2000 文字以内で入力してください。',
      },
    })
  })

  it.each([
    ['names no value', []],
    [
      'names a value the form has no control for',
      [{ field: 'id', rule: 'invalid_format' }],
    ],
  ])(
    'should say about the attempt that it is to be looked at when the API %s',
    (_case, values) => {
      expect(afterReport({ type: 'invalid', values })).toEqual({
        message: '入力した内容を確かめて、もう一度お試しください。',
        errors: {},
      })
    },
  )

  it('should say that there were too many requests, and to wait', () => {
    expect(afterReport({ type: 'tooManyRequests' })).toEqual({
      message:
        'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      errors: {},
    })
  })

  it('should say that the report was not sent, and to look at the connection', () => {
    expect(afterReport({ type: 'failed' })).toEqual({
      message:
        '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
      errors: {},
    })
  })
})
