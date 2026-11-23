import { text } from '../../languages/localized-text'

/** What the API says of the payments. */
export const paymentMessages = {
  invalidPayment: text({
    en: 'Invalid payment',
    ja: '支払いの内容が正しくありません',
  }),
  invalidPaymentId: text({
    en: 'Invalid payment ID',
    ja: '支払いの ID が正しくありません',
  }),
  invalidRefund: text({
    en: 'Invalid refund',
    ja: '返金の内容が正しくありません',
  }),
  fourDigits: text({
    en: 'Must be four digits',
    ja: '4 桁の数字にしてください',
  }),
  anActivePaymentMethodOfSalonOfSale: text({
    en: 'Must name a payment method of the salon of the sale that is active',
    ja: '売上のサロンの、有効な支払い方法を指定してください',
  }),
  nullUnlessCard: text({
    en: 'Must be null unless the payment method is a credit card or a debit card',
    ja: '支払い方法がクレジットカードかデビットカードのとき以外は、null にしてください',
  }),
  /** `minimum` is the least amount the payment method takes. */
  notLessThanMinimumOfMethod: (minimum: number) =>
    text({
      en: `Must not be less than the minimumAmount of the payment method (${minimum})`,
      ja: `支払い方法の minimumAmount（${minimum}）より小さくはできません`,
    }),
  /** `maximum` is the most the payment method takes. */
  notMoreThanMaximumOfMethod: (maximum: number) =>
    text({
      en: `Must not be more than the maximumAmount of the payment method (${maximum})`,
      ja: `支払い方法の maximumAmount（${maximum}）より大きくはできません`,
    }),
  /** `left` is what the sale has yet to be paid. */
  notMoreThanLeftToPay: (left: number) =>
    text({
      en: `Must not be more than what is left to pay (${left})`,
      ja: `未払い残額（${left}）より大きくはできません`,
    }),
  /** `amount` is the amount of the payment that is refunded. */
  notMoreThanAmountOfPayment: (amount: number) =>
    text({
      en: `Must not be more than the amount of the payment (${amount})`,
      ja: `支払いの金額（${amount}）より大きくはできません`,
    }),
  saleIsVoid: text({
    en: 'The sale is void; a void sale takes no payment',
    ja: 'この売上は取り消されています。取り消された売上には、支払いを記録できません',
  }),
  saleHasRefund: text({
    en: 'A payment of the sale was refunded; a sale with a refund takes no further payment',
    ja: 'この売上の支払いが返金されています。返金のある売上には、もう支払いを記録できません',
  }),
  nothingLeftToPay: text({
    en: 'Nothing is left to pay of the sale',
    ja: 'この売上には、支払いの残りがありません',
  }),
  onlyCompletedIsRefunded: text({
    en: 'Only a payment that is completed is refunded; a payment is refunded once',
    ja: '返金できるのは、状態が completed の支払いだけです。支払いの返金は、1 回だけです',
  }),
}
