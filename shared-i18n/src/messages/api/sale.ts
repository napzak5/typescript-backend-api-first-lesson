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
}
