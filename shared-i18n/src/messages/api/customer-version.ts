import { text } from '../../languages/localized-text'

/** What the API says of the history of a customer. */
export const customerVersionMessages = {
  invalidCustomerVersion: text({
    en: 'Invalid customer version',
    ja: '顧客の版の指定が正しくありません',
  }),
  invalidCustomerHistorySearch: text({
    en: 'Invalid customer history search',
    ja: '顧客の履歴の検索の条件が正しくありません',
  }),
  wholeNumber: text({
    en: 'Must be a whole number',
    ja: '0 以上の整数にしてください',
  }),
}
