import { formOf } from '@beauty-salon-frontend/testing/forms'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import type {
  ErasureAsking,
  ErasureCancelling,
} from '../api/customer-erasure-api'
import { aDeletionRequest, ME } from '../components/examples'
import {
  afterErasureAsk,
  afterErasureCancel,
  erasureStateOf,
  readErasureAsk,
} from './customer-erasure'

const BY_OTHERS = {
  en: 'Owners and managers answer the requests of customers to see or erase their data.',
  ja: 'ご本人からのデータの開示と消去の請求には、オーナーとマネージャーが応えます。',
}

const BLANK_REASON = {
  en: 'Enter the reason for the request.',
  ja: '依頼の理由を入力してください。',
}

const LONG_REASON = {
  en: 'Reason for the request: enter up to 1,000 characters.',
  ja: '依頼の理由は、1,000 文字以内で入力してください。',
}

const TOO_MANY_REQUESTS = {
  en: 'There are too many requests. Wait a while and try again.',
  ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
}

const ASK_AGAIN = {
  en: 'The request could not be taken. Check your connection and try again.',
  ja: '消去の依頼を受け付けられませんでした。通信の状態を確かめて、もう一度お試しください。',
}

describe('readErasureAsk', () => {
  it('should keep the reason as it was written', () => {
    // Act
    const read = readErasureAsk(formOf({ reason: ' 店頭で\nお申し出 ' }))

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: { reason: ' 店頭で\nお申し出 ' },
    })
  })

  it.each<[string, string]>([
    ['nothing', ''],
    ['blanks alone', ' \n　'],
  ])('should take no reason of %s', (_, reason) => {
    // Act
    const read = readErasureAsk(formOf({ reason }))

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      errors: { reason: BLANK_REASON },
    })
  })

  it('should take a reason of 1,000 characters, counted as the API counts them, and none longer', () => {
    // Act
    const longest = readErasureAsk(formOf({ reason: '𠮷'.repeat(1_000) }))
    const longer = readErasureAsk(formOf({ reason: 'あ'.repeat(1_001) }))

    // Assert
    expect(longest).toMatchObject({ type: 'valid' })
    expect(longer).toEqual({
      type: 'invalid',
      errors: {
        reason: LONG_REASON,
      },
    })
  })

  it('should take a form without the control as a blank reason', () => {
    // Act
    const read = readErasureAsk(new FormData())

    // Assert
    expect(read).toMatchObject({ type: 'invalid' })
  })
})

describe('erasureStateOf', () => {
  it('should say nothing of a pending request, which is shown with its moments', () => {
    // Act
    const said = erasureStateOf(aDeletionRequest(), 'Asia/Tokyo')

    // Assert
    expect(said).toBeUndefined()
  })

  it('should say when a request was taken and called off, at the salon', () => {
    // Act
    const said = erasureStateOf(
      aDeletionRequest({
        status: 'cancelled',
        cancelledBy: ME,
        cancelledAt: '2026-11-21T06:00:00.000Z',
      }),
      'America/New_York',
    )

    // Assert
    expect(said).toEqual({
      en: 'The request taken on Thu, November 19, 2026 at 20:30 was cancelled on Sat, November 21, 2026 at 01:00.',
      ja: '2026年11月19日（木） 20:30 に受け付けた依頼は、2026年11月21日（土） 01:00 に取り消しました。',
    })
  })

  it('should say when the data was erased, and that the customer is to be told', () => {
    // Act
    const said = erasureStateOf(
      aDeletionRequest({
        status: 'completed',
        completedBy: ME,
        completedAt: '2026-12-05T00:00:00.000Z',
      }),
      'Asia/Tokyo',
    )

    // Assert
    expect(said).toEqual({
      en: 'The data was erased on Sat, December 5, 2026 at 09:00, on the request taken on Fri, November 20, 2026 at 10:30. Let the customer know that the data was erased.',
      ja: '2026年11月20日（金） 10:30 に受け付けた依頼により、2026年12月5日（土） 09:00 にデータを消去しました。消去したことを、ご本人にお知らせください。',
    })
  })

  it.each<[string, Parameters<typeof aDeletionRequest>[0], LocalizedText]>([
    [
      'called off',
      { status: 'cancelled' },
      {
        en: 'The request taken on Fri, November 20, 2026 at 10:30 was cancelled.',
        ja: '2026年11月20日（金） 10:30 に受け付けた依頼は、取り消しました。',
      },
    ],
    [
      'erased',
      { status: 'completed' },
      {
        en: 'The data was erased on the request taken on Fri, November 20, 2026 at 10:30. Let the customer know that the data was erased.',
        ja: '2026年11月20日（金） 10:30 に受け付けた依頼により、データを消去しました。消去したことを、ご本人にお知らせください。',
      },
    ],
  ])(
    'should say a request was %s without a moment it lacks',
    (_, changes, sentence) => {
      // Act
      const said = erasureStateOf(aDeletionRequest(changes), 'Asia/Tokyo')

      // Assert
      expect(said).toEqual(sentence)
    },
  )
})

describe('afterErasureAsk', () => {
  const ask = (outcome: ErasureAsking) =>
    afterErasureAsk(outcome, '田中 優希', 'Asia/Tokyo')

  it('should say whose request was taken and from when the data is erased', () => {
    // Arrange
    const request = aDeletionRequest()

    // Act
    const says = ask({ type: 'asked', request })

    // Assert
    expect(says).toEqual({
      type: 'done',
      request,
      message: {
        en: 'The request to erase the data of 田中 優希 was taken. The data will be erased on or after Fri, December 4, 2026 at 10:30.',
        ja: '田中 優希 様のデータの消去の依頼を受け付けました。2026年12月4日（金） 10:30 以降に消去します。',
      },
    })
  })

  it.each<[string, string, LocalizedText]>([
    ['too long', 'too_big', LONG_REASON],
    ['blank', 'custom', BLANK_REASON],
  ])('should say under the reason that it is %s', (_, rule, error) => {
    // Act
    const says = ask({ type: 'invalid', values: [{ field: 'reason', rule }] })

    // Assert
    expect(says).toEqual({
      type: 'again',
      message: undefined,
      errors: { reason: error },
    })
  })

  it('should say in the dialog that nothing was taken when another value was refused', () => {
    // Act
    const says = ask({
      type: 'invalid',
      values: [{ field: 'id', rule: 'invalid_format' }],
    })

    // Assert
    expect(says).toEqual({
      type: 'again',
      message: ASK_AGAIN,
      errors: {},
    })
  })

  it.each<[string, ErasureAsking, LocalizedText]>([
    [
      'another request was taken meanwhile',
      { type: 'pending' },
      {
        en: 'In the meantime, another account took a request to erase the data of this customer.',
        ja: 'その間に、ほかのアカウントがこのお客様の消去の依頼を受け付けていました。',
      },
    ],
    [
      'the account may not take one',
      { type: 'forbidden' },
      {
        en: `This account cannot take requests to erase data. ${BY_OTHERS.en}`,
        ja: `このアカウントでは、消去の依頼を受け付けられません。${BY_OTHERS.ja}`,
      },
    ],
  ])('should close the dialog and say so when %s', (_, outcome, message) => {
    // Act
    const says = ask(outcome)

    // Assert
    expect(says).toEqual({ type: 'refused', message })
  })

  it('should show the customer as removed when they left the ledger meanwhile', () => {
    // Act
    const says = ask({ type: 'notFound' })

    // Assert
    expect(says).toEqual({ type: 'gone' })
  })

  it.each<[ErasureAsking, LocalizedText]>([
    [{ type: 'tooManyRequests' }, TOO_MANY_REQUESTS],
    [{ type: 'failed' }, ASK_AGAIN],
  ])(
    'should say in the dialog what may be tried again after %o',
    (outcome, message) => {
      // Act
      const says = ask(outcome)

      // Assert
      expect(says).toEqual({ type: 'again', message, errors: {} })
    },
  )
})

describe('afterErasureCancel', () => {
  const cancel = (outcome: ErasureCancelling) =>
    afterErasureCancel(outcome, '田中 優希')

  it('should say whose request was called off', () => {
    // Arrange
    const request = aDeletionRequest({
      status: 'cancelled',
      cancelledBy: ME,
      cancelledAt: '2026-11-21T06:00:00.000Z',
    })

    // Act
    const says = cancel({ type: 'cancelled', request })

    // Assert
    expect(says).toEqual({
      type: 'done',
      request,
      message: {
        en: 'The request to erase the data of 田中 優希 was cancelled.',
        ja: '田中 優希 様のデータの消去の依頼を取り消しました。',
      },
    })
  })

  it.each<[string, ErasureCancelling, LocalizedText]>([
    [
      'no request is pending any more',
      { type: 'notFound' },
      {
        en: 'In the meantime, this request was cancelled or the data was erased.',
        ja: 'この依頼は、その間に取り消されたか、消去が実行されていました。',
      },
    ],
    [
      'the account may not call it off',
      { type: 'forbidden' },
      {
        en: `This account cannot cancel requests to erase data. ${BY_OTHERS.en}`,
        ja: `このアカウントでは、消去の依頼を取り消せません。${BY_OTHERS.ja}`,
      },
    ],
  ])('should close the dialog and say so when %s', (_, outcome, message) => {
    // Act
    const says = cancel(outcome)

    // Assert
    expect(says).toEqual({ type: 'refused', message })
  })

  it.each<[ErasureCancelling, LocalizedText]>([
    [{ type: 'tooManyRequests' }, TOO_MANY_REQUESTS],
    [
      { type: 'failed' },
      {
        en: 'The request could not be cancelled. Check your connection and try again.',
        ja: '消去の依頼を取り消せませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])(
    'should say in the dialog what may be tried again after %o',
    (outcome, message) => {
      // Act
      const says = cancel(outcome)

      // Assert
      expect(says).toEqual({ type: 'again', message, errors: {} })
    },
  )
})
