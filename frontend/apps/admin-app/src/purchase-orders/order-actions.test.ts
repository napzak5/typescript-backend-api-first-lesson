import type { ModelsOrderStatusType } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { pendingOrder } from './components/examples'
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
import type { OrderStep } from './purchase-orders-api'

/** The values of a form, under the names of its controls */
const formOf = (entries: Record<string, string>): FormData => {
  const values = new FormData()
  for (const [name, value] of Object.entries(entries)) {
    values.set(name, value)
  }

  return values
}

const APPROVERS_ONLY =
  '発注を承認し、取り消せるのは、サロンのオーナーとマネージャーと、管理者です。'
const CANCELLED_BY_APPROVERS =
  '発注を取り消せるのは、サロンのオーナーとマネージャーと、管理者です。'

describe('orderActionsOf and orderActionNoteOf', () => {
  it.each<
    [
      ModelsOrderStatusType,
      readonly OrderAction[],
      readonly OrderAction[],
      string | undefined,
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
      expect(orderActionsOf(status, true)).toEqual(ofApprovers)
      expect(orderActionNoteOf(status, true)).toBeUndefined()
      expect(orderActionsOf(status, false)).toEqual(ofStylists)
      expect(orderActionNoteOf(status, false)).toBe(note)
    },
  )

  it.each<[ModelsOrderStatusType, string]>([
    ['delivered', 'この発注は納品済みです。ステータスは、もう変わりません。'],
    ['cancelled', 'この発注は取り消しました。ステータスは、もう変わりません。'],
  ])(
    'should offer nothing for a %s order, to anybody, and say that it does not change',
    (status, note) => {
      expect(orderActionsOf(status, true)).toEqual([])
      expect(orderActionsOf(status, false)).toEqual([])
      expect(orderActionNoteOf(status, true)).toBe(note)
      expect(orderActionNoteOf(status, false)).toBe(note)
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
    expect(mayApproveOrders(role)).toBe(may)
  })
})

describe('MOVED_TO', () => {
  it('should move a draft to approval, an approved order to ordered and an ordered one to shipped', () => {
    expect(MOVED_TO).toEqual({
      submit: 'pending',
      order: 'ordered',
      ship: 'shipped',
    })
  })
})

describe('readOrderCancellation', () => {
  it('should hand over the reason, without the blanks around it', () => {
    expect(
      readOrderCancellation(formOf({ cancellationReason: '  在庫切れ\n' })),
    ).toEqual({ type: 'valid', request: { cancellationReason: '在庫切れ' } })
  })

  it.each<[string, FormData]>([
    ['empty', formOf({ cancellationReason: '' })],
    ['blank', formOf({ cancellationReason: ' 　\n' })],
    ['missing', formOf({})],
  ])('should ask for a reason that is %s', (_, values) => {
    expect(readOrderCancellation(values)).toEqual({
      type: 'invalid',
      errors: { cancellationReason: '取り消す理由を入力してください。' },
    })
  })
})

describe('afterOrderStep', () => {
  const changed: OrderStep = { type: 'changed', order: pendingOrder }

  it.each<[OrderAction, string]>([
    ['submit', '発注 PO-7K3M-Q9TX の承認を依頼しました。'],
    ['approve', '発注 PO-7K3M-Q9TX を承認しました。'],
    ['order', '発注 PO-7K3M-Q9TX を発注済みにしました。'],
    ['ship', '発注 PO-7K3M-Q9TX を出荷済みにしました。'],
    ['cancel', '発注 PO-7K3M-Q9TX を取り消しました。'],
  ])('should say what %s did', (action, message) => {
    expect(afterOrderStep(changed, action, 'PO-7K3M-Q9TX')).toEqual({
      type: 'done',
      message,
    })
  })

  it('should say that the order changed elsewhere', () => {
    expect(
      afterOrderStep({ type: 'conflict' }, 'approve', 'PO-7K3M-Q9TX'),
    ).toEqual({
      type: 'changed',
      message:
        '発注のステータスが、ほかの画面か端末で変わっていました。いまの発注を読み込み直しました。',
    })
  })

  it.each<[OrderStep]>([[{ type: 'notFound' }], [{ type: 'forbidden' }]])(
    'should read the order anew after %o',
    (outcome) => {
      expect(afterOrderStep(outcome, 'cancel', 'PO-7K3M-Q9TX')).toEqual({
        type: 'gone',
      })
    },
  )

  it('should ask to wait after too many requests', () => {
    expect(
      afterOrderStep({ type: 'tooManyRequests' }, 'submit', 'PO-7K3M-Q9TX'),
    ).toEqual({
      type: 'again',
      message:
        'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
    })
  })

  it.each<[OrderAction, string]>([
    ['submit', '承認を依頼できませんでした。'],
    ['approve', '承認できませんでした。'],
    ['order', '発注済みにできませんでした。'],
    ['ship', '出荷済みにできませんでした。'],
    ['cancel', '発注を取り消せませんでした。'],
  ])('should say that %s failed, and ask to try again', (action, undone) => {
    expect(afterOrderStep({ type: 'failed' }, action, 'PO-7K3M-Q9TX')).toEqual({
      type: 'again',
      message: `${undone}通信の状態を確かめて、もう一度お試しください。`,
    })
  })
})
