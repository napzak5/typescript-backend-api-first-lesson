import { text } from '../../languages/localized-text'

/** What the API says of what a customer wishes for. */
export const customerPreferencesMessages = {
  invalidCustomerPreferencesUpdate: text({
    en: 'Invalid customer preferences update',
    ja: '顧客の希望の変更の内容が正しくありません',
  }),
  noOverlappingSlot: text({
    en: 'Must not overlap an earlier time slot',
    ja: '前の時間帯と重ねられません',
  }),
  notAvoidedStaffMember: text({
    en: 'Must not be a staff member the customer avoids',
    ja: '顧客が避けたいスタッフにはできません',
  }),
}
