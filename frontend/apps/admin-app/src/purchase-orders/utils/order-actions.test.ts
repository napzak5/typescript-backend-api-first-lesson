import type { ModelsOrderStatusType } from '@beauty-salon-frontend/api-client'
import { formOf } from '@beauty-salon-frontend/testing/forms'
import { describe, expect, it } from 'vitest'
import type { OrderStep } from '../api/purchase-orders-api'
import { pendingOrder } from '../components/examples'
import {
  afterOrderStep,
  isClosedOrder,
  isReceivableOrder,
  MOVED_TO,
  mayApproveOrders,
  type OrderAction,
  orderActionNoteOf,
  orderActionsOf,
  readOrderCancellation,
} from './order-actions'

/** A text in every language */
type Said = { en: string; ja: string }

const APPROVERS_ONLY = {
  en: 'Only the owners and managers of the salon, and administrators, can approve and cancel orders.',
  ja: '発注を承認し、取り消せるのは、サロンのオーナーとマネージャーと、管理者です。',
}
const CANCELLED_BY_APPROVERS = {
  en: 'Only the owners and managers of the salon, and administrators, can cancel orders.',
  ja: '発注を取り消せるのは、サロンのオーナーとマネージャーと、管理者です。',
}

describe('orderActionsOf and orderActionNoteOf', () => {
  it.each<
    [
      ModelsOrderStatusType,
      readonly OrderAction[],
      readonly OrderAction[],
      Said | undefined,
    ]
  >([
    ['draft', ['submit', 'cancel'], ['submit'], CANCELLED_BY_APPROVERS],
    ['pending', ['approve', 'cancel'], [], APPROVERS_ONLY],
    ['approved', ['order', 'cancel'], ['order'], CANCELLED_BY_APPROVERS],
    ['ordered', ['ship', 'cancel'], ['ship'], CANCELLED_BY_APPROVERS],
    ['shipped', ['cancel'], [], CANCELLED_BY_APPROVERS],
  ])(
    'should offer an approver everything a %s order takes, and a stylist what is not for the approvers',
    (status, ofApprovers, ofStylists, note) => {
      // Assert
      expect(orderActionsOf(status, true)).toEqual(ofApprovers)
      expect(orderActionNoteOf(status, true)).toBeUndefined()
      expect(orderActionsOf(status, false)).toEqual(ofStylists)
      expect(orderActionNoteOf(status, false)).toEqual(note)
    },
  )

  it.each<[ModelsOrderStatusType, Said]>([
    [
      'delivered',
      {
        en: 'This order was delivered. Its status does not change any more.',
        ja: 'この発注は納品済みです。ステータスは、もう変わりません。',
      },
    ],
    [
      'cancelled',
      {
        en: 'This order was cancelled. Its status does not change any more.',
        ja: 'この発注は取り消しました。ステータスは、もう変わりません。',
      },
    ],
  ])(
    'should offer nothing for a %s order, to anybody, and say that it does not change',
    (status, note) => {
      // Assert
      expect(orderActionsOf(status, true)).toEqual([])
      expect(orderActionsOf(status, false)).toEqual([])
      expect(orderActionNoteOf(status, true)).toEqual(note)
      expect(orderActionNoteOf(status, false)).toEqual(note)
    },
  )
})

describe('isClosedOrder', () => {
  it.each<[ModelsOrderStatusType, boolean]>([
    ['draft', false],
    ['pending', false],
    ['approved', false],
    ['ordered', false],
    ['shipped', false],
    ['delivered', true],
    ['cancelled', true],
  ])('should tell whether a %s order is closed: %s', (status, closed) => {
    // Assert
    expect(isClosedOrder(status)).toBe(closed)
  })
})

describe('isReceivableOrder', () => {
  it.each<[ModelsOrderStatusType, boolean]>([
    ['draft', false],
    ['pending', false],
    ['approved', false],
    ['ordered', true],
    ['shipped', true],
    ['delivered', false],
    ['cancelled', false],
  ])(
    'should tell whether the goods of a %s order are received: %s',
    (status, receivable) => {
      // Assert
      expect(isReceivableOrder(status)).toBe(receivable)
    },
  )
})

describe('mayApproveOrders', () => {
  it.each<[string, boolean]>([
    ['owner', true],
    ['manager', true],
    ['admin', true],
    ['staff', false],
    ['customer', false],
  ])('should tell whether the role %s approves orders: %s', (role, may) => {
    // Assert
    expect(mayApproveOrders(role)).toBe(may)
  })
})

describe('MOVED_TO', () => {
  it('should move a draft to approval, an approved order to ordered and an ordered one to shipped', () => {
    // Assert
    expect(MOVED_TO).toEqual({
      submit: 'pending',
      order: 'ordered',
      ship: 'shipped',
    })
  })
})

describe('readOrderCancellation', () => {
  it('should hand over the reason, without the blanks around it', () => {
    // Assert
    expect(
      readOrderCancellation(formOf({ cancellationReason: '  在庫切れ\n' })),
    ).toEqual({ type: 'valid', value: { cancellationReason: '在庫切れ' } })
  })

  it.each<[string, FormData]>([
    ['empty', formOf({ cancellationReason: '' })],
    ['blank', formOf({ cancellationReason: ' 　\n' })],
    ['missing', formOf({})],
  ])('should ask for a reason that is %s', (_, values) => {
    // Assert
    expect(readOrderCancellation(values)).toEqual({
      type: 'invalid',
      errors: {
        cancellationReason: {
          en: 'Enter the reason for the cancellation.',
          ja: '取り消す理由を入力してください。',
        },
      },
    })
  })
})

describe('afterOrderStep', () => {
  const changed: OrderStep = { type: 'changed', order: pendingOrder }

  it.each<[OrderAction, Said]>([
    [
      'submit',
      {
        en: 'Asked for the approval of order PO-7K3M-Q9TX.',
        ja: '発注 PO-7K3M-Q9TX の承認を依頼しました。',
      },
    ],
    [
      'approve',
      {
        en: 'Approved order PO-7K3M-Q9TX.',
        ja: '発注 PO-7K3M-Q9TX を承認しました。',
      },
    ],
    [
      'order',
      {
        en: 'Marked order PO-7K3M-Q9TX as ordered.',
        ja: '発注 PO-7K3M-Q9TX を発注済みにしました。',
      },
    ],
    [
      'ship',
      {
        en: 'Marked order PO-7K3M-Q9TX as shipped.',
        ja: '発注 PO-7K3M-Q9TX を出荷済みにしました。',
      },
    ],
    [
      'cancel',
      {
        en: 'Cancelled order PO-7K3M-Q9TX.',
        ja: '発注 PO-7K3M-Q9TX を取り消しました。',
      },
    ],
  ])('should say what %s did', (action, message) => {
    // Assert
    expect(afterOrderStep(changed, action, 'PO-7K3M-Q9TX')).toEqual({
      type: 'done',
      message,
    })
  })

  it('should say that the order changed elsewhere', () => {
    // Assert
    expect(
      afterOrderStep({ type: 'conflict' }, 'approve', 'PO-7K3M-Q9TX'),
    ).toEqual({
      type: 'changed',
      message: {
        en: 'The status of the order was changed on another screen or device. The order was loaded again as it is now.',
        ja: '発注のステータスが、ほかの画面か端末で変わっていました。いまの発注を読み込み直しました。',
      },
    })
  })

  it.each<[OrderStep]>([[{ type: 'notFound' }], [{ type: 'forbidden' }]])(
    'should read the order anew after %o',
    (outcome) => {
      // Assert
      expect(afterOrderStep(outcome, 'cancel', 'PO-7K3M-Q9TX')).toEqual({
        type: 'gone',
      })
    },
  )

  it('should ask to wait after too many requests', () => {
    // Assert
    expect(
      afterOrderStep({ type: 'tooManyRequests' }, 'submit', 'PO-7K3M-Q9TX'),
    ).toEqual({
      type: 'again',
      message: {
        en: 'There are too many requests. Wait a while and try again.',
        ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    })
  })

  it.each<[OrderAction, Said]>([
    [
      'submit',
      {
        en: 'Could not ask for the approval.',
        ja: '承認を依頼できませんでした。',
      },
    ],
    [
      'approve',
      { en: 'Could not approve the order.', ja: '承認できませんでした。' },
    ],
    [
      'order',
      {
        en: 'Could not mark the order as ordered.',
        ja: '発注済みにできませんでした。',
      },
    ],
    [
      'ship',
      {
        en: 'Could not mark the order as shipped.',
        ja: '出荷済みにできませんでした。',
      },
    ],
    [
      'cancel',
      { en: 'Could not cancel the order.', ja: '発注を取り消せませんでした。' },
    ],
  ])('should say that %s failed, and ask to try again', (action, undone) => {
    // Assert
    expect(afterOrderStep({ type: 'failed' }, action, 'PO-7K3M-Q9TX')).toEqual({
      type: 'again',
      message: {
        en: `${undone.en} Check your connection and try again.`,
        ja: `${undone.ja}通信の状態を確かめて、もう一度お試しください。`,
      },
    })
  })
})
