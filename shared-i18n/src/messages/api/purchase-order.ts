import { text } from '../../languages/localized-text'

/** Which orders an operation takes, as the end of a refusal says it. */
const TAKES = {
  update: text({
    en: 'an update moves a draft to pending, an approved order to ordered and an ordered one to shipped',
    ja: '変更で進められるのは、draft から pending、approved から ordered、ordered から shipped です',
  }),
  approval: text({
    en: 'only a pending order is approved',
    ja: '承認できるのは、pending の発注だけです',
  }),
  cancellation: text({
    en: 'an order is cancelled until it is delivered',
    ja: '発注を取り消せるのは、納品されるまでです',
  }),
  receipt: text({
    en: 'the goods of an ordered or shipped order are received',
    ja: '納品を受けられるのは、ordered か shipped の発注です',
  }),
}

/** What the API says of the purchase orders. */
export const purchaseOrderMessages = {
  invalidPurchaseOrder: text({
    en: 'Invalid purchase order',
    ja: '発注の内容が正しくありません',
  }),
  invalidPurchaseOrderId: text({
    en: 'Invalid purchase order ID',
    ja: '発注の ID が正しくありません',
  }),
  invalidPurchaseOrderSearch: text({
    en: 'Invalid purchase order search',
    ja: '発注の検索の条件が正しくありません',
  }),
  invalidReorderSuggestionSearch: text({
    en: 'Invalid reorder suggestion search',
    ja: '発注の提案の検索の条件が正しくありません',
  }),
  invalidPurchaseOrderCancellation: text({
    en: 'Invalid purchase order cancellation',
    ja: '発注の取り消しの内容が正しくありません',
  }),
  invalidPurchaseOrderReceipt: text({
    en: 'Invalid purchase order receipt',
    ja: '発注の納品の内容が正しくありません',
  }),
  /** `maximum` is the largest unit price of the quantity, `limit` the largest total of an item. */
  unitPriceWithinTotal: (maximum: number, limit: number) =>
    text({
      en: `Must be at most ${maximum}: the total of the item, quantity × unitPrice rounded, has to be at most ${limit}`,
      ja: `${maximum} 以下にしてください。明細の合計（quantity × unitPrice を丸めた値）は、${limit} 以下でなければなりません`,
    }),
  /** `limit` is the largest amount of a purchase order. */
  amountsWithinLimit: (limit: number) =>
    text({
      en: `The amounts of a purchase order must not exceed ${limit}: the subtotal, what the items come to, and the total, the subtotal with the tax and the shipping cost`,
      ja: `発注の金額は、${limit} を超えられません。小計（明細の合計）と、合計（小計に税と送料を加えた額）のどちらもです`,
    }),
  noRepeatedOrderedRow: text({
    en: 'Must not repeat a stock row ordered earlier in the order',
    ja: '同じ発注で前に指定した在庫の行は指定できません',
  }),
  noRepeatedReceivedRow: text({
    en: 'Must not repeat a stock row received earlier in the receipt',
    ja: '同じ納品で前に指定した在庫の行は指定できません',
  }),
  aPurchaseOrderOfList: text({
    en: 'Must name a purchase order of the list',
    ja: 'この一覧の発注を指定してください',
  }),
  aStockRowOfItemOfOrder: text({
    en: 'Must name a stock row of an item of the order',
    ja: 'この発注の明細の在庫の行を指定してください',
  }),
  /** `ordered` is the quantity the item of the order orders. */
  atMostOrdered: (ordered: number) =>
    text({
      en: `Must be at most ${ordered}, the quantity the item orders`,
      ja: `${ordered} 以下にしてください。明細が発注した数量です`,
    }),
  /** `id` is the order and `status` where it stands. */
  closed: (id: string, status: string) =>
    text({
      en: `Purchase order ${id} is ${status}: a delivered or cancelled order does not change`,
      ja: `発注 ${id} の状態は ${status} です。納品された発注と、取り消された発注は、変更できません`,
    }),
  /**
   * `id` is the order, `status` where it stands and `operation` what was
   * asked for: the sentence ends with which orders that operation takes.
   */
  notFromStatus: (id: string, status: string, operation: keyof typeof TAKES) =>
    text({
      en: `Purchase order ${id} is ${status}: ${TAKES[operation].en}`,
      ja: `発注 ${id} の状態は ${status} です。${TAKES[operation].ja}`,
    }),
  /** `inventoryId` is the stock row. */
  stockAboveLimit: (inventoryId: string) =>
    text({
      en: `The stock of row ${inventoryId} would go above 99999999.99`,
      ja: `在庫の行 ${inventoryId} の在庫が、99999999.99 を超えます`,
    }),
}
