import { formOf } from '@beauty-salon-frontend/testing/forms'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
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

/** What the API says of too many requests, and of the values it refused */
const TOO_MANY_REQUESTS: LocalizedText = {
  en: 'There are too many requests. Wait a while and try again.',
  ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
}
const CHECK_THE_VALUES: LocalizedText = {
  en: 'Check what you entered and try again.',
  ja: '入力した内容を確かめて、もう一度お試しください。',
}

/** What the forms say at their controls */
const REASON_MISSING: LocalizedText = {
  en: 'Choose the reason for the report.',
  ja: '通報の理由を選んでください。',
}
const DETAILS_MISSING: LocalizedText = {
  en: 'When you choose “Other”, say what the problem is.',
  ja: '「その他」を選んだときは、何が問題かを入力してください。',
}
const DETAILS_TOO_LONG: LocalizedText = {
  en: 'Enter up to 2,000 characters.',
  ja: '2,000 文字以内で入力してください。',
}
const RESPONSE_MISSING: LocalizedText = {
  en: 'Enter the response.',
  ja: '返信を入力してください。',
}

describe('speaksForTheSalon, withdrawsAnswers and reviewActionNoteOf', () => {
  it.each<[string, boolean, boolean, LocalizedText | undefined]>([
    ['owner', true, true, undefined],
    ['manager', true, true, undefined],
    [
      'admin',
      false,
      true,
      {
        en: 'An administrator can withdraw a response that breaks the terms. The owners and managers of the salon write the responses and report reviews to the team that runs the site.',
        ja: '管理者は、規約に反する返信を取り下げられます。返信を書くことと、運営への通報は、サロンのオーナーとマネージャーがします。',
      },
    ],
    [
      'staff',
      false,
      false,
      {
        en: 'Only the owners and managers of the salon can write responses and report reviews to the team that runs the site.',
        ja: '返信を書くことと、運営への通報ができるのは、サロンのオーナーとマネージャーです。',
      },
    ],
  ])(
    'should let %s answer and report (%s), withdraw (%s), and say why not',
    (role, speaks, withdraws, note) => {
      // Assert
      expect(speaksForTheSalon(role)).toBe(speaks)
      expect(withdrawsAnswers(role)).toBe(withdraws)
      expect(reviewActionNoteOf(role)).toEqual(note)
    },
  )

  it('should say to no role what it says to a role of no operation', () => {
    // Act
    const note = reviewActionNoteOf(undefined)

    // Assert
    expect(note).toEqual(reviewActionNoteOf('staff'))
  })
})

describe('readResponse', () => {
  it('should take the answer as it was written', () => {
    expect(
      readResponse(
        formOf({ ownerResponse: '  ありがとうございました。\n' }),
        null,
      ),
    ).toEqual({ type: 'valid', value: '  ありがとうございました。\n' })
  })

  it.each<[string, string]>([
    ['no answer', ''],
    ['an answer of spaces and lines alone', ' \n　'],
  ])('should ask for an answer for %s', (_, ownerResponse) => {
    expect(readResponse(formOf({ ownerResponse }), 'ありがとう')).toEqual({
      type: 'invalid',
      errors: { ownerResponse: RESPONSE_MISSING },
    })
  })

  it('should say that the answer the review holds changes nothing', () => {
    expect(
      readResponse(formOf({ ownerResponse: 'ありがとう' }), 'ありがとう'),
    ).toEqual({ type: 'unchanged' })
    expect(
      readResponse(formOf({ ownerResponse: 'ありがとう ' }), 'ありがとう'),
    ).toEqual({ type: 'valid', value: 'ありがとう ' })
  })
})

describe('readReport', () => {
  it('should take a reason, and the details without the spaces around them', () => {
    expect(
      readReport(formOf({ reason: 'spam', details: '  宣伝です。 \n' })),
    ).toEqual({
      type: 'valid',
      value: { reason: 'spam', details: '宣伝です。' },
    })
  })

  it('should send no details as null', () => {
    expect(
      readReport(formOf({ reason: 'personal_information', details: '   ' })),
    ).toEqual({
      type: 'valid',
      value: { reason: 'personal_information', details: null },
    })
  })

  it('should take details of exactly 2,000 characters, counted as the API counts them', () => {
    expect(
      readReport(formOf({ reason: 'other', details: '𠮷'.repeat(2000) })),
    ).toEqual({
      type: 'valid',
      value: { reason: 'other', details: '𠮷'.repeat(2000) },
    })
  })

  it.each<[string, Record<string, string>, Record<string, LocalizedText>]>([
    ['no reason', { details: '' }, { reason: REASON_MISSING }],
    [
      'a reason that is none',
      { reason: 'rude', details: '' },
      { reason: REASON_MISSING },
    ],
    [
      '«その他» without details',
      { reason: 'other', details: ' ' },
      { details: DETAILS_MISSING },
    ],
    [
      'details longer than 2,000 characters',
      { reason: 'spam', details: '詳'.repeat(2001) },
      { details: DETAILS_TOO_LONG },
    ],
  ])('should say what is wrong with %s', (_, entries, errors) => {
    // Act
    const read = readReport(formOf(entries))

    // Assert
    expect(read).toEqual({ type: 'invalid', errors })
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
      errors: { ownerResponse: RESPONSE_MISSING },
    })
    expect(
      afterResponding({
        type: 'invalid',
        values: [{ field: 'reviewId', rule: 'invalid_format' }],
      }),
    ).toEqual({
      message: CHECK_THE_VALUES,
      errors: {},
    })
  })

  it.each<['forbidden' | 'tooManyRequests' | 'failed', LocalizedText]>([
    [
      'forbidden',
      {
        en: 'This account cannot respond to this review. Only the owners and managers of the salon can respond.',
        ja: 'このアカウントでは、このレビューに返信できません。返信できるのは、サロンのオーナーとマネージャーです。',
      },
    ],
    ['tooManyRequests', TOO_MANY_REQUESTS],
    [
      'failed',
      {
        en: 'Could not send the response. Check your connection and try again.',
        ja: '返信を送れませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say above the form what %s means', (type, message) => {
    // Act
    const said = afterResponding({ type })

    // Assert
    expect(said).toEqual({ message, errors: {} })
  })
})

describe('afterWithdrawing', () => {
  it.each<[string, Parameters<typeof afterWithdrawing>[0], LocalizedText]>([
    [
      'a refused value',
      { type: 'invalid', values: [{ field: 'id', rule: 'invalid_format' }] },
      {
        en: 'Could not withdraw the response. Reload the screen and try again.',
        ja: '返信を取り下げられませんでした。画面を読み込み直して、もう一度お試しください。',
      },
    ],
    [
      'the account',
      { type: 'forbidden' },
      {
        en: 'This account cannot withdraw this response. Only the owners and managers of the salon, and administrators, can withdraw it.',
        ja: 'このアカウントでは、この返信を取り下げられません。取り下げられるのは、サロンのオーナーとマネージャーと、管理者です。',
      },
    ],
    ['too many requests', { type: 'tooManyRequests' }, TOO_MANY_REQUESTS],
    [
      'no answer',
      { type: 'failed' },
      {
        en: 'Could not withdraw the response. Check your connection and try again.',
        ja: '返信を取り下げられませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say in the dialog what %s means', (_, outcome, message) => {
    // Act
    const said = afterWithdrawing(outcome)

    // Assert
    expect(said).toEqual(message)
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
        reason: REASON_MISSING,
        details: DETAILS_TOO_LONG,
      },
    })
    expect(
      afterReporting({
        type: 'invalid',
        values: [{ field: 'details', rule: 'custom' }],
      }),
    ).toEqual({
      message: undefined,
      errors: { details: DETAILS_MISSING },
    })
    expect(
      afterReporting({
        type: 'invalid',
        values: [{ field: 'reviewId', rule: 'invalid_format' }],
      }),
    ).toEqual({
      message: CHECK_THE_VALUES,
      errors: {},
    })
  })

  it('should say at the reason alone that the API refused the reason alone', () => {
    // Act
    const said = afterReporting({
      type: 'invalid',
      values: [{ field: 'reason', rule: 'invalid_value' }],
    })

    // Assert
    expect(said).toEqual({
      message: undefined,
      errors: { reason: REASON_MISSING },
    })
  })

  it.each<['forbidden' | 'tooManyRequests' | 'failed', LocalizedText]>([
    [
      'forbidden',
      {
        en: 'This account cannot report this review. Only the owners and managers of the salon can report a review.',
        ja: 'このアカウントでは、このレビューを通報できません。通報できるのは、サロンのオーナーとマネージャーです。',
      },
    ],
    ['tooManyRequests', TOO_MANY_REQUESTS],
    [
      'failed',
      {
        en: 'Could not send the report. Check your connection and try again.',
        ja: '通報を送れませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say above the form what %s means', (type, message) => {
    // Act
    const said = afterReporting({ type })

    // Assert
    expect(said).toEqual({ message, errors: {} })
  })
})
