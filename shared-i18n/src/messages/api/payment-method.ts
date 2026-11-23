import { text } from '../../languages/localized-text'

/** What the API says of the payment methods of a salon. */
export const paymentMethodMessages = {
  invalidPaymentMethod: text({
    en: 'Invalid payment method',
    ja: '支払い方法の内容が正しくありません',
  }),
  invalidPaymentMethodId: text({
    en: 'Invalid payment method ID',
    ja: '支払い方法の ID が正しくありません',
  }),
  invalidPaymentMethodSearch: text({
    en: 'Invalid payment method search',
    ja: '支払い方法の検索の条件が正しくありません',
  }),
  invalidPaymentMethodUpdate: text({
    en: 'Invalid payment method update',
    ja: '支払い方法の変更の内容が正しくありません',
  }),
  aPaymentMethodOfSalon: text({
    en: 'Must name a payment method of the salon',
    ja: 'このサロンの支払い方法を指定してください',
  }),
  referredToByPayment: text({
    en: 'The payment method cannot be deleted: a payment refers to it; set isActive to false instead',
    ja: 'この支払い方法は削除できません。支払いが参照しています。代わりに、isActive を false にしてください',
  }),
}
