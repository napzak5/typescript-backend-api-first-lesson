import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import * as catalogues from './index'
import {
  attachmentMessages,
  bookingMessages,
  customerDeletionRequestMessages,
  customerMessages,
  entityMessages,
  inventoryAlertMessages,
  inventoryMessages,
  paymentMessages,
  pointMessages,
  problemMessages,
  purchaseOrderMessages,
  ruleMessages,
  saleMessages,
  salesReportMessages,
  salonMessages,
  serviceMessages,
  shareLinkMessages,
  staffInvitationMessages,
  staffScheduleMessages,
  treatmentRecordMessages,
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
    'problemMessages.notFound.detail',
    problemMessages.notFound.detail(
      entityMessages.salon,
      '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c',
    ),
    {
      en: 'Salon 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c was not found',
      ja: 'サロンが見つかりません（ID: 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c）',
    },
  ],
  [
    'problemMessages.alreadyExists.detail',
    problemMessages.alreadyExists.detail(
      entityMessages.customer,
      'referralCode',
      'HANAKO',
    ),
    {
      en: 'Customer with referralCode HANAKO already exists',
      ja: 'referralCode が HANAKO の顧客は、すでにあります',
    },
  ],
  [
    'entityMessages.versionOfCustomer',
    entityMessages.versionOfCustomer(3),
    {
      en: 'Version 3 of customer',
      ja: 'この ID の顧客の第 3 版',
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
  [
    'staffScheduleMessages.requiredWhenGiven',
    staffScheduleMessages.requiredWhenGiven('lockedUntil'),
    {
      en: 'Required when lockedUntil is given',
      ja: 'lockedUntil を指定するときは、指定してください',
    },
  ],
  [
    'staffScheduleMessages.earlierThan',
    staffScheduleMessages.earlierThan('closeTime'),
    {
      en: 'Must be earlier than closeTime',
      ja: 'closeTime より前にしてください',
    },
  ],
  [
    'bookingMessages.amountsWithinLimit',
    bookingMessages.amountsWithinLimit(7000),
    {
      en: 'The amounts of a booking must not exceed 7000',
      ja: '予約の金額は、7000 を超えられません',
    },
  ],
  [
    'paymentMessages.notLessThanMinimumOfMethod',
    paymentMessages.notLessThanMinimumOfMethod(500),
    {
      en: 'Must not be less than the minimumAmount of the payment method (500)',
      ja: '支払い方法の minimumAmount（500）より小さくはできません',
    },
  ],
  [
    'paymentMessages.notMoreThanMaximumOfMethod',
    paymentMessages.notMoreThanMaximumOfMethod(90000),
    {
      en: 'Must not be more than the maximumAmount of the payment method (90000)',
      ja: '支払い方法の maximumAmount（90000）より大きくはできません',
    },
  ],
  [
    'paymentMessages.notMoreThanLeftToPay',
    paymentMessages.notMoreThanLeftToPay(1200),
    {
      en: 'Must not be more than what is left to pay (1200)',
      ja: '未払い残額（1200）より大きくはできません',
    },
  ],
  [
    'paymentMessages.notMoreThanAmountOfPayment',
    paymentMessages.notMoreThanAmountOfPayment(3300),
    {
      en: 'Must not be more than the amount of the payment (3300)',
      ja: '支払いの金額（3300）より大きくはできません',
    },
  ],
  [
    'pointMessages.aReferenceOfCustomer',
    pointMessages.aReferenceOfCustomer('visit'),
    {
      en: 'Must name a visit of the customer',
      ja: 'この顧客の visit を指定してください',
    },
  ],
  [
    'purchaseOrderMessages.atMostOrdered',
    purchaseOrderMessages.atMostOrdered(12),
    {
      en: 'Must be at most 12, the quantity the item orders',
      ja: '12 以下にしてください。明細が発注した数量です',
    },
  ],
  [
    'saleMessages.amountsWithinLimit',
    saleMessages.amountsWithinLimit(8000),
    {
      en: 'The amounts of a sale must not exceed 8000',
      ja: '売上の金額は、8000 を超えられません',
    },
  ],
  [
    'serviceMessages.atLeastPackageMembers',
    serviceMessages.atLeastPackageMembers(3),
    {
      en: 'A package must name at least 3 services',
      ja: 'パッケージには、サービスを 3 つ以上指定してください',
    },
  ],
  [
    'shareLinkMessages.withinDaysFromNow',
    shareLinkMessages.withinDaysFromNow(14),
    {
      en: 'Must be within 14 days from now',
      ja: '現在から 14 日以内にしてください',
    },
  ],
  [
    'treatmentRecordMessages.notBeforeBookingDate',
    treatmentRecordMessages.notBeforeBookingDate('2026-11-23'),
    {
      en: 'Must not be before the date of the booking, 2026-11-23',
      ja: '予約の日（2026-11-23）より前にはできません',
    },
  ],
  [
    'attachmentMessages.uploadedFileNotOfSize',
    attachmentMessages.uploadedFileNotOfSize(64),
    {
      en: 'The uploaded file is not of 64 bytes',
      ja: 'アップロードされたファイルは、64 バイトではありません',
    },
  ],
  [
    'attachmentMessages.uploadedFileNotOfType',
    attachmentMessages.uploadedFileNotOfType('image/png'),
    {
      en: 'The uploaded file is not a file of the type image/png',
      ja: 'アップロードされたファイルは、種類が image/png のファイルではありません',
    },
  ],
  [
    'bookingMessages.statusDoesNotAllow',
    bookingMessages.statusDoesNotAllow('complete', 'cancelled', [
      'confirmed',
      'in_progress',
    ]),
    {
      en: 'A booking that is cancelled cannot be completed; its status has to be confirmed or in_progress',
      ja: '状態が cancelled の予約は、完了できません。状態は、confirmed か in_progress でなければなりません',
    },
  ],
  [
    'bookingMessages.staffOccupied',
    bookingMessages.staffOccupied([
      '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c',
      '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1d',
    ]),
    {
      en: 'Other bookings occupy staff members 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c, 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1d at a time of this booking',
      ja: 'この予約の時刻に、スタッフ 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c, 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1d には、ほかの予約があります',
    },
  ],
  [
    'bookingMessages.cannotBeRescheduled',
    bookingMessages.cannotBeRescheduled('in_progress', [
      'draft',
      'pending',
      'confirmed',
    ]),
    {
      en: 'A booking that is in_progress cannot be rescheduled; its status has to be draft or pending or confirmed',
      ja: '状態が in_progress の予約は、日時を変更できません。状態は、draft か pending か confirmed でなければなりません',
    },
  ],
  [
    'bookingMessages.servicesAreSettled',
    bookingMessages.servicesAreSettled('no_show', [
      'draft',
      'pending',
      'confirmed',
      'in_progress',
    ]),
    {
      en: 'The services of a booking that is no_show cannot be changed; its status has to be draft or pending or confirmed or in_progress',
      ja: '状態が no_show の予約は、サービスを変更できません。状態は、draft か pending か confirmed か in_progress でなければなりません',
    },
  ],
  [
    'bookingMessages.atMostServices',
    bookingMessages.atMostServices(20),
    {
      en: 'A booking has at most 20 services',
      ja: '予約のサービスは、20 個までです',
    },
  ],
  [
    'bookingMessages.servicesBeginWithinHours',
    bookingMessages.servicesBeginWithinHours(24),
    {
      en: 'Every service of a booking begins within 24 hours of the earliest one',
      ja: '予約のサービスは、どれも、最も早いサービスから 24 時間以内に始めます',
    },
  ],
  [
    'bookingMessages.referredTo',
    bookingMessages.referredTo(['sale', 'treatmentRecord', 'review']),
    {
      en: 'The booking cannot be deleted: a sale, a treatment record and a review refer to it',
      ja: 'この予約は削除できません。売上と施術記録とレビューが参照しています',
    },
  ],
  [
    'customerDeletionRequestMessages.alreadyRequested',
    customerDeletionRequestMessages.alreadyRequested(
      '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c',
      '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1d',
    ),
    {
      en: 'Customer 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c has a pending deletion request, 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1d',
      ja: '顧客 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c には、受け付け中の削除の依頼 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1d があります',
    },
  ],
  [
    'customerMessages.unfinishedBookingsReferTo',
    customerMessages.unfinishedBookingsReferTo(
      '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c',
    ),
    {
      en: 'Customer 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c cannot be deleted: bookings that are not finished refer to it',
      ja: '顧客 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c は削除できません。終わっていない予約が参照しています',
    },
  ],
  [
    'customerMessages.tooManyToExport',
    customerMessages.tooManyToExport(10001, 10000),
    {
      en: '10001 customers match; a file holds 10000 at most, so narrow the filters',
      ja: '条件に合う顧客が 10001 人います。1 つのファイルは 10000 人までなので、条件を絞ってください',
    },
  ],
  [
    'customerMessages.chartListsTooLong',
    customerMessages.chartListsTooLong('avoidProducts'),
    {
      en: 'The medical charts of both customers list more avoidProducts than a chart can; shorten one first',
      ja: '2 人の顧客のカルテの avoidProducts を合わせると、1 つのカルテに書ける数を超えます。先に、どちらかを減らしてください',
    },
  ],
  [
    'customerMessages.deletionRequested',
    customerMessages.deletionRequested([
      '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c',
      '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1d',
    ]),
    {
      en: 'Customer 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c and customer 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1d asked for their data to be erased; cancel the deletion request first',
      ja: '顧客 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c と顧客 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1d は、データの消去を依頼しています。先に、削除の依頼を取り消してください',
    },
  ],
  [
    'customerMessages.notDeleted',
    customerMessages.notDeleted('0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c'),
    {
      en: 'Customer 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c is not deleted, so there is nothing to restore',
      ja: '顧客 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c は削除されていないので、元に戻すものがありません',
    },
  ],
  [
    'customerMessages.mergedAway',
    customerMessages.mergedAway('0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c'),
    {
      en: 'Customer 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c was merged into another customer, who has what it had',
      ja: '顧客 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c は、ほかの顧客に統合されました。持っていたものは、その顧客にあります',
    },
  ],
  [
    'customerMessages.erased',
    customerMessages.erased('0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c'),
    {
      en: 'The data of customer 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c was erased at their request',
      ja: '顧客 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c のデータは、本人の依頼で消去されました',
    },
  ],
  [
    'inventoryAlertMessages.alreadyAcknowledged',
    inventoryAlertMessages.alreadyAcknowledged(
      'low_stock:0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c',
    ),
    {
      en: 'Inventory alert low_stock:0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c is acknowledged already: an acknowledgement holds while what it was given for lasts',
      ja: '在庫のアラート low_stock:0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c は、すでに確認されています。確認は、その理由が続く間、有効です',
    },
  ],
  [
    'inventoryMessages.countedBelowReserved',
    inventoryMessages.countedBelowReserved(
      '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c',
    ),
    {
      en: 'What was counted of stock row 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c is below its reserved stock',
      ja: '在庫の行 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c の数えた数量が、引当済みの在庫を下回っています',
    },
  ],
  [
    'purchaseOrderMessages.closed',
    purchaseOrderMessages.closed(
      '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c',
      'delivered',
    ),
    {
      en: 'Purchase order 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c is delivered: a delivered or cancelled order does not change',
      ja: '発注 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c の状態は delivered です。納品された発注と、取り消された発注は、変更できません',
    },
  ],
  [
    'purchaseOrderMessages.notFromStatus',
    purchaseOrderMessages.notFromStatus(
      '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c',
      'approved',
      'approval',
    ),
    {
      en: 'Purchase order 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c is approved: only a pending order is approved',
      ja: '発注 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c の状態は approved です。承認できるのは、pending の発注だけです',
    },
  ],
  [
    'purchaseOrderMessages.stockAboveLimit',
    purchaseOrderMessages.stockAboveLimit(
      '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c',
    ),
    {
      en: 'The stock of row 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c would go above 99999999.99',
      ja: '在庫の行 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c の在庫が、99999999.99 を超えます',
    },
  ],
  [
    'staffInvitationMessages.alreadyHasAccount',
    staffInvitationMessages.alreadyHasAccount(
      '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c',
    ),
    {
      en: 'Staff member 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c already has an account',
      ja: 'スタッフ 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c には、すでにアカウントがあります',
    },
  ],
  [
    'staffInvitationMessages.staffInactive',
    staffInvitationMessages.staffInactive(
      '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c',
    ),
    {
      en: 'Staff member 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c is inactive',
      ja: 'スタッフ 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c は、無効になっています',
    },
  ],
  [
    'staffInvitationMessages.mailedMomentsAgo',
    staffInvitationMessages.mailedMomentsAgo(
      '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c',
    ),
    {
      en: 'An invitation was mailed to staff member 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c moments ago',
      ja: 'スタッフ 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c には、少し前に、招待のメールを送りました',
    },
  ],
  [
    'treatmentRecordMessages.photoExists',
    treatmentRecordMessages.photoExists('https://images.example.com/0.jpg'),
    {
      en: 'The record holds a photo at https://images.example.com/0.jpg already; a record holds one photo of an address',
      ja: 'この施術記録には、https://images.example.com/0.jpg の写真が、すでにあります。同じアドレスの写真は、施術記録に 1 つです',
    },
  ],
  [
    'treatmentRecordMessages.tooManyPhotos',
    treatmentRecordMessages.tooManyPhotos(19, 20),
    {
      en: 'The record holds 19 photos; a record holds at most 20',
      ja: 'この施術記録には、写真が 19 枚あります。施術記録の写真は、20 枚までです',
    },
  ],
  [
    'treatmentRecordMessages.bookingNotTreated',
    treatmentRecordMessages.bookingNotTreated('confirmed'),
    {
      en: 'The booking is confirmed; a treatment is recorded once it has begun',
      ja: '予約の状態は confirmed です。施術は、予約が始まってから記録します',
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

  it('should say that a thing was not found without an ID, where what it was looked for by is not repeated', () => {
    // Act
    const made = problemMessages.notFound.detail(
      entityMessages.shareLinkOfToken,
      null,
    )

    // Assert
    expect(made).toEqual({
      en: 'Share link of the token was not found',
      ja: 'このトークンの共有リンクが見つかりません',
    })
  })

  it('should put the value that is taken between spaces in every language, where a screen looks for it', () => {
    // Act
    const made = problemMessages.alreadyExists.detail(
      entityMessages.customer,
      'email',
      'ichiro@example.com',
    )

    // Assert
    expect(` ${made.en} `).toContain(' ichiro@example.com ')
    expect(` ${made.ja} `).toContain(' ichiro@example.com ')
  })

  it('should say whose ID a thing is looked for by, where the name says an owner, in Japanese too', () => {
    // Act
    const made = problemMessages.notFound.detail(
      entityMessages.accountOfStaffMember,
      '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c',
    )

    // Assert
    expect(made).toEqual({
      en: 'Account of staff member 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c was not found',
      ja: 'この ID のスタッフのアカウントが見つかりません（ID: 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c）',
    })
  })

  it.each<
    [Parameters<typeof bookingMessages.statusDoesNotAllow>[0], string, string]
  >([
    ['confirm', 'confirmed', '確定'],
    ['cancel', 'cancelled', 'キャンセル'],
    ['cancelAsCustomer', 'cancelled', 'キャンセル'],
    ['start', 'started', '開始'],
    ['complete', 'completed', '完了'],
    ['noShow', 'noted as one the customer did not come to', '無断キャンセルに'],
  ])(
    'should say what the action %s would have made of a booking, in each language',
    (action, english, japanese) => {
      // Act
      const made = bookingMessages.statusDoesNotAllow(action, 'pending', [
        'confirmed',
      ])

      // Assert
      expect(made).toEqual({
        en: `A booking that is pending cannot be ${english}; its status has to be confirmed`,
        ja: `状態が pending の予約は、${japanese}できません。状態は、confirmed でなければなりません`,
      })
    },
  )

  it.each<[Parameters<typeof bookingMessages.referredTo>[0], LocalizedText]>([
    [
      ['sale'],
      {
        en: 'The booking cannot be deleted: a sale refers to it',
        ja: 'この予約は削除できません。売上が参照しています',
      },
    ],
    [
      ['treatmentRecord'],
      {
        en: 'The booking cannot be deleted: a treatment record refers to it',
        ja: 'この予約は削除できません。施術記録が参照しています',
      },
    ],
    [
      ['review'],
      {
        en: 'The booking cannot be deleted: a review refers to it',
        ja: 'この予約は削除できません。レビューが参照しています',
      },
    ],
    [
      ['sale', 'review'],
      {
        en: 'The booking cannot be deleted: a sale and a review refer to it',
        ja: 'この予約は削除できません。売上とレビューが参照しています',
      },
    ],
  ])(
    'should list what refers to a booking as a sentence of each language does: %j',
    (by, expected) => {
      // Act
      const made = bookingMessages.referredTo(by)

      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should say of one staff member with other bookings as of one', () => {
    // Act
    const made = bookingMessages.staffOccupied([
      '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c',
    ])

    // Assert
    expect(made).toEqual({
      en: 'Other bookings occupy staff member 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c at a time of this booking',
      ja: 'この予約の時刻に、スタッフ 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c には、ほかの予約があります',
    })
  })

  it('should say of one customer who asked for their data to be erased as of one', () => {
    // Act
    const made = customerMessages.deletionRequested([
      '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c',
    ])

    // Assert
    expect(made).toEqual({
      en: 'Customer 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c asked for their data to be erased; cancel the deletion request first',
      ja: '顧客 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c は、データの消去を依頼しています。先に、削除の依頼を取り消してください',
    })
  })

  it.each<
    [Parameters<typeof purchaseOrderMessages.notFromStatus>[2], LocalizedText]
  >([
    [
      'update',
      {
        en: 'Purchase order 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c is pending: an update moves a draft to pending, an approved order to ordered and an ordered one to shipped',
        ja: '発注 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c の状態は pending です。変更で進められるのは、draft から pending、approved から ordered、ordered から shipped です',
      },
    ],
    [
      'approval',
      {
        en: 'Purchase order 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c is pending: only a pending order is approved',
        ja: '発注 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c の状態は pending です。承認できるのは、pending の発注だけです',
      },
    ],
    [
      'cancellation',
      {
        en: 'Purchase order 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c is pending: an order is cancelled until it is delivered',
        ja: '発注 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c の状態は pending です。発注を取り消せるのは、納品されるまでです',
      },
    ],
    [
      'receipt',
      {
        en: 'Purchase order 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c is pending: the goods of an ordered or shipped order are received',
        ja: '発注 0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c の状態は pending です。納品を受けられるのは、ordered か shipped の発注です',
      },
    ],
  ])(
    'should end with which orders the operation %s takes, in each language',
    (operation, expected) => {
      // Act
      const made = purchaseOrderMessages.notFromStatus(
        '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c',
        'pending',
        operation,
      )

      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should keep the ID of a customer that cannot be deleted as it is in every language, where a screen looks for it', () => {
    // Act
    const made = customerMessages.unfinishedBookingsReferTo(
      '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c',
    )

    // Assert
    expect(made.en).toContain('0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c')
    expect(made.ja).toContain('0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1c')
  })
})
