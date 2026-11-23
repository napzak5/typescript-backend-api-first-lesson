import { text } from '../../languages/localized-text'

/** What the API says of the alerts of the stock. */
export const inventoryAlertMessages = {
  invalidInventoryAlertSearch: text({
    en: 'Invalid inventory alert search',
    ja: '在庫のアラートの検索の条件が正しくありません',
  }),
  invalidInventoryAlertAcknowledgement: text({
    en: 'Invalid inventory alert acknowledgement',
    ja: '在庫のアラートの確認の内容が正しくありません',
  }),
  invalidInventoryAlertSummaryRequest: text({
    en: 'Invalid inventory alert summary request',
    ja: '在庫のアラートの集計の条件が正しくありません',
  }),
  /** `alert` is the kind of the alert, as the request writes it. */
  nullForProductAlert: (alert: string) =>
    text({
      en: `Must be null for an alert of a product (${alert})`,
      ja: `商品のアラート（${alert}）では、null にしてください`,
    }),
  /** `alert` is the kind of the alert, as the request writes it. */
  stockRowForStockRowAlert: (alert: string) =>
    text({
      en: `Must name a stock row for an alert of a stock row (${alert})`,
      ja: `在庫の行のアラート（${alert}）では、在庫の行を指定してください`,
    }),
  aProductOrStockRowOfSalon: text({
    en: 'Must name a product or a stock row of the salon',
    ja: 'このサロンの商品か在庫の行を指定してください',
  }),
}
