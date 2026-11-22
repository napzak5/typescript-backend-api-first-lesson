import { formOf } from '@beauty-salon-frontend/testing/forms'
import { describe, expect, it } from 'vitest'
import {
  type AcknowledgementSays,
  acknowledgementOf,
  afterAcknowledgement,
} from './alert-acknowledgement'
import type { AlertAcknowledgement } from './alerts-api'
import { expiredColourAlert, outOfGlovesAlert } from './components/examples'

describe('acknowledgementOf', () => {
  it('should name the alert as it was read, with the notes trimmed', () => {
    expect(
      acknowledgementOf(
        expiredColourAlert,
        formOf({ notes: '  返品を問い合わせた。\n' }),
      ),
    ).toEqual({
      alert: 'expired',
      productId: expiredColourAlert.productId,
      inventoryId: expiredColourAlert.inventoryId,
      notes: '返品を問い合わせた。',
    })
  })

  it('should send no notes when they are blank', () => {
    expect(
      acknowledgementOf(outOfGlovesAlert, formOf({ notes: ' \n ' })),
    ).toEqual({
      alert: 'low_stock',
      productId: outOfGlovesAlert.productId,
      inventoryId: null,
      notes: null,
    })
  })
})

describe('afterAcknowledgement', () => {
  it.each<[string, AlertAcknowledgement, AcknowledgementSays]>([
    [
      'an acknowledgement',
      { type: 'acknowledged', alert: outOfGlovesAlert },
      {
        type: 'done',
        message: 'ニトリル手袋 M（SUP-GLOVE）の在庫僅少を確認済みにしました。',
      },
    ],
    [
      'an alert no longer there',
      { type: 'gone' },
      {
        type: 'refused',
        message:
          'ニトリル手袋 M（SUP-GLOVE）の在庫僅少は、もう出ていません。その間に、在庫が動いたか、商品が変わりました。アラートを読み直しました。',
      },
    ],
    [
      'an alert acknowledged meanwhile',
      { type: 'acknowledgedAlready' },
      {
        type: 'refused',
        message:
          'ニトリル手袋 M（SUP-GLOVE）の在庫僅少は、その間に、ほかの人が確認済みにしました。アラートを読み直しました。',
      },
    ],
    [
      'the account',
      { type: 'forbidden' },
      {
        type: 'refused',
        message:
          'このアカウントでは、このサロンのアラートを確認済みにできません。',
      },
    ],
    [
      'too many requests',
      { type: 'tooManyRequests' },
      {
        type: 'again',
        message:
          'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      'no answer',
      { type: 'failed' },
      {
        type: 'again',
        message:
          'アラートを確認済みにできませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say what became of %s', (_, outcome, says) => {
    expect(afterAcknowledgement(outcome, outOfGlovesAlert)).toEqual(says)
  })
})
