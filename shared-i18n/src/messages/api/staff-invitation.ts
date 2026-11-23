import { text } from '../../languages/localized-text'

/** What the API says of the invitations of the staff. */
export const staffInvitationMessages = {
  invalidStaffInvitation: text({
    en: 'Invalid staff invitation',
    ja: 'スタッフの招待の内容が正しくありません',
  }),
  /** `staffId` is the staff member who was to be invited. */
  alreadyHasAccount: (staffId: string) =>
    text({
      en: `Staff member ${staffId} already has an account`,
      ja: `スタッフ ${staffId} には、すでにアカウントがあります`,
    }),
  /** `staffId` is the staff member who was to be invited. */
  staffInactive: (staffId: string) =>
    text({
      en: `Staff member ${staffId} is inactive`,
      ja: `スタッフ ${staffId} は、無効になっています`,
    }),
  /** `staffId` is the staff member who was to be invited. */
  mailedMomentsAgo: (staffId: string) =>
    text({
      en: `An invitation was mailed to staff member ${staffId} moments ago`,
      ja: `スタッフ ${staffId} には、少し前に、招待のメールを送りました`,
    }),
  accountBelongsToStaff: text({
    en: 'Your account already belongs to a staff member',
    ja: 'あなたのアカウントは、すでにスタッフのものです',
  }),
  sentToAnotherAddress: text({
    en: 'The invitation was sent to another address',
    ja: 'この招待は、ほかのメールアドレスに送られたものです',
  }),
}
