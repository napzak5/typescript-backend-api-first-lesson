import { numberOf } from '../../formats/numbers'
import { text } from '../../languages/localized-text'
import { listed } from '../written'
import { fieldMessages } from './fields'

/**
 * What the preferences of a customer say (`frontend/packages/preferences`):
 * the form, its rows of time slots, what is said of what the form was sent
 * with, and the preferences as they are read.
 */
export const preferenceMessages = {
  /** The parts and the controls of the form, which the preferences are read under too */
  form: {
    staff: text({ en: 'Staff', ja: 'スタッフ' }),
    staffAfterBooking: text({
      en: 'You can choose the staff you wish for, and those you would rather avoid, once you have booked at a salon.',
      ja: '指名したいスタッフと、避けたいスタッフは、サロンを予約すると選べるようになります。',
    }),
    preferredStaff: text({ en: 'Preferred staff', ja: '指名したいスタッフ' }),
    noPreferredStaff: text({ en: 'No preference', ja: '指名しない' }),
    avoidedStaff: text({ en: 'Staff to avoid', ja: '避けたいスタッフ' }),
    timeSlots: text({ en: 'Preferred times', ja: '希望する時間帯' }),
    timeSlotsDescription: text({
      en: 'Add as many times as suit your visits. Days of the week cannot be chosen.',
      ja: '来店しやすい時間帯を、いくつでも登録できます。曜日は選べません。',
    }),
    style: text({ en: 'Style', ja: 'スタイルの好み' }),
    preferredLength: text({ en: 'Preferred length', ja: '希望の長さ' }),
    preferredColors: text({ en: 'Favorite colors', ja: '好きな色' }),
    avoidedStyles: text({ en: 'Styles to avoid', ja: '避けたいスタイル' }),
    oneALine: text({
      en: 'Write one on each line.',
      ja: '1 行に 1 つずつ書いてください。',
    }),
    inspirationImages: text({
      en: 'URLs of reference images',
      ja: '参考の画像の URL',
    }),
    inspirationImagesDescription: text({
      en: 'Write the address of each image to refer to on a line of its own.',
      ja: '参考にしてほしい画像のアドレスを、1 行に 1 つずつ書いてください。',
    }),
    service: text({ en: 'Service', ja: '接客' }),
    communicationStyle: text({
      en: 'How you like to be served',
      ja: '接客の好み',
    }),
    /** What is said of the control of how the customer likes to be served, with its longest text */
    communicationStyleDescription: (most: number) =>
      text({
        en: `How much you like to talk, and the like, in up to ${fieldMessages.characters(most).en}.`,
        ja: `会話の多さなどを、${fieldMessages.characters(most).ja}以内で書いてください。`,
      }),
    specialRequests: text({ en: 'Special requests', ja: '特別な要望' }),
  },
  /** The rows of the time slots, numbered from 1 */
  timeSlots: {
    start: (row: number) =>
      text({
        en: `Start of time ${numberOf(row).en}`,
        ja: `時間帯 ${numberOf(row).ja} の開始`,
      }),
    end: (row: number) =>
      text({
        en: `End of time ${numberOf(row).en}`,
        ja: `時間帯 ${numberOf(row).ja} の終了`,
      }),
    remove: (row: number) =>
      text({
        en: `Remove time ${numberOf(row).en}`,
        ja: `時間帯 ${numberOf(row).ja} を削除する`,
      }),
    add: text({ en: 'Add a time', ja: '時間帯を追加する' }),
  },
  /** What is said of what the form was sent with, and of what the API did not take */
  flow: {
    avoidedIsWishedFor: text({
      en: 'The staff you wish for cannot be among those to avoid. Change one of them.',
      ja: '指名したいスタッフは、避けたいスタッフに選べません。どちらかを変えてください。',
    }),
    startMissing: text({
      en: 'Enter the start time.',
      ja: '開始の時刻を入力してください。',
    }),
    endMissing: text({
      en: 'Enter the end time.',
      ja: '終了の時刻を入力してください。',
    }),
    timeMalformed: text({
      en: 'Enter a time such as 09:30.',
      ja: '時刻は、09:30 のように入力してください。',
    }),
    endNotLater: text({
      en: 'Make the end later than the start.',
      ja: '終了は、開始より後の時刻にしてください。',
    }),
    overlapping: text({
      en: 'This overlaps another time. Choose times that do not overlap.',
      ja: 'ほかの時間帯と重なっています。重ならない時刻にしてください。',
    }),
    staffGone: text({
      en: 'This member of the staff can no longer be chosen. Choose another.',
      ja: 'このスタッフは、選べなくなりました。ほかのスタッフを選んでください。',
    }),
    wishedForIsAvoided: text({
      en: 'This member of the staff is among those to avoid. Change one of them.',
      ja: 'このスタッフは、避けたいスタッフに入っています。どちらかを変えてください。',
    }),
    avoidedStaffGone: text({
      en: 'Some of the staff can no longer be chosen. Load the page again and choose anew.',
      ja: '選べなくなったスタッフが含まれています。ページを読み込み直して、選び直してください。',
    }),
    timeSlotsRefused: text({
      en: 'Check the preferred times and try again.',
      ja: '希望する時間帯を確かめて、もう一度お試しください。',
    }),
  },
  /** The preferences as they are read */
  details: {
    /** What stands where a preference would, when the customer has none */
    unset: text({ en: 'Not specified', ja: '指定なし' }),
    inspirationImages: text({ en: 'Reference images', ja: '参考の画像' }),
    /** The entries of a list, as a sentence lists them */
    listed: (entries: readonly string[]) => listed(entries),
  },
  /** A member of the staff where staff of several salons stand together: 「田中 美咲（Beauty Salon Tokyo）」 */
  staffOfSalon: (displayName: string, salonName: string) =>
    text({
      en: `${displayName} (${salonName})`,
      ja: `${displayName}（${salonName}）`,
    }),
}
