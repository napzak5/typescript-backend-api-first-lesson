import { text } from '../../languages/localized-text'

/** What the API says of the stock. */
export const inventoryMessages = {
  invalidInventoryId: text({
    en: 'Invalid inventory ID',
    ja: '在庫の行の ID が正しくありません',
  }),
  invalidExpiringSearch: text({
    en: 'Invalid expiring search',
    ja: '期限の近い在庫の検索の条件が正しくありません',
  }),
  invalidInventorySearch: text({
    en: 'Invalid inventory search',
    ja: '在庫の検索の条件が正しくありません',
  }),
  invalidLowStockSearch: text({
    en: 'Invalid low-stock search',
    ja: '残りの少ない在庫の検索の条件が正しくありません',
  }),
  invalidStockMovementSearch: text({
    en: 'Invalid stock movement search',
    ja: '在庫の移動の検索の条件が正しくありません',
  }),
  invalidInventoryValueReport: text({
    en: 'Invalid inventory value report',
    ja: '在庫の評価額の集計の条件が正しくありません',
  }),
  invalidStockCount: text({
    en: 'Invalid stock count',
    ja: '棚卸の内容が正しくありません',
  }),
  invalidStockMovement: text({
    en: 'Invalid stock movement',
    ja: '在庫の移動の内容が正しくありません',
  }),
  invalidStockRow: text({
    en: 'Invalid stock row',
    ja: '在庫の行の内容が正しくありません',
  }),
  /** `transactionType` is the kind of the movement, as the request writes it. */
  aboveZeroFor: (transactionType: string) =>
    text({
      en: `Must be above 0 for a ${transactionType}`,
      ja: `transactionType が ${transactionType} のときは、0 より大きくしてください`,
    }),
  /** `transactionType` is the kind of the movement, as the request writes it. */
  belowZeroFor: (transactionType: string) =>
    text({
      en: `Must be below 0 for a ${transactionType}`,
      ja: `transactionType が ${transactionType} のときは、0 より小さくしてください`,
    }),
  reasonRequired: text({
    en: 'Must not be null: an adjustment and a disposal state why',
    ja: 'null にはできません。調整と廃棄には、理由が必要です',
  }),
  /** `maximum` is the largest unit cost of the quantity, `limit` the largest total cost. */
  unitCostWithinTotal: (maximum: number, limit: number) =>
    text({
      en: `Must be at most ${maximum}: the total cost, unitCost × |quantity| rounded, has to be at most ${limit}`,
      ja: `${maximum} 以下にしてください。合計の原価（unitCost × |quantity| を丸めた値）は、${limit} 以下でなければなりません`,
    }),
  noRepeatedCountedRow: text({
    en: 'Must not repeat a stock row counted earlier',
    ja: '前に数えた在庫の行は指定できません',
  }),
  aStockRow: text({
    en: 'Must name a stock row',
    ja: '存在する在庫の行を指定してください',
  }),
  aStockRowOfList: text({
    en: 'Must name a stock row of the list',
    ja: 'この一覧の在庫の行を指定してください',
  }),
  aStockMovementOfStockRow: text({
    en: 'Must name a stock movement of the stock row',
    ja: 'この在庫の行の移動を指定してください',
  }),
  lotOfProductKeptByLots: text({
    en: 'Must name the lot: the product is kept by lots',
    ja: 'ロット番号を指定してください。この商品は、在庫をロット番号で分けます',
  }),
  nullForProductNotKeptByLots: text({
    en: 'Must be null: the product is not kept by lots',
    ja: 'null にしてください。この商品は、在庫をロット番号で分けません',
  }),
}
