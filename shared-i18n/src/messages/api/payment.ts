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
}
