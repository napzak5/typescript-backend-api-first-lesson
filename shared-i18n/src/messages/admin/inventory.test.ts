import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import { messagesOf } from '../__tests__/found-messages'
import { adminInventoryMessages } from './index'

const {
  alerts,
  count,
  filter,
  movements,
  removal,
  words,
  inUnit,
  placeOf,
  productNamed,
  rowNamed,
} = adminInventoryMessages

/** A moment, as the formats write it */
const MOMENT = {
  en: 'Tue, November 24, 2026 at 10:30',
  ja: '2026年11月24日（火） 10:30',
}

/** A member of the staff, by the name the salon shows */
const MEMBER = { en: '佐藤 健', ja: '佐藤 健' }

/** A quantity, as the formats write it, in the unit of its product */
const TWELVE = inUnit({ en: '12.5', ja: '12.5' }, 'bottle')
const TWO = inUnit({ en: '2', ja: '2' }, 'bottle')

/** A stock row of a product, by the name of its product and its lot */
const ROW = rowNamed('Hair Color', 'LOT-1')

/** An alert of a product, by its kind and the product */
const LOW_STOCK = alerts.kinds.low_stock
const PRODUCT = productNamed('Hair Color', 'COLOR001')

/** An amount, as the formats write it */
const AMOUNT = { en: '¥12,000', ja: '￥12,000' }

/** Every message that is made from a value, with the value and what it says */
const MADE: [string, LocalizedText | null, LocalizedText][] = [
  [
    'adminInventoryMessages.productNamed',
    PRODUCT,
    { en: 'Hair Color (COLOR001)', ja: 'Hair Color（COLOR001）' },
  ],
  [
    'adminInventoryMessages.rowNamed',
    ROW,
    { en: 'Hair Color (lot LOT-1)', ja: 'Hair Color（ロット LOT-1）' },
  ],
  [
    'adminInventoryMessages.inUnit',
    TWELVE,
    { en: '12.5 bottle', ja: '12.5 bottle' },
  ],
  [
    'adminInventoryMessages.placeOf',
    placeOf('Storage Room A', 'B-2'),
    { en: 'Storage Room A (shelf B-2)', ja: 'Storage Room A（棚 B-2）' },
  ],
  [
    'adminInventoryMessages.words.byWhom',
    words.byWhom(MOMENT, MEMBER),
    {
      en: 'Tue, November 24, 2026 at 10:30 (佐藤 健)',
      ja: '2026年11月24日（火） 10:30（佐藤 健）',
    },
  ],
  [
    'adminInventoryMessages.filter.notCarried',
    filter.notCarried(PRODUCT),
    {
      en: 'Hair Color (COLOR001), no longer carried',
      ja: 'Hair Color（COLOR001）・取り扱いをやめた',
    },
  ],
  [
    'adminInventoryMessages.filter.within',
    filter.within(30),
    { en: 'Within 30 days', ja: '30 日後まで' },
  ],
  [
    'adminInventoryMessages.form.lotDescription',
    adminInventoryMessages.form.lotDescription(100),
    {
      en: 'Up to 100 characters. A lot number another stock row of this product has cannot be used.',
      ja: '100 文字まで。この商品のほかの在庫の行と同じロット番号は使えません。',
    },
  ],
  [
    'adminInventoryMessages.errors.lotNeeded',
    adminInventoryMessages.errors.lotNeeded(100),
    {
      en: 'Lot number: enter 1 to 100 characters. This product keeps its stock by lot numbers.',
      ja: 'ロット番号を、100 文字以内で入力してください。この商品は、在庫をロット番号で分けます。',
    },
  ],
  [
    'adminInventoryMessages.added',
    adminInventoryMessages.added(ROW),
    {
      en: 'Added the stock row “Hair Color (lot LOT-1)”.',
      ja: '在庫の行「Hair Color（ロット LOT-1）」を足しました。',
    },
  ],
  [
    'adminInventoryMessages.changed',
    adminInventoryMessages.changed(ROW),
    {
      en: 'Saved the stock row “Hair Color (lot LOT-1)”.',
      ja: '在庫の行「Hair Color（ロット LOT-1）」を直しました。',
    },
  ],
  [
    'adminInventoryMessages.removal.confirm',
    removal.confirm(ROW),
    {
      en: 'Remove the stock row “Hair Color (lot LOT-1)”?',
      ja: '在庫の行「Hair Color（ロット LOT-1）」を削除しますか？',
    },
  ],
  [
    'adminInventoryMessages.removal.done',
    removal.done(ROW),
    {
      en: 'Removed the stock row “Hair Color (lot LOT-1)”.',
      ja: '在庫の行「Hair Color（ロット LOT-1）」を削除しました。',
    },
  ],
  [
    'adminInventoryMessages.removal.inStock',
    removal.inStock(ROW),
    {
      en: 'The stock row “Hair Color (lot LOT-1)” still has stock, so it cannot be removed. Bring its stock to 0 with a stock movement, then remove it.',
      ja: '在庫の行「Hair Color（ロット LOT-1）」は、在庫数が 0 でないので、削除できません。在庫の移動で在庫数を 0 にしてから、削除してください。',
    },
  ],
  [
    'adminInventoryMessages.movements.increase',
    movements.increase(TWELVE),
    { en: '+12.5 bottle', ja: '+12.5 bottle' },
  ],
  [
    'adminInventoryMessages.movements.decrease',
    movements.decrease(TWELVE),
    { en: '−12.5 bottle', ja: '−12.5 bottle' },
  ],
  [
    'adminInventoryMessages.movements.form.about',
    movements.form.about(ROW, TWELVE, TWO),
    {
      en: 'Hair Color (lot LOT-1). In stock now: 12.5 bottle, of which 2 bottle available.',
      ja: 'Hair Color（ロット LOT-1）。いまの在庫数は 12.5 bottle、そのうち使える数は 2 bottle です。',
    },
  ],
  [
    'adminInventoryMessages.movements.form.countedIn',
    movements.form.countedIn('bottle'),
    {
      en: 'Counted in bottle. Up to 2 decimal places.',
      ja: 'bottle で数えます。小数は 2 桁まで。',
    },
  ],
  [
    'adminInventoryMessages.movements.errors.atMost',
    movements.errors.atMost(TWO),
    {
      en: 'At most 2 bottle is available to take out.',
      ja: '減らせるのは、使える数の 2 bottle までです。',
    },
  ],
  [
    'adminInventoryMessages.movements.reasonOf',
    movements.reasonOf('破損のため', false),
    { en: '破損のため', ja: '破損のため' },
  ],
  [
    'adminInventoryMessages.movements.recorded',
    movements.recorded(movements.kinds.purchase, TWELVE),
    {
      en: 'Recorded: Purchase. The stock is now 12.5 bottle.',
      ja: '仕入れを記録しました。在庫数は 12.5 bottle になりました。',
    },
  ],
  [
    'adminInventoryMessages.movements.history.about',
    movements.history.about(ROW, TWELVE),
    {
      en: 'Hair Color (lot LOT-1). In stock: 12.5 bottle.',
      ja: 'Hair Color（ロット LOT-1）。在庫数は 12.5 bottle です。',
    },
  ],
  [
    'adminInventoryMessages.count.form.books',
    count.form.books(TWELVE, TWO, placeOf(null, 'B-2')),
    {
      en: 'On the books: 12.5 bottle (2 bottle reserved), stored at Shelf B-2',
      ja: '帳簿の在庫数 12.5 bottle（うち引き当て 2 bottle）、保管場所 棚 B-2',
    },
  ],
  [
    'adminInventoryMessages.count.errors.belowReserved',
    count.errors.belowReserved(TWO),
    {
      en: 'This is below the 2 bottle reserved. Count the reserved stock as well.',
      ja: '引き当てた数の 2 bottle を下回ります。引き当てた在庫も、数えた数に入れてください。',
    },
  ],
  [
    'adminInventoryMessages.count.errors.tooMany',
    count.errors.tooMany(500),
    {
      en: 'Up to 500 rows can be recorded at once. Record these, then count the remaining rows again.',
      ja: '一度に記録できるのは 500 行までです。残りの行は、記録したあとに、もう一度棚卸しをして記録してください。',
    },
  ],
  [
    'adminInventoryMessages.count.done',
    count.done(3, 1),
    {
      en: 'Recorded the count of 3 rows. Rows that differed from the books: 1.',
      ja: '3 行の棚卸しを記録しました。帳簿の在庫数と差のあった行は 1 行です。',
    },
  ],
  [
    'adminInventoryMessages.count.value.itemsOf',
    count.value.itemsOf(1_200),
    { en: '1,200 items', ja: '1,200 品目' },
  ],
  [
    'adminInventoryMessages.count.value.total',
    count.value.total(AMOUNT, 3),
    {
      en: 'The inventory is worth ¥12,000 in all (3 items). It is the stock times the purchase price of each product; a product without a purchase price counts for nothing.',
      ja: '在庫評価額の合計は ￥12,000（3 品目）です。在庫数に商品の仕入価格を掛けた額で、仕入価格のない商品は 0 円として数えます。',
    },
  ],
  [
    'adminInventoryMessages.alerts.summary.alertsOf',
    alerts.summary.alertsOf(2),
    { en: '2 alerts', ja: '2 件' },
  ],
  [
    'adminInventoryMessages.alerts.summary.allAcknowledged',
    alerts.summary.allAcknowledged(3),
    {
      en: 'Alerts raised now: 3, all of them acknowledged.',
      ja: '今出ているアラートは 3 件で、どれも確認済みです。',
    },
  ],
  [
    'adminInventoryMessages.alerts.summary.someNotAcknowledged',
    alerts.summary.someNotAcknowledged(3, 1),
    {
      en: 'Alerts raised now: 3, of which 1 not acknowledged.',
      ja: '今出ているアラートは 3 件で、そのうち 1 件が未確認です。',
    },
  ],
  [
    'adminInventoryMessages.alerts.table.expiryOf',
    alerts.table.expiryOf(words.noExpiry),
    { en: 'Expiry: No expiry', ja: '使用期限 期限なし' },
  ],
  [
    'adminInventoryMessages.alerts.table.thresholdOf',
    alerts.table.thresholdOf(alerts.minimum, TWO),
    { en: 'Minimum stock: 2 bottle', ja: '最低在庫数 2 bottle' },
  ],
  [
    'adminInventoryMessages.alerts.table.acknowledgeLabel',
    alerts.table.acknowledgeLabel(LOW_STOCK, PRODUCT),
    {
      en: 'Acknowledge the alert “Low stock” for Hair Color (COLOR001)',
      ja: 'Hair Color（COLOR001）の在庫僅少を確認済みにする',
    },
  ],
  [
    'adminInventoryMessages.alerts.dialog.title',
    alerts.dialog.title(LOW_STOCK, PRODUCT),
    {
      en: 'Acknowledge the alert “Low stock” for Hair Color (COLOR001)?',
      ja: 'Hair Color（COLOR001）の在庫僅少を確認済みにしますか？',
    },
  ],
  [
    'adminInventoryMessages.alerts.done',
    alerts.done(LOW_STOCK, PRODUCT),
    {
      en: 'Acknowledged the alert “Low stock” for Hair Color (COLOR001).',
      ja: 'Hair Color（COLOR001）の在庫僅少を確認済みにしました。',
    },
  ],
  [
    'adminInventoryMessages.alerts.gone',
    alerts.gone(LOW_STOCK, PRODUCT),
    {
      en: 'The alert “Low stock” for Hair Color (COLOR001) is no longer raised. Meanwhile the stock moved or the product changed. The alerts were loaded again.',
      ja: 'Hair Color（COLOR001）の在庫僅少は、もう出ていません。その間に、在庫が動いたか、商品が変わりました。アラートを読み直しました。',
    },
  ],
  [
    'adminInventoryMessages.alerts.acknowledgedMeanwhile',
    alerts.acknowledgedMeanwhile(LOW_STOCK, PRODUCT),
    {
      en: 'Someone else acknowledged the alert “Low stock” for Hair Color (COLOR001) meanwhile. The alerts were loaded again.',
      ja: 'Hair Color（COLOR001）の在庫僅少は、その間に、ほかの人が確認済みにしました。アラートを読み直しました。',
    },
  ],
]

describe('the messages of the inventory of the admin application', () => {
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
      messagesOf({ adminInventoryMessages }, '').made.toSorted(),
    )
  })

  it('should name a row by its product alone when it has no lot, and a removed product as removed', () => {
    // Assert
    expect(rowNamed('Hair Color', null)).toEqual({
      en: 'Hair Color',
      ja: 'Hair Color',
    })
    expect(rowNamed(null, 'LOT-1')).toEqual({
      en: 'Removed product (lot LOT-1)',
      ja: '削除した商品（ロット LOT-1）',
    })
  })

  it('should say that a movement without a reason received a purchase order, and nothing for another', () => {
    // Assert
    expect(movements.reasonOf(null, true)).toEqual({
      en: 'Receipt of a purchase order',
      ja: '発注の入荷',
    })
    expect(movements.reasonOf(null, false)).toBeNull()
  })

  it('should name the place of a row by what of it was recorded, and nothing when none was', () => {
    // Assert
    expect(placeOf('Storage Room A', null)).toEqual({
      en: 'Storage Room A',
      ja: 'Storage Room A',
    })
    expect(placeOf(null, 'B-2')).toEqual({ en: 'Shelf B-2', ja: '棚 B-2' })
    expect(placeOf(null, null)).toBeNull()
  })

  it('should say what the books hold of a row without the reserved stock and the place when there are none', () => {
    // Assert
    expect(count.form.books(TWELVE, null, null)).toEqual({
      en: 'On the books: 12.5 bottle',
      ja: '帳簿の在庫数 12.5 bottle',
    })
  })

  it('should count one alert, and one item', () => {
    // Assert
    expect(alerts.summary.alertsOf(1)).toEqual({ en: '1 alert', ja: '1 件' })
    expect(count.value.itemsOf(1)).toEqual({ en: '1 item', ja: '1 品目' })
  })

  it('should say who keeps the stock rows after what the account may not do', () => {
    // Assert
    expect(adminInventoryMessages.keepers.rowsForbidden).toEqual({
      en: 'This account cannot change stock rows. Only the owners and managers of the salon, and administrators, can change stock rows.',
      ja: 'このアカウントでは、在庫の行を変えられません。在庫の行を変えられるのは、サロンのオーナーとマネージャーと、管理者です。',
    })
  })
})
