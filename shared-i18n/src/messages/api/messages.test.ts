import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import * as catalogues from './index'
import {
  attachmentMessages,
  bookingMessages,
  inventoryAlertMessages,
  inventoryMessages,
  problemMessages,
  purchaseOrderMessages,
  ruleMessages,
  saleMessages,
  salesReportMessages,
  salonMessages,
} from './index'

const JAPANESE = /[぀-ヿ一-鿿]/

type Found = { texts: [string, LocalizedText][]; made: string[] }

/**
 * The messages of a catalogue, by where they are in it: those that are
 * written out, and the names of those that are made from a value.
 */
const messagesOf = (value: unknown, where: string): Found => {
  if (typeof value === 'function') {
    return { texts: [], made: [where] }
  }
  if (typeof value !== 'object' || value === null) {
    return { texts: [], made: [] }
  }
  if (
    'en' in value &&
    'ja' in value &&
    typeof value.en === 'string' &&
    typeof value.ja === 'string'
  ) {
    return { texts: [[where, { en: value.en, ja: value.ja }]], made: [] }
  }

  const inside = Object.entries(value).map(([key, inner]) =>
    messagesOf(inner, where === '' ? key : `${where}.${key}`),
  )

  return {
    texts: inside.flatMap(({ texts }) => texts),
    made: inside.flatMap(({ made }) => made),
  }
}

const FOUND = messagesOf(catalogues, '')

/** Every message that is made from a value, with a value and what it then says. */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'problemMessages.routeNotFound.detail',
    problemMessages.routeNotFound.detail('PUT', '/api/v1/salons'),
    {
      en: 'PUT /api/v1/salons is not part of the API',
      ja: 'PUT /api/v1/salons は、この API にありません',
    },
  ],
  [
    'problemMessages.bodyTooLarge.detail',
    problemMessages.bodyTooLarge.detail(100_000),
    {
      en: 'The request body exceeds 100000 bytes',
      ja: 'リクエストの本文が 100000 バイトを超えています',
    },
  ],
  [
    'ruleMessages.phoneDigits',
    ruleMessages.phoneDigits(8),
    {
      en: 'Must contain at least 8 digits',
      ja: '数字を 8 桁以上含めてください',
    },
  ],
  [
    'ruleMessages.laterThan',
    ruleMessages.laterThan('openTime'),
    {
      en: 'Must be later than openTime',
      ja: 'openTime より後にしてください',
    },
  ],
  [
    'ruleMessages.notEarlierThan',
    ruleMessages.notEarlierThan('startDate'),
    {
      en: 'Must not be earlier than startDate',
      ja: 'startDate より前にはできません',
    },
  ],
  [
    'ruleMessages.notLaterThan',
    ruleMessages.notLaterThan('endDate'),
    {
      en: 'Must not be later than endDate',
      ja: 'endDate より後にはできません',
    },
  ],
  [
    'ruleMessages.notLessThan',
    ruleMessages.notLessThan('floorPrice'),
    {
      en: 'Must not be less than floorPrice',
      ja: 'floorPrice より小さくはできません',
    },
  ],
  [
    'ruleMessages.notMoreThan',
    ruleMessages.notMoreThan('ceilingPrice'),
    {
      en: 'Must not be more than ceilingPrice',
      ja: 'ceilingPrice より大きくはできません',
    },
  ],
  [
    'ruleMessages.notNullWhenGiven',
    ruleMessages.notNullWhenGiven('referenceType'),
    {
      en: 'Must not be null when referenceType is given',
      ja: 'referenceType を指定するときは、null にできません',
    },
  ],
  [
    'salonMessages.dayOfWeekOf',
    salonMessages.dayOfWeekOf('2026-11-23'),
    {
      en: 'Must be the day of the week of 2026-11-23',
      ja: '2026-11-23 の曜日にしてください',
    },
  ],
  [
    'ruleMessages.earlierThan',
    ruleMessages.earlierThan('closeTime'),
    {
      en: 'Must be earlier than closeTime',
      ja: 'closeTime より前にしてください',
    },
  ],
  [
    'ruleMessages.requiredWhenGiven',
    ruleMessages.requiredWhenGiven('lockedUntil'),
    {
      en: 'Required when lockedUntil is given',
      ja: 'lockedUntil を指定するときは、指定してください',
    },
  ],
  [
    'attachmentMessages.filenameOfType',
    attachmentMessages.filenameOfType('image/webp'),
    {
      en: 'Must end as a file of the type image/webp does',
      ja: 'image/webp のファイルの拡張子で終わらせてください',
    },
  ],
  [
    'bookingMessages.withinHoursOfEarliest',
    bookingMessages.withinHoursOfEarliest(7),
    {
      en: 'Must be within 7 hours of the earliest service',
      ja: '最も早いサービスから 7 時間以内にしてください',
    },
  ],
  [
    'inventoryAlertMessages.nullForProductAlert',
    inventoryAlertMessages.nullForProductAlert('no_stock'),
    {
      en: 'Must be null for an alert of a product (no_stock)',
      ja: '商品のアラート（no_stock）では、null にしてください',
    },
  ],
  [
    'inventoryAlertMessages.stockRowForStockRowAlert',
    inventoryAlertMessages.stockRowForStockRowAlert('spoiled'),
    {
      en: 'Must name a stock row for an alert of a stock row (spoiled)',
      ja: '在庫の行のアラート（spoiled）では、在庫の行を指定してください',
    },
  ],
  [
    'inventoryMessages.aboveZeroFor',
    inventoryMessages.aboveZeroFor('gift'),
    {
      en: 'Must be above 0 for a gift',
      ja: 'transactionType が gift のときは、0 より大きくしてください',
    },
  ],
  [
    'inventoryMessages.belowZeroFor',
    inventoryMessages.belowZeroFor('loss'),
    {
      en: 'Must be below 0 for a loss',
      ja: 'transactionType が loss のときは、0 より小さくしてください',
    },
  ],
  [
    'inventoryMessages.unitCostWithinTotal',
    inventoryMessages.unitCostWithinTotal(25, 100),
    {
      en: 'Must be at most 25: the total cost, unitCost × |quantity| rounded, has to be at most 100',
      ja: '25 以下にしてください。合計の原価（unitCost × |quantity| を丸めた値）は、100 以下でなければなりません',
    },
  ],
  [
    'purchaseOrderMessages.unitPriceWithinTotal',
    purchaseOrderMessages.unitPriceWithinTotal(30, 90),
    {
      en: 'Must be at most 30: the total of the item, quantity × unitPrice rounded, has to be at most 90',
      ja: '30 以下にしてください。明細の合計（quantity × unitPrice を丸めた値）は、90 以下でなければなりません',
    },
  ],
  [
    'purchaseOrderMessages.amountsWithinLimit',
    purchaseOrderMessages.amountsWithinLimit(5000),
    {
      en: 'The amounts of a purchase order must not exceed 5000: the subtotal, what the items come to, and the total, the subtotal with the tax and the shipping cost',
      ja: '発注の金額は、5000 を超えられません。小計（明細の合計）と、合計（小計に税と送料を加えた額）のどちらもです',
    },
  ],
  [
    'saleMessages.nullUnlessItemType',
    saleMessages.nullUnlessItemType('treatment', 'goods'),
    {
      en: 'Must be null unless itemType is treatment or goods',
      ja: 'itemType が treatment か goods のとき以外は、null にしてください',
    },
  ],
  [
    'salesReportMessages.withinDaysOfStartDate',
    salesReportMessages.withinDaysOfStartDate(31),
    {
      en: 'Must be within 31 days of startDate, both included',
      ja: 'startDate から、両端を含めて 31 日以内にしてください',
    },
  ],
]

describe('the messages of the API', () => {
  it.each(FOUND.texts)(
    'should be written in each language: %s',
    (_where, written) => {
      // Assert
      expect(written.en).toMatch(/^[A-Z]/)
      expect(written.en).not.toMatch(JAPANESE)
      expect(written.ja).toMatch(JAPANESE)
    },
  )

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
      FOUND.made.toSorted(),
    )
  })
})
