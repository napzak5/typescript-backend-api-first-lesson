import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'
import { countOf } from '../written'

/*
 * What the catalogues of the treatment records share: the words of what a
 * record holds, the customer it names, how satisfied the customer was, the
 * kinds of the photos, and a count of records. The names of the customers,
 * the staff, the services and the products, the techniques, the notes and
 * the addresses of the photos stand as they were written. Each part of the
 * treatment records is a file of its own, and `adminTreatmentMessages`
 * (`treatments.ts`) collects them under one name.
 */

/** The words of the treatment records that more than one of their parts says */
export const TREATMENT_WORDS = {
  /** A record, as a heading and a term name it */
  record: text({ en: 'Treatment record', ja: '施術記録' }),
  /** The records, as a title, a caption and a column name them */
  records: text({ en: 'Treatment records', ja: '施術記録' }),
  /** What was done, as a part of a record and of its form names it */
  treatment: text({ en: 'Treatment', ja: '施術' }),
  customer: text({ en: 'Customer', ja: 'お客様' }),
  booking: text({ en: 'Booking', ja: '予約' }),
  staff: text({ en: 'Staff', ja: '担当' }),
  services: text({ en: 'Services provided', ja: '提供したサービス' }),
  techniques: text({ en: 'Techniques', ja: '技法' }),
  processingTime: text({ en: 'Treatment time', ja: '施術時間' }),
  writtenAt: text({ en: 'Written at', ja: '書いた日時' }),
  consultation: text({
    en: 'Consultation and condition',
    ja: 'カウンセリングと状態',
  }),
  consultationNotes: text({
    en: 'Consultation notes',
    ja: 'カウンセリングのメモ',
  }),
  scalpCondition: text({ en: 'Scalp condition', ja: '頭皮の状態' }),
  hairCondition: text({ en: 'Hair condition', ja: '毛髪の状態' }),
  colorFormula: text({ en: 'Color formula', ja: 'カラー剤の配合' }),
  materials: text({ en: 'Materials used', ja: '使った商材' }),
  product: text({ en: 'Product', ja: '商品' }),
  quantity: text({ en: 'Quantity', ja: '量' }),
  unit: text({ en: 'Unit', ja: '単位' }),
  lotNumber: text({ en: 'Lot number', ja: 'ロット番号' }),
  result: text({ en: 'Result and next visit', ja: '結果と次回' }),
  resultNotes: text({ en: 'Result notes', ja: '結果のメモ' }),
  satisfaction: text({
    en: 'Customer satisfaction',
    ja: 'お客様の満足度',
  }),
  nextRecommendedDate: text({
    en: 'Next recommended date',
    ja: '次に勧める日',
  }),
  nextRecommendedServices: text({
    en: 'Next recommended services',
    ja: '次に勧めるサービス',
  }),
  homeCareSuggestions: text({
    en: 'Home care suggestions',
    ja: 'ホームケアの提案',
  }),
  staffEvaluation: text({ en: 'Handover notes', ja: '申し送り' }),
  /** The button of a row of a form, and of a photo, that takes it away */
  remove: text({ en: 'Remove', ja: '外す' }),
  /** The way to the screen that changes a record, and its title */
  change: text({
    en: 'Edit the treatment record',
    ja: '施術記録を直す',
  }),
  /** The way to the screen that writes the record of a booking, and its title */
  entry: text({
    en: 'Write a treatment record',
    ja: '施術記録を書く',
  }),
  /** The way to a record */
  view: text({ en: 'View the treatment record', ja: '施術記録を見る' }),
  /** The way to the photos of a record, the submit of their form, and the title of its screen */
  addPhotos: text({ en: 'Add photos', ja: '写真を足す' }),
  loading: text({
    en: 'Loading the treatment record',
    ja: '施術記録を読み込んでいます',
  }),
  cancel: text({ en: 'Cancel', ja: 'やめる' }),
  back: text({ en: 'Back', ja: '戻る' }),
  /** The way to the list of the records */
  toList: text({
    en: 'Go to the treatment records',
    ja: '施術記録の一覧へ',
  }),
  /** The way to the statistics, and their title */
  statistics: text({ en: 'Treatment statistics', ja: '施術の統計' }),
  none: text({ en: 'No treatment records', ja: '施術記録はありません' }),
  notAnswered: text({ en: 'Not answered', ja: '未回答' }),
}

/** How satisfied a customer was, from 1 to 5 */
export type Satisfaction = 1 | 2 | 3 | 4 | 5

/** The names of the satisfactions a record holds */
export const SATISFACTIONS: Record<Satisfaction, LocalizedText> = {
  5: text({ en: 'Very satisfied', ja: 'とても満足' }),
  4: text({ en: 'Satisfied', ja: '満足' }),
  3: text({ en: 'Neutral', ja: 'ふつう' }),
  2: text({ en: 'Dissatisfied', ja: '不満' }),
  1: text({ en: 'Very dissatisfied', ja: 'とても不満' }),
}

/** A satisfaction by its value and its name: 「5（とても満足）」 */
export const rated = (value: number, name: LocalizedText): LocalizedText => {
  const written = numberOf(value)

  return text({
    en: `${written.en} (${name.en})`,
    ja: `${written.ja}（${name.ja}）`,
  })
}

/** How many records were counted: 「12 件」, "12 records" */
export const recordsOf = (count: number): LocalizedText =>
  countOf(count, 'record', 'records', '件')
