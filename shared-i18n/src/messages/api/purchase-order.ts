import { text } from '../../languages/localized-text'

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
}
