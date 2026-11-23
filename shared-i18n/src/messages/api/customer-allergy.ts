import { text } from '../../languages/localized-text'

/** What the API says of the allergies of a customer. */
export const customerAllergyMessages = {
  invalidCustomerAllergy: text({
    en: 'Invalid customer allergy',
    ja: '顧客のアレルギーの内容が正しくありません',
  }),
  invalidCustomerAllergyId: text({
    en: 'Invalid customer allergy ID',
    ja: '顧客のアレルギーの ID が正しくありません',
  }),
  invalidCustomerAllergySearch: text({
    en: 'Invalid customer allergy search',
    ja: '顧客のアレルギーの検索の条件が正しくありません',
  }),
  anAllergyOfCustomer: text({
    en: 'Must name an allergy of the customer',
    ja: 'この顧客のアレルギーを指定してください',
  }),
  allergenRecordedAlready: text({
    en: 'The customer has an allergy of that allergen already; an allergen is recorded once',
    ja: 'この顧客には、そのアレルゲンのアレルギーが、すでにあります。1 つのアレルゲンは、1 回だけ記録します',
  }),
  allergenOfAnotherAllergy: text({
    en: 'Another allergy of the customer has that allergen; an allergen is recorded once',
    ja: 'この顧客のほかのアレルギーが、そのアレルゲンのものです。1 つのアレルゲンは、1 回だけ記録します',
  }),
}
