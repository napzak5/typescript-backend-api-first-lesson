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
  aTreatmentRecordOfList: text({
    en: 'Must name a treatment record of the list',
    ja: 'この一覧の施術記録を指定してください',
  }),
  aBookingOfASalon: text({
    en: 'Must name a booking of a salon',
    ja: '存在するサロンの予約を指定してください',
  }),
  aServiceOfSalonOfBooking: text({
    en: 'Must name a service of the salon of the booking',
    ja: '予約のサロンのサービスを指定してください',
  }),
  aProductOfSalonOfBooking: text({
    en: 'Must name a product of the salon of the booking',
    ja: '予約のサロンの商品を指定してください',
  }),
  theCustomerOfBooking: text({
    en: 'Must name the customer of the booking',
    ja: '予約の顧客を指定してください',
  }),
  aStaffMemberOfSalonOfBooking: text({
    en: 'Must name a staff member of the salon of the booking',
    ja: '予約のサロンのスタッフを指定してください',
  }),
  /** `bookingDate` is the day of the booking. */
  notBeforeBookingDate: (bookingDate: string) =>
    text({
      en: `Must not be before the date of the booking, ${bookingDate}`,
      ja: `予約の日（${bookingDate}）より前にはできません`,
    }),
  /** `photoUrl` is the address of the photo. */
  photoExists: (photoUrl: string) =>
    text({
      en: `The record holds a photo at ${photoUrl} already; a record holds one photo of an address`,
      ja: `この施術記録には、${photoUrl} の写真が、すでにあります。同じアドレスの写真は、施術記録に 1 つです`,
    }),
  /** `held` is how many photos the record holds and `most` how many it may. */
  tooManyPhotos: (held: number, most: number) =>
    text({
      en: `The record holds ${held} photos; a record holds at most ${most}`,
      ja: `この施術記録には、写真が ${held} 枚あります。施術記録の写真は、${most} 枚までです`,
    }),
  /** `status` is the status of the booking. */
  bookingNotTreated: (status: string) =>
    text({
      en: `The booking is ${status}; a treatment is recorded once it has begun`,
      ja: `予約の状態は ${status} です。施術は、予約が始まってから記録します`,
    }),
  bookingHasRecord: text({
    en: 'The booking has a treatment record already; a booking has one',
    ja: 'この予約には、すでに施術記録があります。施術記録は、予約に 1 つです',
  }),
}
