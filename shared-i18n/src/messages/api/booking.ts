import { type LocalizedText, text } from '../../languages/localized-text'

/** What an action makes of a booking, as a refusal says it. */
const DONE = {
  confirm: text({ en: 'confirmed', ja: '確定' }),
  cancel: text({ en: 'cancelled', ja: 'キャンセル' }),
  cancelAsCustomer: text({ en: 'cancelled', ja: 'キャンセル' }),
  start: text({ en: 'started', ja: '開始' }),
  complete: text({ en: 'completed', ja: '完了' }),
  noShow: text({
    en: 'noted as one the customer did not come to',
    ja: '無断キャンセルに',
  }),
}

/** What refers to a booking, as a refusal says it. */
const REFERRING = {
  sale: text({ en: 'a sale', ja: '売上' }),
  treatmentRecord: text({ en: 'a treatment record', ja: '施術記録' }),
  review: text({ en: 'a review', ja: 'レビュー' }),
}

/** The statuses one of which a booking has to have, as a sentence lists them. */
const oneOf = (statuses: readonly string[]): LocalizedText =>
  text({ en: statuses.join(' or '), ja: statuses.join(' か ') })

/** Names in an English sentence: `a`, `a and b`, `a, b and c`. */
const inASentence = (names: readonly string[]): string =>
  names.length <= 1
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} and ${names.slice(-1).join('')}`

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
  aBooking: text({
    en: 'Must name a booking',
    ja: '存在する予約を指定してください',
  }),
  atLeastOneService: text({
    en: 'Must have at least one service',
    ja: 'サービスを 1 つ以上指定してください',
  }),
  /** `limit` is the largest amount of a booking. */
  amountsWithinLimit: (limit: number) =>
    text({
      en: `The amounts of a booking must not exceed ${limit}`,
      ja: `予約の金額は、${limit} を超えられません`,
    }),
  timeZoneUnknown: text({
    en: 'The time zone of the salon is not one that is known, so the day of the visit cannot be told; correct the time zone of the salon first',
    ja: 'サロンのタイムゾーンが、知られているものではないので、来店の日がわかりません。先に、サロンのタイムゾーンを直してください',
  }),
  /**
   * `action` is what was asked for, `status` the status of the booking and
   * `allowed` the statuses that take the action.
   */
  statusDoesNotAllow: (
    action: keyof typeof DONE,
    status: string,
    allowed: readonly string[],
  ) =>
    text({
      en: `A booking that is ${status} cannot be ${DONE[action].en}; its status has to be ${oneOf(allowed).en}`,
      ja: `状態が ${status} の予約は、${DONE[action].ja}できません。状態は、${oneOf(allowed).ja} でなければなりません`,
    }),
  notBegunYet: text({
    en: 'The booking has not begun yet, so nobody failed to come to it; a booking that will not take place is cancelled',
    ja: 'この予約は、まだ始まっていないので、無断キャンセルにはできません。行われない予約は、キャンセルします',
  }),
  customerCancelsUntilTime: text({
    en: 'The time of the booking has come, so the customer cannot cancel it any more; the salon notes what became of the visit',
    ja: '予約の時刻になったので、顧客は、もうキャンセルできません。来店がどうなったかは、サロンが記録します',
  }),
  actualTimesOutOfOrder: text({
    en: 'The actual end has to be after the actual start, and one of the two is a time the booking already has; send both times',
    ja: '実際の終了は、実際の開始より後でなければなりません。どちらかは、予約がすでに持っている時刻です。両方の時刻を送ってください',
  }),
  /** `staffIds` are the staff members who have other bookings then. */
  staffOccupied: (staffIds: readonly string[]) =>
    text({
      en: `Other bookings occupy ${staffIds.length === 1 ? 'staff member' : 'staff members'} ${staffIds.join(', ')} at a time of this booking`,
      ja: `この予約の時刻に、スタッフ ${staffIds.join(', ')} には、ほかの予約があります`,
    }),
  /** `status` is the status of the booking and `allowed` the statuses in which one is moved. */
  cannotBeRescheduled: (status: string, allowed: readonly string[]) =>
    text({
      en: `A booking that is ${status} cannot be rescheduled; its status has to be ${oneOf(allowed).en}`,
      ja: `状態が ${status} の予約は、日時を変更できません。状態は、${oneOf(allowed).ja} でなければなりません`,
    }),
  /** `status` is the status of the booking and `allowed` the statuses in which its services change. */
  servicesAreSettled: (status: string, allowed: readonly string[]) =>
    text({
      en: `The services of a booking that is ${status} cannot be changed; its status has to be ${oneOf(allowed).en}`,
      ja: `状態が ${status} の予約は、サービスを変更できません。状態は、${oneOf(allowed).ja} でなければなりません`,
    }),
  /** `limit` is how many services a booking has at most. */
  atMostServices: (limit: number) =>
    text({
      en: `A booking has at most ${limit} services`,
      ja: `予約のサービスは、${limit} 個までです`,
    }),
  /** `hours` is how long a visit may last. */
  servicesBeginWithinHours: (hours: number) =>
    text({
      en: `Every service of a booking begins within ${hours} hours of the earliest one`,
      ja: `予約のサービスは、どれも、最も早いサービスから ${hours} 時間以内に始めます`,
    }),
  keepsAtLeastOneService: text({
    en: 'A booking keeps at least one service; cancel a booking that will not take place',
    ja: '予約には、サービスが 1 つ以上要ります。行われない予約は、キャンセルしてください',
  }),
  /** `by` is what refers to the booking. */
  referredTo: (by: readonly (keyof typeof REFERRING)[]) =>
    text({
      en: `The booking cannot be deleted: ${inASentence(by.map((reference) => REFERRING[reference].en))} ${by.length === 1 ? 'refers' : 'refer'} to it`,
      ja: `この予約は削除できません。${by.map((reference) => REFERRING[reference].ja).join('と')}が参照しています`,
    }),
  /** Why what bookings refer to is not deleted, by what it is. */
  unfinishedBookingsReferTo: {
    customer: text({
      en: 'The customer cannot be deleted: bookings that are not finished refer to it',
      ja: 'この顧客は削除できません。終わっていない予約が参照しています',
    }),
    salon: text({
      en: 'The salon cannot be deleted: bookings that are not finished refer to it',
      ja: 'このサロンは削除できません。終わっていない予約が参照しています',
    }),
    service: text({
      en: 'The service cannot be deleted: bookings that are not finished refer to it',
      ja: 'このサービスは削除できません。終わっていない予約が参照しています',
    }),
    staffMember: text({
      en: 'The staff member cannot be deleted: bookings that are not finished refer to it',
      ja: 'このスタッフは削除できません。終わっていない予約が参照しています',
    }),
  },
  noOnlineBooking: text({
    en: 'This customer profile does not take bookings online; contact the salon to book',
    ja: 'この顧客のプロフィールでは、オンラインで予約できません。予約は、サロンに連絡してください',
  }),
  noAvailableSlot: text({
    en: 'The staff member has no available slot for the service at that time; choose one of the available slots of the salon',
    ja: 'その時刻には、このスタッフに、このサービスの空き枠がありません。サロンの空き枠から選んでください',
  }),
  customerHasAnotherBooking: text({
    en: 'The customer has another booking at that time; cancel it first or choose another time',
    ja: 'その時刻には、この顧客に、ほかの予約があります。先にその予約をキャンセルするか、ほかの時刻を選んでください',
  }),
  customerMovesUntilTime: text({
    en: 'The time of the booking has come, so the customer cannot move it any more; the salon notes what became of the visit',
    ja: '予約の時刻になったので、顧客は、もう日時を変更できません。来店がどうなったかは、サロンが記録します',
  }),
  notMovedByCustomer: text({
    en: 'The booking has several services, or a service with another staff member than the one in charge, so the customer cannot move it; contact the salon to move it',
    ja: 'この予約には、サービスが 2 つ以上あるか、担当ではないスタッフのサービスがあるので、顧客は日時を変更できません。変更は、サロンに連絡してください',
  }),
}
