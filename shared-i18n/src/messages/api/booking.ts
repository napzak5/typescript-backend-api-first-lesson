import { text } from '../../languages/localized-text'

/** What the API says of the bookings. */
export const bookingMessages = {
  invalidBooking: text({
    en: 'Invalid booking',
    ja: '予約の内容が正しくありません',
  }),
  invalidBookingId: text({
    en: 'Invalid booking ID',
    ja: '予約の ID が正しくありません',
  }),
  invalidBookingServiceId: text({
    en: 'Invalid booking service ID',
    ja: '予約のサービスの ID が正しくありません',
  }),
  invalidBookingSearch: text({
    en: 'Invalid booking search',
    ja: '予約の検索の条件が正しくありません',
  }),
  invalidBookingCompletion: text({
    en: 'Invalid booking completion',
    ja: '予約の完了の内容が正しくありません',
  }),
  invalidBookingService: text({
    en: 'Invalid booking service',
    ja: '予約のサービスの内容が正しくありません',
  }),
  invalidBookingUpdate: text({
    en: 'Invalid booking update',
    ja: '予約の変更の内容が正しくありません',
  }),
  invalidBookingCancellation: text({
    en: 'Invalid booking cancellation',
    ja: '予約のキャンセルの内容が正しくありません',
  }),
  invalidBookingReschedule: text({
    en: 'Invalid booking reschedule',
    ja: '予約の日時の変更の内容が正しくありません',
  }),
  wholeMinute: text({
    en: 'Must be on a whole minute',
    ja: '秒のない、分ちょうどの時刻にしてください',
  }),
  /** `hours` is how long a visit may last. */
  withinHoursOfEarliest: (hours: number) =>
    text({
      en: `Must be within ${hours} hours of the earliest service`,
      ja: `最も早いサービスから ${hours} 時間以内にしてください`,
    }),
  afterActualStartTime: text({
    en: 'Must be after actualStartTime',
    ja: 'actualStartTime より後にしてください',
  }),
}
