import { text } from '../../languages/localized-text'

/** What the API says of the accounts of the staff. */
export const staffAccountMessages = {
  invalidStaffAccountUpdate: text({
    en: 'Invalid staff account update',
    ja: 'スタッフのアカウントの変更の内容が正しくありません',
  }),
  ownRoleStays: text({
    en: 'You cannot change the role of your own account',
    ja: '自分のアカウントのロールは、変更できません',
  }),
  ownAccountStaysLinked: text({
    en: 'You cannot unlink your own account',
    ja: '自分のアカウントは、スタッフから外せません',
  }),
}
