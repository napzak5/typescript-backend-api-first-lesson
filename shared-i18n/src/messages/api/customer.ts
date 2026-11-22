import { text } from '../../languages/localized-text'

/** What the API says of the customers. */
export const customerMessages = {
  invalidCustomer: text({
    en: 'Invalid customer',
    ja: '顧客の内容が正しくありません',
  }),
  invalidCustomerId: text({
    en: 'Invalid customer ID',
    ja: '顧客の ID が正しくありません',
  }),
  invalidCustomerBatch: text({
    en: 'Invalid customer batch',
    ja: '顧客の一括の取得の指定が正しくありません',
  }),
  invalidCustomers: text({
    en: 'Invalid customers',
    ja: '顧客の一括の登録の内容が正しくありません',
  }),
  invalidCustomerUpdates: text({
    en: 'Invalid customer updates',
    ja: '顧客の一括の変更の内容が正しくありません',
  }),
  invalidCustomerDeletion: text({
    en: 'Invalid customer deletion',
    ja: '顧客の一括の削除の内容が正しくありません',
  }),
  invalidCustomerMerge: text({
    en: 'Invalid customer merge',
    ja: '顧客の統合の内容が正しくありません',
  }),
  invalidCustomerProfile: text({
    en: 'Invalid customer profile',
    ja: '顧客のプロフィールの内容が正しくありません',
  }),
  invalidCustomerProfileUpdate: text({
    en: 'Invalid customer profile update',
    ja: '顧客のプロフィールの変更の内容が正しくありません',
  }),
  invalidCustomerUpdate: text({
    en: 'Invalid customer update',
    ja: '顧客の変更の内容が正しくありません',
  }),
  invalidCustomerExport: text({
    en: 'Invalid customer export',
    ja: '顧客の出力の条件が正しくありません',
  }),
  invalidCustomerSearch: text({
    en: 'Invalid customer search',
    ja: '顧客の検索の条件が正しくありません',
  }),
  noRepeatedCustomer: text({
    en: 'Must not repeat the customer of an earlier item',
    ja: '前の要素と同じ顧客は指定できません',
  }),
  anotherThanPrimary: text({
    en: 'Must be another customer than primaryCustomerId',
    ja: 'primaryCustomerId とは別の顧客にしてください',
  }),
}
