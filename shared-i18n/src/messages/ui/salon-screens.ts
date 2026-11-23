import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'

/**
 * What the screens of a salon share say (`frontend/packages/salon-screens`):
 * the start of an application of a salon, the choice of a salon, the salon
 * of an address, the search by a keyword and the period of a count.
 */
export const salonScreenMessages = {
  /** The control of the search by a keyword */
  keyword: text({ en: 'Keyword', ja: 'キーワード' }),
  /** The salons to choose from */
  salonChoices: {
    caption: text({ en: 'Salons', ja: 'サロン' }),
    salon: text({ en: 'Salon', ja: 'サロン' }),
    address: text({ en: 'Address', ja: '所在地' }),
    bookings: text({ en: 'Bookings', ja: '予約の受付' }),
    accepting: text({ en: 'Accepting', ja: '受付中' }),
    paused: text({ en: 'Paused', ja: '停止中' }),
    none: text({ en: 'There are no salons', ja: 'サロンはありません' }),
  },
  /** Where an administrator chooses the salon to work on */
  salonChoice: {
    title: text({ en: 'Choose a salon', ja: 'サロンを選ぶ' }),
    search: text({ en: 'Search for a salon', ja: 'サロンを探す' }),
    searchDescription: text({
      en: 'Words in the name or the introduction of a salon. Leave it empty to list every salon.',
      ja: 'サロンの名前か紹介文にある言葉。空欄のときは、すべてのサロンを並べます。',
    }),
    loading: text({ en: 'Loading the salons', ja: 'サロンを読み込んでいます' }),
    noneYet: text({
      en: 'There are no salons yet',
      ja: 'サロンはまだありません',
    }),
    noMatch: text({
      en: 'No salon matches the keyword',
      ja: 'キーワードに合うサロンが見つかりませんでした',
    }),
    noMatchDescription: text({
      en: 'Change the keyword and search again.',
      ja: 'キーワードを変えて、もう一度お探しください。',
    }),
  },
  /** The start of an application, while the salon of who is signed in is read */
  start: {
    checking: text({ en: 'Checking your salon', ja: 'サロンを確かめています' }),
  },
  /** A screen of the salon of the address */
  withSalon: {
    loading: text({ en: 'Loading the salon', ja: 'サロンを読み込んでいます' }),
    notFound: text({ en: 'Salon not found', ja: 'サロンが見つかりません' }),
    notFoundDescription: text({
      en: 'Check that the address is correct. A deleted salon cannot be shown.',
      ja: 'アドレスが正しいか、お確かめください。削除されたサロンは、表示できません。',
    }),
  },
  /** What a member of the staff of another salon is told */
  otherSalon: {
    /** What is not theirs to see (「売上」), and who may see it */
    notice: (what: LocalizedText, who: LocalizedText) =>
      text({
        en: `You cannot see the ${what.en} of this salon. Only ${who.en} can.`,
        ja: `このサロンの${what.ja}は、見られません。${what.ja}を見られるのは、${who.ja}です。`,
      }),
    /** The way to the start of their own salon: 「予約」 */
    toOwnSalon: (start: LocalizedText) =>
      text({
        en: `Go to the ${start.en} of your salon`,
        ja: `自分のサロンの${start.ja}へ`,
      }),
  },
  /**
   * What the sentences of this catalogue and of another one speak of (what
   * was not read: `answerMessages.unread`), written as it stands inside
   * such a sentence
   */
  names: {
    salon: text({ en: 'the salon', ja: 'サロン' }),
    salons: text({ en: 'the salons', ja: 'サロン' }),
    ownSalon: text({ en: 'your salon', ja: '所属するサロン' }),
    bookings: text({ en: 'bookings', ja: '予約' }),
    staffOfTheSalon: text({
      en: 'the staff of the salon and the administrators',
      ja: 'そのサロンのスタッフと、管理者',
    }),
  },
  /** The days something is counted over */
  period: {
    label: text({ en: 'Period to count', ja: '集計する期間' }),
    from: text({ en: 'Period to count (from)', ja: '集計する期間（から）' }),
    to: text({ en: 'Period to count (to)', ja: '集計する期間（まで）' }),
    dayMissing: text({ en: 'Enter a date.', ja: '日付を入力してください。' }),
    endBeforeStart: text({
      en: 'Make the last day the same as the first day, or later.',
      ja: '終わりの日は、始まりの日と同じか、その後にしてください。',
    }),
    /** A period of more days than the API counts over */
    tooLong: (most: number) =>
      text({
        en: `Make the period ${numberOf(most).en} days or shorter.`,
        ja: `期間は ${numberOf(most).ja} 日までにしてください。`,
      }),
    /** A period in words, by its first and its last day */
    name: (from: LocalizedText, to: LocalizedText) =>
      text({ en: `${from.en} – ${to.en}`, ja: `${from.ja}〜${to.ja}` }),
  },
}
