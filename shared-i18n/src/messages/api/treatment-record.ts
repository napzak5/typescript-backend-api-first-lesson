import { text } from '../../languages/localized-text'

/** What the API says of the treatment records and their photos. */
export const treatmentRecordMessages = {
  invalidTreatmentRecord: text({
    en: 'Invalid treatment record',
    ja: '施術記録の内容が正しくありません',
  }),
  invalidTreatmentRecordId: text({
    en: 'Invalid treatment record ID',
    ja: '施術記録の ID が正しくありません',
  }),
  invalidTreatmentRecordSearch: text({
    en: 'Invalid treatment record search',
    ja: '施術記録の検索の条件が正しくありません',
  }),
  invalidTreatmentPhotoId: text({
    en: 'Invalid treatment photo ID',
    ja: '施術記録の写真の ID が正しくありません',
  }),
  invalidTreatmentPhotos: text({
    en: 'Invalid treatment photos',
    ja: '施術記録の写真の内容が正しくありません',
  }),
  invalidTreatmentStatistics: text({
    en: 'Invalid treatment statistics',
    ja: '施術記録の集計の条件が正しくありません',
  }),
  publicNeedsConsent: text({
    en: 'Must have the consent of the customer',
    ja: '顧客の同意が必要です',
  }),
  noRepeatedPhotoAddress: text({
    en: 'Must not repeat the address of an earlier photo',
    ja: '前の写真と同じアドレスは指定できません',
  }),
  noRepeatedPhotoSortOrder: text({
    en: 'Must not repeat the sortOrder of an earlier photo',
    ja: '前の写真と同じ sortOrder は指定できません',
  }),
}
