import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'

/**
 * What the screens of a booking in the portal say: the booking of a
 * service, the bookings of a customer, the page of a booking with its
 * cancellation, and the move of a booking to another time.
 */
export const portalBookingMessages = {
  /** What the screens of a booking that needs a session say to a visitor */
  signInToSee: text({
    en: 'Sign in to see your bookings.',
    ja: '予約を確認するには、サインインしてください。',
  }),
  /** The screen that books a service */
  booking: {
    title: text({ en: 'Book', ja: '予約する' }),
    signInNotice: text({
      en: 'Sign in to book.',
      ja: '予約するには、サインインしてください。',
    }),
    loading: text({
      en: 'Loading what the booking needs',
      ja: '予約に必要な情報を読み込んでいます',
    }),
    loadingService: text({
      en: 'Loading the menu',
      ja: 'メニューを読み込んでいます',
    }),
    serviceNotFound: text({
      en: 'No service to book was found',
      ja: '予約できるメニューが見つかりません',
    }),
    serviceNotFoundDescription: text({
      en: 'Check that the address is correct. The salon or the service may no longer be listed.',
      ja: 'アドレスが正しいか、お確かめください。掲載を終えたサロンか、メニューかもしれません。',
    }),
    backToSalon: text({
      en: 'Back to the page of the salon',
      ja: 'サロンのページへ戻る',
    }),
    /** A service that is not booked on this screen, by its name */
    notOnline: (service: string) =>
      text({
        en: `“${service}” cannot be booked on this screen. Please contact the salon to book it.`,
        ja: `「${service}」は、この画面からは予約できません。ご予約は、サロンへお問い合わせください。`,
      }),
    summary: text({ en: 'Your booking', ja: 'ご予約の内容' }),
    duration: text({ en: 'Duration', ja: '所要時間' }),
    time: text({ en: 'Date and time', ja: '日時' }),
    submit: text({ en: 'Book with these details', ja: 'この内容で予約する' }),
    request: text({ en: 'Requests', ja: 'ご要望' }),
    requestDescription: text({
      en: 'If there is anything you would like the salon to know, write it here.',
      ja: 'サロンに伝えておきたいことがあれば、ご記入ください。',
    }),
    booked: text({
      en: 'Your booking was received.',
      ja: '予約を受け付けました。',
    }),
  },
  /** The step that asks a new customer who they are */
  profile: {
    title: text({ en: 'About you', ja: 'お客様の情報' }),
    description: text({
      en: 'This is your first booking. Register your name and phone number, so that the salon can welcome you.',
      ja: 'はじめてのご予約です。サロンがお客様をお迎えするために、お名前と電話番号を登録してください。',
    }),
    submit: text({
      en: 'Register and choose a time',
      ja: '登録して、日時の選択へ進む',
    }),
  },
  /** The choice of the member of the staff, the day and the time */
  form: {
    staff: text({ en: 'Staff', ja: 'スタッフ' }),
    anybody: text({ en: 'No preference', ja: '指名しない' }),
    day: text({ en: 'Date', ja: '日付' }),
    dayBefore: text({ en: 'Previous day', ja: '前の日' }),
    dayAfter: text({ en: 'Next day', ja: '次の日' }),
    loading: text({
      en: 'Loading the free times',
      ja: '空いている時刻を読み込んでいます',
    }),
    noTimes: text({
      en: 'There is no time to book on this day',
      ja: 'この日は、予約できる時刻がありません',
    }),
    noTimesDescription: text({
      en: 'Change the date or the staff and look again.',
      ja: '日付かスタッフを変えて、お探しください。',
    }),
    startTime: text({ en: 'Start time', ja: '開始時刻' }),
    /** What is said of the times of a day, with the day */
    startTimeDescription: (day: LocalizedText) =>
      text({
        en: `The free times on ${day.en}. The times are those of the time zone of the salon.`,
        ja: `${day.ja}の、空いている時刻です。時刻は、サロンのある地域の時刻です。`,
      }),
  },
  /** What the forms of a booking say of what they were sent with, and of what the API did not do */
  flow: {
    noStartTime: text({
      en: 'Choose a start time.',
      ja: '開始時刻を選択してください。',
    }),
    notBooked: text({
      en: 'This time could not be booked. The free times were loaded again: choose one anew. If it still cannot be booked, please contact the salon.',
      ja: 'この日時では、予約できませんでした。空いている時刻を読み込み直しましたので、選び直してください。予約できない状態が続くときは、サロンにお問い合わせください。',
    }),
    noProfile: text({
      en: 'Your details could not be loaded. Register your details once more.',
      ja: 'お客様の情報を読み込めませんでした。もう一度、お客様の情報を登録してください。',
    }),
    bookingRefused: text({
      en: 'It could not be booked. Load the page again and try again.',
      ja: '予約できませんでした。ページを読み込み直して、もう一度お試しください。',
    }),
    notCancelled: text({
      en: 'This booking could not be cancelled. The salon changed its state, or its start time has passed. The booking was loaded again: check it.',
      ja: 'この予約は、キャンセルできませんでした。サロンが予約の状態を変えたか、開始時刻を過ぎています。予約の内容を読み込み直しましたので、お確かめください。',
    }),
    notMoved: text({
      en: 'It could not be moved to this time. The free times were loaded again: choose one anew. If it still cannot be moved, please contact the salon.',
      ja: 'この日時には、変更できませんでした。空いている時刻を読み込み直しましたので、選び直してください。変更できない状態が続くときは、サロンにお問い合わせください。',
    }),
    moveNotFound: text({
      en: 'This booking was not found. Check it in the list of your bookings.',
      ja: 'この予約は、見つかりませんでした。予約の一覧から、お確かめください。',
    }),
    moveRefused: text({
      en: 'It could not be changed. Load the page again and try again.',
      ja: '変更できませんでした。ページを読み込み直して、もう一度お試しください。',
    }),
  },
  /** The bookings of a customer */
  list: {
    title: text({ en: 'Your bookings', ja: '予約の一覧' }),
    description: text({
      en: 'You can change the time of a booking or cancel it on its own page.',
      ja: '日時の変更とキャンセルは、それぞれの予約の内容の画面から行えます。',
    }),
    periods: text({ en: 'Period of the bookings', ja: '予約の時期' }),
    upcoming: text({ en: 'Upcoming bookings', ja: 'これからの予約' }),
    past: text({ en: 'Past bookings', ja: 'これまでの予約' }),
    loading: text({ en: 'Loading the bookings', ja: '予約を読み込んでいます' }),
    noneUpcoming: text({
      en: 'There are no upcoming bookings',
      ja: 'これからの予約はありません',
    }),
    noneUpcomingDescription: text({
      en: 'Find a salon and book from its menu.',
      ja: 'サロンを探して、メニューから予約できます。',
    }),
    nonePast: text({
      en: 'There are no past bookings',
      ja: 'これまでの予約はありません',
    }),
    /** How many bookings the list has */
    count: (count: number) =>
      text({
        en: `${numberOf(count).en} ${count === 1 ? 'booking' : 'bookings'}`,
        ja: `${numberOf(count).ja} 件の予約があります`,
      }),
    /** What stands where a name would, when the salon is no longer listed */
    noSalon: text({
      en: 'Salon (no longer listed)',
      ja: 'サロン（掲載を終えています）',
    }),
    /** The same, when the service is no longer listed */
    noService: text({
      en: 'Service (no longer listed)',
      ja: 'メニュー（掲載を終えています）',
    }),
  },
  /** A booking as its customer reads it */
  summary: {
    state: text({ en: 'Status', ja: '状態' }),
    salon: text({ en: 'Salon', ja: 'サロン' }),
    service: text({ en: 'Service', ja: 'メニュー' }),
    staff: text({ en: 'Staff', ja: '担当' }),
    when: text({ en: 'Date and time', ja: '日時' }),
    price: text({ en: 'Price', ja: '料金' }),
    request: text({ en: 'Requests', ja: 'ご要望' }),
    /** What stands where a name would, when the salon no longer shows what is named */
    noLongerShown: text({
      en: '(No longer listed)',
      ja: '（掲載を終えています）',
    }),
    /** From when until when, and how long that is: 「10:30〜11:30（60 分）」 */
    withDuration: (hours: LocalizedText | null, duration: LocalizedText) =>
      text({
        en:
          hours === null ? `(${duration.en})` : `${hours.en} (${duration.en})`,
        ja: `${hours?.ja ?? ''}（${duration.ja}）`,
      }),
    /** What a booking comes to, with the tax that was added to it */
    totalWithTax: (total: LocalizedText, tax: LocalizedText) =>
      text({
        en: `${total.en} (including ${tax.en} consumption tax)`,
        ja: `${total.ja}（うち消費税 ${tax.ja}）`,
      }),
    /** When a booking is, in one line: 「2026年11月24日火曜日 10:30〜11:30」 */
    whenLine: (day: LocalizedText, hours: LocalizedText) =>
      text({ en: `${day.en}, ${hours.en}`, ja: `${day.ja} ${hours.ja}` }),
    /** What comes next, for a state whose word does not say it */
    draftNote: text({
      en: 'The salon is getting the details of the booking ready.',
      ja: 'サロンが、予約の内容を整えています。',
    }),
    pendingNote: text({
      en: 'The booking is confirmed once the salon has checked it.',
      ja: 'サロンが内容を確認すると、予約が確定します。',
    }),
  },
  /** The page of a booking */
  detail: {
    title: text({ en: 'Booking details', ja: '予約の内容' }),
    loading: text({ en: 'Loading the booking', ja: '予約を読み込んでいます' }),
    loadingDetails: text({
      en: 'Loading the details of the booking',
      ja: '予約の内容を読み込んでいます',
    }),
    /** The title of the summary, with the number of the booking */
    numbered: (bookingNumber: string) =>
      text({
        en: `Booking number ${bookingNumber}`,
        ja: `予約番号 ${bookingNumber}`,
      }),
    notFound: text({ en: 'Booking not found', ja: '予約が見つかりません' }),
    notFoundDescription: text({
      en: 'Check that the address is correct. A booking made with another account cannot be shown.',
      ja: 'アドレスが正しいか、お確かめください。ほかのアカウントで入れた予約は、表示できません。',
    }),
    toList: text({ en: 'Go to your bookings', ja: '予約の一覧へ' }),
    cancelled: text({
      en: 'The booking was cancelled.',
      ja: '予約をキャンセルしました。',
    }),
  },
  /** What a customer can still do with a booking */
  changes: {
    askTheSalon: text({
      en: 'Please contact the salon to change the time of this booking.',
      ja: 'この予約の日時の変更は、サロンにお問い合わせください。',
    }),
    move: text({ en: 'Change the time', ja: '日時を変更する' }),
    cancel: text({ en: 'Cancel the booking', ja: '予約をキャンセルする' }),
    cancelTitle: text({
      en: 'Cancel the booking?',
      ja: '予約をキャンセルしますか？',
    }),
    /** What the dialog says of the booking it cancels, named by when it is */
    cancelDescription: (when: LocalizedText) =>
      text({
        en: `This cancels the booking on ${when.en}. A cancelled booking cannot be restored.`,
        ja: `${when.ja}の予約をキャンセルします。キャンセルした予約は、元に戻せません。`,
      }),
    confirmCancel: text({
      en: 'Confirm the cancellation',
      ja: 'キャンセルを確定する',
    }),
    reason: text({ en: 'Reason for cancelling', ja: 'キャンセルの理由' }),
    reasonDescription: text({
      en: 'If there is anything you would like to tell the salon, write it here. You can cancel without it.',
      ja: 'サロンに伝えたいことがあれば、ご記入ください。空欄のままでも、キャンセルできます。',
    }),
  },
  /** The move of a booking to another time */
  move: {
    title: text({ en: 'Change the time', ja: '日時の変更' }),
    signInNotice: text({
      en: 'Sign in to change the time of your booking.',
      ja: '予約の日時を変更するには、サインインしてください。',
    }),
    newTime: text({ en: 'New date and time', ja: '新しい日時' }),
    confirmedNote: text({
      en: 'This booking is confirmed. When its time is changed, it awaits confirmation again, and is confirmed once the salon has checked it.',
      ja: 'この予約は確定しています。日時を変更すると「確定待ち」に戻り、サロンが内容を確認すると、あらためて確定します。',
    }),
    overlapNote: text({
      en: 'Times that overlap the present time of the booking may not be among the free times.',
      ja: 'いまの予約の時間と重なる時刻は、空いている時刻に表示されないことがあります。',
    }),
    submit: text({ en: 'Change to this time', ja: 'この日時に変更する' }),
    moved: text({
      en: 'The time of the booking was changed.',
      ja: '予約の日時を変更しました。',
    }),
    cannotMove: text({
      en: 'The time of this booking cannot be changed. A cancelled booking, and one whose start time has passed, cannot be changed.',
      ja: 'この予約は、日時を変更できません。キャンセルした予約と、開始時刻を過ぎた予約は、変更できません。',
    }),
    askTheSalon: text({
      en: 'The time of this booking cannot be changed on this screen. Please contact the salon to change it.',
      ja: 'この予約は、この画面から日時を変更できません。日時の変更は、サロンにお問い合わせください。',
    }),
    backToBooking: text({
      en: 'Back to the booking',
      ja: '予約の内容へ戻る',
    }),
  },
  /**
   * What the sentences of this catalogue and of another one speak of (what
   * was not read: `answerMessages.unread`), written as it stands inside
   * such a sentence
   */
  names: {
    bookings: text({ en: 'the bookings', ja: '予約' }),
    booking: text({ en: 'the booking', ja: '予約' }),
    details: text({ en: 'the details of the booking', ja: '予約の内容' }),
    freeTimes: text({ en: 'the free times', ja: '空いている時刻' }),
    staff: text({ en: 'the staff', ja: 'スタッフ' }),
    profile: text({ en: 'your details', ja: 'お客様の情報' }),
    salon: text({ en: 'the salon', ja: 'サロン' }),
    menu: text({ en: 'the menu', ja: 'メニュー' }),
  },
}
