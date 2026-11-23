import { text } from '../../languages/localized-text'

/**
 * What the API calls the things it keeps, where it says that one was not
 * found or that one is there already. A name is said by every domain that
 * looks for the thing, so the names are in one place. The English names
 * are the ones the API has always said, as it wrote them.
 *
 * A name that says whose the thing is (`accountOfStaffMember`) is looked
 * for by the ID of that owner. In English the ID follows the owner
 * (`Account of staff member <id>`); in Japanese the name says so itself.
 */
export const entityMessages = {
  salon: text({ en: 'Salon', ja: 'サロン' }),
  user: text({ en: 'User', ja: 'ユーザー' }),
  session: text({ en: 'Session', ja: 'セッション' }),
  staffMember: text({ en: 'Staff member', ja: 'スタッフ' }),
  accountOfStaffMember: text({
    en: 'Account of staff member',
    ja: 'この ID のスタッフのアカウント',
  }),
  invitationOfStaffMember: text({
    en: 'Invitation of staff member',
    ja: 'この ID のスタッフの招待',
  }),
  serviceCategory: text({ en: 'Service category', ja: 'サービスのカテゴリー' }),
  service: text({ en: 'Service', ja: 'サービス' }),
  customer: text({ en: 'Customer', ja: '顧客' }),
  customerProfileOfUser: text({
    en: 'Customer profile of user',
    ja: 'この ID のユーザーの、顧客のプロフィール',
  }),
  customerAllergy: text({ en: 'CustomerAllergy', ja: '顧客のアレルギー' }),
  deletionRequestOfCustomer: text({
    en: 'Deletion request of customer',
    ja: 'この ID の顧客の、削除の依頼',
  }),
  pendingDeletionRequestOfCustomer: text({
    en: 'Pending deletion request of customer',
    ja: 'この ID の顧客の、受け付け中の削除の依頼',
  }),
  medicalChart: text({ en: 'MedicalChart', ja: 'カルテ' }),
  booking: text({ en: 'Booking', ja: '予約' }),
  bookingService: text({ en: 'Booking service', ja: '予約のサービス' }),
  sale: text({ en: 'Sale', ja: '売上' }),
  payment: text({ en: 'Payment', ja: '支払い' }),
  paymentMethod: text({ en: 'Payment method', ja: '支払い方法' }),
  review: text({ en: 'Review', ja: 'レビュー' }),
  reviewReport: text({ en: 'ReviewReport', ja: 'レビューの通報' }),
  product: text({ en: 'Product', ja: '商品' }),
  inventory: text({ en: 'Inventory', ja: '在庫の行' }),
  inventoryAlert: text({ en: 'InventoryAlert', ja: '在庫のアラート' }),
  purchaseOrder: text({ en: 'PurchaseOrder', ja: '発注' }),
  treatmentRecord: text({ en: 'TreatmentRecord', ja: '施術記録' }),
  treatmentPhoto: text({ en: 'TreatmentPhoto', ja: '施術記録の写真' }),
  attachment: text({ en: 'Attachment', ja: '添付ファイル' }),
  shareLink: text({ en: 'Share link', ja: '共有リンク' }),
  shareLinkOfToken: text({
    en: 'Share link of the token',
    ja: 'このトークンの共有リンク',
  }),
  /** `version` is the number of the version. */
  versionOfCustomer: (version: number) =>
    text({
      en: `Version ${version} of customer`,
      ja: `この ID の顧客の第 ${version} 版`,
    }),
}
