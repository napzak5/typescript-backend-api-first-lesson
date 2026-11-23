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
}
