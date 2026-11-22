import { text } from '../../languages/localized-text'

/** What the API says of the salons. */
export const salonMessages = {
  invalidSalon: text({
    en: 'Invalid salon',
    ja: 'サロンの内容が正しくありません',
  }),
  invalidSalonUpdate: text({
    en: 'Invalid salon update',
    ja: 'サロンの変更の内容が正しくありません',
  }),
  invalidSalonSearch: text({
    en: 'Invalid salon search',
    ja: 'サロンの検索の条件が正しくありません',
  }),
  invalidSalonId: text({
    en: 'Invalid salon ID',
    ja: 'サロンの ID が正しくありません',
  }),
  currencyCode: text({
    en: 'Must be a three-letter ISO 4217 currency code',
    ja: 'ISO 4217 の 3 文字の通貨コードにしてください',
  }),
  emptyWhenClosed: text({
    en: 'Must be empty when the day is closed',
    ja: '休みの日は、空にしてください',
  }),
  noRepeatedDay: text({
    en: 'Must not repeat the day of an earlier entry',
    ja: '前の要素と同じ曜日は指定できません',
  }),
  dayOfWeekOf: (date: string) =>
    text({
      en: `Must be the day of the week of ${date}`,
      ja: `${date} の曜日にしてください`,
    }),
  timesUnlessHoliday: text({
    en: 'Required unless the day is a holiday without opening hours',
    ja: '営業時間のない休日のほかは、指定してください',
  }),
  noRepeatedDate: text({
    en: 'Must not repeat a date of an earlier entry',
    ja: '前の要素と同じ日付は指定できません',
  }),
}
