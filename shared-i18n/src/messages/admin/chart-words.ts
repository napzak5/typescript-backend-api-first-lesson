import { text } from '../../languages/localized-text'

/*
 * The words that the parts of the chart catalogue share: the fields of a
 * chart, which the form, the record and the search name alike, and the
 * treatments a chart records a customer had before.
 */

export const CHART_WORDS = {
  chart: text({ en: 'Chart', ja: 'カルテ' }),
  customer: text({ en: 'Customer', ja: 'お客様' }),
  medicalConditions: text({ en: 'Medical conditions', ja: '持病や体調' }),
  preferredProducts: text({ en: 'Preferred products', ja: '好みの商材' }),
  avoidProducts: text({ en: 'Products to avoid', ja: '避ける商材' }),
  notes: text({ en: 'Notes', ja: 'メモ' }),
  updatedAt: text({ en: 'Last written', ja: '最後に書いた日時' }),
  previousTreatments: text({ en: 'Past treatments', ja: '過去の施術' }),
  date: text({ en: 'Treatment date', ja: '施術日' }),
  treatment: text({ en: 'Treatment', ja: '施術' }),
  salonName: text({ en: 'Salon', ja: 'サロン' }),
  entry: text({ en: 'Create the chart', ja: 'カルテを作る' }),
  change: text({ en: 'Edit the chart', ja: 'カルテを直す' }),
  cancel: text({ en: 'Cancel', ja: 'やめる' }),
  toChart: text({ en: 'Back to the chart', ja: 'カルテへ' }),
}

/** A treatment the customer had before, as the chart names it */
export const CHART_TREATMENTS = {
  cut: text({ en: 'Cut', ja: 'カット' }),
  color: text({ en: 'Color', ja: 'カラー' }),
  perm: text({ en: 'Perm', ja: 'パーマ' }),
  treatment: text({ en: 'Treatment', ja: 'トリートメント' }),
  head_spa: text({ en: 'Head spa', ja: 'ヘッドスパ' }),
  styling: text({ en: 'Styling', ja: 'スタイリング' }),
  extension: text({ en: 'Extensions', ja: 'エクステンション' }),
  nail: text({ en: 'Nails', ja: 'ネイル' }),
  eyelash: text({ en: 'Eyelashes', ja: 'まつげ' }),
  other: text({ en: 'Other', ja: 'その他' }),
}
