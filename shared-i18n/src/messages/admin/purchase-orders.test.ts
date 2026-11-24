import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import { messagesOf } from '../__tests__/found-messages'
import { adminPurchaseOrderMessages, adminStaffMessages } from './index'

const { form, receipt, statuses, status, suggestions, words } =
  adminPurchaseOrderMessages

/** The number of an order */
const ORDER = 'PO-20261121-0001'

/** A moment, as the formats write it */
const MOMENT = {
  en: 'Sat, November 21, 2026 at 10:00',
  ja: '2026年11月21日（土） 10:00',
}

/** A quantity in the unit of its product, as the inventory writes it */
const QUANTITY = { en: '10 tube', ja: '10 tube' }

/** Amounts, as the formats write them */
const SUBTOTAL = { en: '¥5,500', ja: '￥5,500' }
const TAX = { en: '¥550', ja: '￥550' }
const LARGEST = { en: '¥21,474,836', ja: '￥21,474,836' }
const MOST = { en: '¥2,147,483,647', ja: '￥2,147,483,647' }

/** Every message that is made from a value, with the value and what it says */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'adminPurchaseOrderMessages.titles.numbered',
    adminPurchaseOrderMessages.titles.numbered('PO-20261121-0001'),
    {
      en: 'Purchase order PO-20261121-0001',
      ja: '発注 PO-20261121-0001',
    },
  ],
  [
    'adminPurchaseOrderMessages.orderNamed',
    adminPurchaseOrderMessages.orderNamed(ORDER),
    { en: 'order PO-20261121-0001', ja: '発注 PO-20261121-0001' },
  ],
  [
    'adminPurchaseOrderMessages.doneBy',
    adminPurchaseOrderMessages.doneBy(MOMENT, '佐藤 健'),
    {
      en: 'Sat, November 21, 2026 at 10:00 (佐藤 健)',
      ja: '2026年11月21日（土） 10:00（佐藤 健）',
    },
  ],
  [
    'adminPurchaseOrderMessages.words.orderOf',
    words.orderOf(ORDER, 'Beauty Supply Co.'),
    {
      en: 'Order PO-20261121-0001 (Beauty Supply Co.)',
      ja: '発注 PO-20261121-0001（Beauty Supply Co.）',
    },
  ],
  [
    'adminPurchaseOrderMessages.status.done.submit',
    status.done.submit(ORDER),
    {
      en: 'Asked for the approval of order PO-20261121-0001.',
      ja: '発注 PO-20261121-0001 の承認を依頼しました。',
    },
  ],
  [
    'adminPurchaseOrderMessages.status.done.approve',
    status.done.approve(ORDER),
    {
      en: 'Approved order PO-20261121-0001.',
      ja: '発注 PO-20261121-0001 を承認しました。',
    },
  ],
  [
    'adminPurchaseOrderMessages.status.done.order',
    status.done.order(ORDER),
    {
      en: 'Marked order PO-20261121-0001 as ordered.',
      ja: '発注 PO-20261121-0001 を発注済みにしました。',
    },
  ],
  [
    'adminPurchaseOrderMessages.status.done.ship',
    status.done.ship(ORDER),
    {
      en: 'Marked order PO-20261121-0001 as shipped.',
      ja: '発注 PO-20261121-0001 を出荷済みにしました。',
    },
  ],
  [
    'adminPurchaseOrderMessages.status.done.cancel',
    status.done.cancel(ORDER),
    {
      en: 'Cancelled order PO-20261121-0001.',
      ja: '発注 PO-20261121-0001 を取り消しました。',
    },
  ],
  [
    'adminPurchaseOrderMessages.status.cancellation.description',
    status.cancellation.description(ORDER, false),
    {
      en: 'Order PO-20261121-0001 will be cancelled. A cancelled order cannot be restored.',
      ja: '発注 PO-20261121-0001 を取り消します。取り消した発注は、元に戻せません。',
    },
  ],
  [
    'adminPurchaseOrderMessages.suggestions.of',
    suggestions.of('Beauty Supply Co.'),
    {
      en: 'Suggestions for Beauty Supply Co.',
      ja: 'Beauty Supply Co.の提案',
    },
  ],
  [
    'adminPurchaseOrderMessages.suggestions.entryOf',
    suggestions.entryOf('Beauty Supply Co.'),
    {
      en: 'Create an order to Beauty Supply Co.',
      ja: 'Beauty Supply Co. への発注を作る',
    },
  ],
  [
    'adminPurchaseOrderMessages.form.entry.inStock',
    form.entry.inStock(QUANTITY),
    { en: 'In stock: 10 tube', ja: '在庫数 10 tube' },
  ],
  [
    'adminPurchaseOrderMessages.form.entry.subtotal',
    form.entry.subtotal(SUBTOTAL),
    { en: 'Subtotal ¥5,500', ja: '小計 ￥5,500' },
  ],
  [
    'adminPurchaseOrderMessages.form.entry.taxDescription',
    form.entry.taxDescription({ en: '10%', ja: '10%' }, TAX),
    {
      en: 'Enter it as the bill of the supplier says. 10% of the subtotal is ¥550 (rounded down to the yen).',
      ja: '仕入先の請求に合わせて入力します。小計の 10% は ￥550 です（円未満切り捨て）。',
    },
  ],
  [
    'adminPurchaseOrderMessages.form.entry.suggested.noSupplier',
    form.entry.suggested.noSupplier(3),
    {
      en: 'Filled in the suggested quantities of the products without a supplier in 3 rows. Enter the supplier, and check the quantities and the unit prices.',
      ja: '仕入先の決まっていない商品の、発注の提案の数量を 3 行に入れました。仕入先を入力し、数量と単価を確かめてください。',
    },
  ],
  [
    'adminPurchaseOrderMessages.form.entry.suggested.of',
    form.entry.suggested.of('Beauty Supply Co.', 3),
    {
      en: 'Filled in the suggested quantities of Beauty Supply Co. in 3 rows. Check the quantities and the unit prices.',
      ja: 'Beauty Supply Co. の発注の提案の数量を 3 行に入れました。数量と単価を確かめてください。',
    },
  ],
  [
    'adminPurchaseOrderMessages.form.entry.made',
    form.entry.made(ORDER, statuses.draft),
    {
      en: 'Created order PO-20261121-0001 with the status “Draft”.',
      ja: '発注 PO-20261121-0001 を下書きとして作りました。',
    },
  ],
  [
    'adminPurchaseOrderMessages.form.entry.errors.unitPriceTooHigh',
    form.entry.errors.unitPriceTooHigh(LARGEST, MOST),
    {
      en: 'At this quantity, the unit price can be up to ¥21,474,836. The amount of a line item can be up to ¥2,147,483,647.',
      ja: 'この数量では、単価は ￥21,474,836までです。明細の金額は ￥2,147,483,647までです。',
    },
  ],
  [
    'adminPurchaseOrderMessages.form.entry.errors.tooMany',
    form.entry.errors.tooMany(100),
    {
      en: 'One order takes up to 100 rows. Put the other rows in another order.',
      ja: '1 件の発注に入れられるのは 100 行までです。残りの行は、別の発注にしてください。',
    },
  ],
  [
    'adminPurchaseOrderMessages.form.entry.errors.tooMuch',
    form.entry.errors.tooMuch(MOST),
    {
      en: 'The total would be more than ¥2,147,483,647. Split the line items into two or more orders.',
      ja: '合計が ￥2,147,483,647 を超えます。明細を分けて、発注を 2 件以上にしてください。',
    },
  ],
  [
    'adminPurchaseOrderMessages.form.change.changed',
    form.change.changed(ORDER),
    {
      en: 'Saved order PO-20261121-0001.',
      ja: '発注 PO-20261121-0001 を直しました。',
    },
  ],
  [
    'adminPurchaseOrderMessages.receipt.ordered',
    receipt.ordered(QUANTITY),
    { en: 'Ordered 10 tube', ja: '発注 10 tube' },
  ],
  [
    'adminPurchaseOrderMessages.receipt.rowRemoved',
    receipt.rowRemoved('COLOR001', 'Hair Color'),
    {
      en: 'COLOR001 Hair Color: its stock row was removed, so it cannot be received.',
      ja: 'COLOR001 Hair Color: 在庫の行が削除されたので、入荷できません。',
    },
  ],
  [
    'adminPurchaseOrderMessages.receipt.done',
    receipt.done(ORDER, 2),
    {
      en: 'Recorded the receipt of order PO-20261121-0001. Added the 2 line items that arrived to the stock.',
      ja: '発注 PO-20261121-0001 の入荷を記録しました。届いた 2 件の明細を、在庫に入れました。',
    },
  ],
  [
    'adminPurchaseOrderMessages.receipt.errors.quantity',
    receipt.errors.quantity(QUANTITY),
    {
      en: 'Enter the quantity received as a number above 0 and up to the 10 tube ordered (up to 2 decimal places).',
      ja: '届いた数量は、0 より大きく、発注した 10 tube までの数（小数は 2 桁まで）で入力してください。',
    },
  ],
  [
    'adminPurchaseOrderMessages.receipt.unreceivable.notPlaced',
    receipt.unreceivable.notPlaced(statuses.approved),
    {
      en: 'This order is “Approved”. A receipt is recorded for an order placed with the supplier (“Ordered” or “Shipped”).',
      ja: 'この発注は承認済みです。入荷は、仕入先に頼んだ発注（発注済みか出荷済み）に記録します。',
    },
  ],
]

describe('the messages of the purchase orders of the admin application', () => {
  it.each(MADE)(
    'should name the value it is made from: %s',
    (_where, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should have a value in this test for every message that is made from one', () => {
    // Assert
    expect(MADE.map(([where]) => where).toSorted()).toEqual(
      messagesOf({ adminPurchaseOrderMessages }, '').made.toSorted(),
    )
  })

  it('should say what to agree on first before an order that was shipped is cancelled', () => {
    // Assert
    expect(status.cancellation.description(ORDER, true)).toEqual({
      en: 'Order PO-20261121-0001 will be cancelled. The order was shipped: agree with the supplier on the return of the goods before cancelling it. A cancelled order cannot be restored.',
      ja: '発注 PO-20261121-0001 を取り消します。出荷済みの発注です。返品の扱いを仕入先と決めてから取り消してください。取り消した発注は、元に戻せません。',
    })
  })

  it('should say who approves and cancels orders, with what they may do in the sentence', () => {
    // Assert
    expect([status.notes.approveAndCancel, status.notes.cancel]).toEqual([
      {
        en: 'Only the owners and managers of the salon, and administrators, can approve and cancel orders.',
        ja: '発注を承認し、取り消せるのは、サロンのオーナーとマネージャーと、管理者です。',
      },
      {
        en: 'Only the owners and managers of the salon, and administrators, can cancel orders.',
        ja: '発注を取り消せるのは、サロンのオーナーとマネージャーと、管理者です。',
      },
    ])
  })

  it('should name a member of the staff the salon no longer shows as the staff say it', () => {
    // Assert
    expect(
      adminPurchaseOrderMessages.doneBy(MOMENT, adminStaffMessages.unlisted),
    ).toEqual({
      en: 'Sat, November 21, 2026 at 10:00 (Staff member not listed)',
      ja: '2026年11月21日（土） 10:00（一覧にないスタッフ）',
    })
  })

  it('should count one in the singular', () => {
    // Assert
    expect([
      form.entry.suggested.of('Beauty Supply Co.', 1).en,
      receipt.done(ORDER, 1).en,
    ]).toEqual([
      'Filled in the suggested quantities of Beauty Supply Co. in 1 row. Check the quantities and the unit prices.',
      'Recorded the receipt of order PO-20261121-0001. Added the 1 line item that arrived to the stock.',
    ])
  })
})
