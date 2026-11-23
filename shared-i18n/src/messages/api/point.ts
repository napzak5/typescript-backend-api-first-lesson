import { text } from '../../languages/localized-text'

/** What the API says of the points. */
export const pointMessages = {
  invalidExpiringPointsSearch: text({
    en: 'Invalid expiring points search',
    ja: '失効が近いポイントの検索の条件が正しくありません',
  }),
  invalidPointTransactionSearch: text({
    en: 'Invalid point transaction search',
    ja: 'ポイントの履歴の検索の条件が正しくありません',
  }),
  invalidPointAdjustment: text({
    en: 'Invalid point adjustment',
    ja: 'ポイントの調整の内容が正しくありません',
  }),
  invalidPointEarning: text({
    en: 'Invalid point earning',
    ja: 'ポイントの付与の内容が正しくありません',
  }),
  invalidPointExpiry: text({
    en: 'Invalid point expiry',
    ja: 'ポイントの失効の内容が正しくありません',
  }),
  invalidPointUse: text({
    en: 'Invalid point use',
    ja: 'ポイントの利用の内容が正しくありません',
  }),
  aPointTransactionOfCustomer: text({
    en: 'Must name a point transaction of the customer',
    ja: 'この顧客のポイント取引を指定してください',
  }),
  /** `referenceType` is the kind of what the points are for, as the request writes it. */
  aReferenceOfCustomer: (referenceType: string) =>
    text({
      en: `Must name a ${referenceType} of the customer`,
      ja: `この顧客の ${referenceType} を指定してください`,
    }),
  saleIsVoid: text({
    en: 'The sale is void; points are not earned on or used for a void sale',
    ja: 'この売上は取り消されています。取り消された売上では、ポイントの付与も利用もできません',
  }),
  bookingNotHeld: text({
    en: 'The booking is a draft, cancelled or a no-show; points are not earned on or used for it',
    ja: 'この予約は、下書き、キャンセル、無断キャンセルのどれかです。この予約では、ポイントの付与も利用もできません',
  }),
  recordHasTransaction: text({
    en: 'The record has a point transaction of this kind already; a record is earned on once and used for once',
    ja: 'この記録には、この種類のポイント取引が、すでにあります。1 つの記録での付与と利用は、それぞれ 1 回だけです',
  }),
  balanceBelowZero: text({
    en: 'The balance of the customer would fall below 0',
    ja: '顧客の残高が、0 を下回ります',
  }),
  balanceAboveLimit: text({
    en: 'The balance of the customer would go above 2147483647',
    ja: '顧客の残高が、2147483647 を超えます',
  }),
}
