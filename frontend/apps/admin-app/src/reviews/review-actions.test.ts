import { describe, expect, it } from 'vitest'
import {
  afterReporting,
  afterResponding,
  afterWithdrawing,
  readReport,
  readResponse,
  reviewActionNoteOf,
  speaksForTheSalon,
  withdrawsAnswers,
} from './review-actions'

/** The values of a form, under the names of its controls */
const formOf = (entries: Record<string, string>): FormData => {
  const values = new FormData()
  for (const [name, value] of Object.entries(entries)) {
    values.set(name, value)
  }

  return values
}

describe('speaksForTheSalon, withdrawsAnswers and reviewActionNoteOf', () => {
  it.each<[string, boolean, boolean, string | undefined]>([
    ['owner', true, true, undefined],
    ['manager', true, true, undefined],
    [
      'admin',
      false,
      true,
      '管理者は、規約に反する返信を取り下げられます。返信を書くことと、運営への通報は、サロンのオーナーとマネージャーがします。',
    ],
    [
      'staff',
      false,
      false,
      '返信を書くことと、運営への通報ができるのは、サロンのオーナーとマネージャーです。',
    ],
  ])(
    'should let %s answer and report (%s), withdraw (%s), and say why not',
    (role, speaks, withdraws, note) => {
      expect(speaksForTheSalon(role)).toBe(speaks)
      expect(withdrawsAnswers(role)).toBe(withdraws)
      expect(reviewActionNoteOf(role)).toBe(note)
    },
  )
})

describe('readResponse', () => {
  it('should take the answer as it was written', () => {
    expect(
      readResponse(
        formOf({ ownerResponse: '  ありがとうございました。\n' }),
        null,
      ),
    ).toEqual({ type: 'valid', request: '  ありがとうございました。\n' })
  })

  it.each<[string, string]>([
    ['no answer', ''],
    ['an answer of spaces and lines alone', ' \n　'],
  ])('should ask for an answer for %s', (_, ownerResponse) => {
    expect(readResponse(formOf({ ownerResponse }), 'ありがとう')).toEqual({
      type: 'invalid',
      errors: { ownerResponse: '返信を入力してください。' },
    })
  })

  it('should say that the answer the review holds changes nothing', () => {
    expect(
      readResponse(formOf({ ownerResponse: 'ありがとう' }), 'ありがとう'),
    ).toEqual({ type: 'unchanged' })
    expect(
      readResponse(formOf({ ownerResponse: 'ありがとう ' }), 'ありがとう'),
    ).toEqual({ type: 'valid', request: 'ありがとう ' })
  })
})

describe('readReport', () => {
  it('should take a reason, and the details without the spaces around them', () => {
    expect(
      readReport(formOf({ reason: 'spam', details: '  宣伝です。 \n' })),
    ).toEqual({
      type: 'valid',
      request: { reason: 'spam', details: '宣伝です。' },
    })
  })

  it('should send no details as null', () => {
    expect(
      readReport(formOf({ reason: 'personal_information', details: '   ' })),
    ).toEqual({
      type: 'valid',
      request: { reason: 'personal_information', details: null },
    })
  })

  it('should take details of exactly 2,000 characters', () => {
    expect(
      readReport(formOf({ reason: 'other', details: '詳'.repeat(2000) })),
    ).toEqual({
      type: 'valid',
      request: { reason: 'other', details: '詳'.repeat(2000) },
    })
  })

  it.each<[string, Record<string, string>, Record<string, string>]>([
    ['no reason', { details: '' }, { reason: '通報の理由を選んでください。' }],
    [
      'a reason that is none',
      { reason: 'rude', details: '' },
      { reason: '通報の理由を選んでください。' },
    ],
    [
      '«その他» without details',
      { reason: 'other', details: ' ' },
      { details: '「その他」を選んだときは、何が問題かを入力してください。' },
    ],
    [
      'details longer than 2,000 characters',
      { reason: 'spam', details: '詳'.repeat(2001) },
      { details: '2000 文字以内で入力してください。' },
    ],
  ])('should say what is wrong with %s', (_, entries, errors) => {
    expect(readReport(formOf(entries))).toEqual({ type: 'invalid', errors })
  })
})

describe('afterResponding', () => {
  it('should say at the answer that the API refused it, and above the form what it refused besides', () => {
    expect(
      afterResponding({
        type: 'invalid',
        values: [{ field: 'ownerResponse', rule: 'too_small' }],
      }),
    ).toEqual({
      message: undefined,
      errors: { ownerResponse: '返信を入力してください。' },
    })
    expect(
      afterResponding({
        type: 'invalid',
        values: [{ field: 'reviewId', rule: 'invalid_format' }],
      }),
    ).toEqual({
      message: '入力した内容を確かめて、もう一度お試しください。',
      errors: {},
    })
  })

  it.each<['forbidden' | 'tooManyRequests' | 'failed', string]>([
    [
      'forbidden',
      'このアカウントでは、このレビューに返信できません。返信できるのは、サロンのオーナーとマネージャーです。',
    ],
    [
      'tooManyRequests',
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      'failed',
      '返信を送れませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])('should say above the form what %s means', (type, message) => {
    expect(afterResponding({ type })).toEqual({ message, errors: {} })
  })
})

describe('afterWithdrawing', () => {
  it.each<[string, Parameters<typeof afterWithdrawing>[0], string]>([
    [
      'a refused value',
      { type: 'invalid', values: [{ field: 'id', rule: 'invalid_format' }] },
      '返信を取り下げられませんでした。画面を読み込み直して、もう一度お試しください。',
    ],
    [
      'the account',
      { type: 'forbidden' },
      'このアカウントでは、この返信を取り下げられません。取り下げられるのは、サロンのオーナーとマネージャーと、管理者です。',
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      'no answer',
      { type: 'failed' },
      '返信を取り下げられませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])('should say in the dialog what %s means', (_, outcome, message) => {
    expect(afterWithdrawing(outcome)).toBe(message)
  })
})

describe('afterReporting', () => {
  it('should say at their controls what the API refused of the reason and the details', () => {
    expect(
      afterReporting({
        type: 'invalid',
        values: [
          { field: 'reason', rule: 'invalid_value' },
          { field: 'details', rule: 'too_big' },
        ],
      }),
    ).toEqual({
      message: undefined,
      errors: {
        reason: '通報の理由を選んでください。',
        details: '2000 文字以内で入力してください。',
      },
    })
    expect(
      afterReporting({
        type: 'invalid',
        values: [{ field: 'details', rule: 'custom' }],
      }),
    ).toEqual({
      message: undefined,
      errors: {
        details: '「その他」を選んだときは、何が問題かを入力してください。',
      },
    })
    expect(
      afterReporting({
        type: 'invalid',
        values: [{ field: 'reviewId', rule: 'invalid_format' }],
      }),
    ).toEqual({
      message: '入力した内容を確かめて、もう一度お試しください。',
      errors: {},
    })
  })

  it.each<['forbidden' | 'tooManyRequests' | 'failed', string]>([
    [
      'forbidden',
      'このアカウントでは、このレビューを通報できません。通報できるのは、サロンのオーナーとマネージャーです。',
    ],
    [
      'tooManyRequests',
      'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    ],
    [
      'failed',
      '通報を送れませんでした。通信の状態を確かめて、もう一度お試しください。',
    ],
  ])('should say above the form what %s means', (type, message) => {
    expect(afterReporting({ type })).toEqual({ message, errors: {} })
  })
})
