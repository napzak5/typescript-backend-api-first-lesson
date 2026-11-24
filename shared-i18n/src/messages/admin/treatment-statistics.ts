import { type LocalizedText, text } from '../../languages/localized-text'
import { TREATMENT_WORDS } from './treatment-words'

/*
 * What the statistics of the treatment records say: the period they are
 * counted over, how many records there were and how long the treatments
 * took, the records by the category of their services, and the services
 * with the most records.
 */

export const treatmentStatisticsMessages = {
  toList: TREATMENT_WORDS.toList,
  periodDescription: text({
    en: 'Counted by the day the treatment record was written (the date at the salon).',
    ja: '施術記録を書いた日（サロンの日付）で数えます。',
  }),
  /** The records that were counted, by the period they were written in */
  of: (period: LocalizedText) =>
    text({
      en: `Treatment records for ${period.en}`,
      ja: `${period.ja}に書いた施術記録`,
    }),
  counting: text({
    en: 'Counting the treatment records',
    ja: '施術記録を集計しています',
  }),
  none: text({
    en: 'No treatment records were written in this period',
    ja: 'この期間に書いた施術記録はありません',
  }),
  noneDescription: text({
    en: 'Change the period and count again.',
    ja: '期間を変えて集計してください。',
  }),
  /** How many records there were, and how long the treatments took */
  count: {
    title: text({
      en: 'Number of treatment records',
      ja: '施術記録の数',
    }),
    records: TREATMENT_WORDS.records,
    average: text({
      en: 'Average treatment time',
      ja: '施術時間の平均',
    }),
  },
  /** The records by the category of their services */
  byCategory: {
    title: text({ en: 'By menu category', ja: 'メニューの区分ごと' }),
    caption: text({
      en: 'Treatment records by menu category',
      ja: 'メニューの区分ごとの施術記録',
    }),
    category: text({ en: 'Menu category', ja: 'メニューの区分' }),
    records: TREATMENT_WORDS.records,
    none: TREATMENT_WORDS.none,
    note: text({
      en: 'A treatment record with services of several categories is counted once for each category. The counts together may be more than the number of treatment records.',
      ja: 'いくつもの区分のサービスをした施術記録は、区分ごとに 1 件と数えます。合わせた数は、施術記録の数より多いことがあります。',
    }),
  },
  /** The services with the most records */
  topServices: {
    title: text({
      en: 'Services with the most treatment records',
      ja: '施術記録の多いサービス',
    }),
    rank: text({ en: 'Rank', ja: '順位' }),
    service: text({ en: 'Service', ja: 'サービス' }),
    records: TREATMENT_WORDS.records,
    none: TREATMENT_WORDS.none,
  },
}
