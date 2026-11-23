import { text } from '../../languages/localized-text'

/** What the API says of the sales. */
export const saleMessages = {
  invalidCalculation: text({
    en: 'Invalid calculation',
    ja: '会計の計算の内容が正しくありません',
  }),
  invalidSale: text({
    en: 'Invalid sale',
    ja: '売上の内容が正しくありません',
  }),
  invalidSaleId: text({
    en: 'Invalid sale ID',
    ja: '売上の ID が正しくありません',
  }),
  invalidSaleSearch: text({
    en: 'Invalid sale search',
    ja: '売上の検索の条件が正しくありません',
  }),
  invalidSaleUpdate: text({
    en: 'Invalid sale update',
    ja: '売上の変更の内容が正しくありません',
  }),
  invalidSaleVoid: text({
    en: 'Invalid sale void',
    ja: '売上の取り消しの内容が正しくありません',
  }),
  discountWithinPrice: text({
    en: 'Must not be more than quantity times unitPrice',
    ja: 'quantity × unitPrice より大きくはできません',
  }),
  totalOfLine: text({
    en: 'Must be quantity times unitPrice, less discountAmount, plus taxAmount',
    ja: 'quantity × unitPrice から discountAmount を引き、taxAmount を足した値にしてください',
  }),
  /** `service` and `product` are the kinds of line that name an item, as the request writes them. */
  nullUnlessItemType: (service: string, product: string) =>
    text({
      en: `Must be null unless itemType is ${service} or ${product}`,
      ja: `itemType が ${service} か ${product} のとき以外は、null にしてください`,
    }),
  noRepeatedSortOrder: text({
    en: 'Must not repeat the sortOrder of an earlier line',
    ja: '前の明細と同じ sortOrder は指定できません',
  }),
  noPointsWithoutCustomer: text({
    en: 'Must be null for a sale without a customer',
    ja: '顧客のいない売上では、null にしてください',
  }),
  aSale: text({
    en: 'Must name a sale',
    ja: '存在する売上を指定してください',
  }),
  aBookingOfSalon: text({
    en: 'Must name a booking of the salon',
    ja: 'このサロンの予約を指定してください',
  }),
  aBookingOfCustomerOfSale: text({
    en: 'Must name a booking of the salon that is of the customer of the sale',
    ja: 'このサロンの予約のうち、売上の顧客のものを指定してください',
  }),
  theCustomerOfBookingOfSale: text({
    en: 'Must name the customer of the booking of the sale',
    ja: '売上の予約の顧客を指定してください',
  }),
  aServiceWithoutServiceLine: text({
    en: 'Must name a service when the booking has no service line',
    ja: '予約に施術明細がないときは、サービスを指定してください',
  }),
  /** `limit` is the largest amount of a sale. */
  amountsWithinLimit: (limit: number) =>
    text({
      en: `The amounts of a sale must not exceed ${limit}`,
      ja: `売上の金額は、${limit} を超えられません`,
    }),
  timeZoneUnknown: text({
    en: 'The time zone of the salon is not one that is known, so the day of the sale cannot be told; correct the time zone of the salon first',
    ja: 'サロンのタイムゾーンが、知られているものではないので、売上の日がわかりません。先に、サロンのタイムゾーンを直してください',
  }),
  bookingBilled: text({
    en: 'The booking has a sale that is not void; a booking is billed once',
    ja: 'この予約には、取り消されていない売上があります。予約の会計は、1 回だけです',
  }),
  voidIsNotChanged: text({
    en: 'The sale is void; a void sale is not changed',
    ja: 'この売上は取り消されています。取り消された売上は、変更できません',
  }),
  linesWhilePending: text({
    en: 'The lines of a sale are replaced only while its payment status is pending',
    ja: '売上の明細を置き換えられるのは、支払いの状態が pending の間だけです',
  }),
  voidHasNoReceipt: text({
    en: 'The sale is void; a void sale has no receipt',
    ja: 'この売上は取り消されています。取り消された売上に、レシートはありません',
  }),
  notPaidInFull: text({
    en: 'The sale is not paid in full; a receipt is made once what was received comes to its total',
    ja: 'この売上は、全額が支払われていません。レシートは、受け取った額が合計に達してから作ります',
  }),
  alreadyVoid: text({
    en: 'The sale is void already',
    ja: 'この売上は、すでに取り消されています',
  }),
  paymentNotRefunded: text({
    en: 'The sale has a payment that was not refunded; refund it before the sale is voided',
    ja: 'この売上には、返金されていない支払いがあります。売上を取り消す前に、返金してください',
  }),
}
