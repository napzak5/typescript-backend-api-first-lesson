import { text } from '../../languages/localized-text'

/** What the API says of the staff. */
export const staffMessages = {
  invalidStaffId: text({
    en: 'Invalid staff ID',
    ja: 'スタッフの ID が正しくありません',
  }),
  invalidStaffSearch: text({
    en: 'Invalid staff search',
    ja: 'スタッフの検索の条件が正しくありません',
  }),
  invalidStaffMember: text({
    en: 'Invalid staff member',
    ja: 'スタッフの内容が正しくありません',
  }),
  invalidStaffUpdate: text({
    en: 'Invalid staff update',
    ja: 'スタッフの変更の内容が正しくありません',
  }),
  ownRecordStaysActive: text({
    en: 'You cannot deactivate your own staff record',
    ja: '自分のスタッフの記録は、無効にできません',
  }),
  ownRecordStays: text({
    en: 'You cannot delete your own staff record',
    ja: '自分のスタッフの記録は、削除できません',
  }),
}
