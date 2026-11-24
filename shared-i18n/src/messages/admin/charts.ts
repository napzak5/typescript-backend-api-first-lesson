import { text } from '../../languages/localized-text'
import { salonScreenMessages } from '../ui/salon-screens'
import { chartAllergies } from './chart-allergies'
import { chartForm } from './chart-form'
import { CHART_TREATMENTS, CHART_WORDS } from './chart-words'

/*
 * What the screens of the charts say in the admin application: the chart
 * of a customer with their allergies, the chart made and changed, an
 * allergy recorded, changed and removed, and the search of the charts.
 * What a chart holds (the medical conditions, the products, the notes,
 * the salons and the notes of the treatments had before) stands as it was
 * written.
 */

export const adminChartMessages = {
  titles: {
    chart: CHART_WORDS.chart,
    entry: CHART_WORDS.entry,
    change: CHART_WORDS.change,
    search: text({ en: 'Search the charts', ja: 'カルテを探す' }),
    allergyEntry: text({ en: 'Record an allergy', ja: 'アレルギーを記録する' }),
    allergyChange: text({
      en: 'Edit the allergy record',
      ja: 'アレルギーの記録を直す',
    }),
  },
  /** What a screen could not read, as a sentence names it */
  names: {
    chart: text({ en: 'the chart', ja: 'カルテ' }),
    charts: text({ en: 'the charts', ja: 'カルテ' }),
    allergies: text({ en: 'the allergies', ja: 'アレルギー' }),
    allergy: text({ en: 'the allergy', ja: 'アレルギー' }),
  },
  loading: {
    chart: text({ en: 'Loading the chart', ja: 'カルテを読み込んでいます' }),
    charts: text({ en: 'Loading the charts', ja: 'カルテを読み込んでいます' }),
    allergies: text({
      en: 'Loading the allergies',
      ja: 'アレルギーを読み込んでいます',
    }),
    allergy: text({
      en: 'Loading the allergy',
      ja: 'アレルギーを読み込んでいます',
    }),
  },
  words: CHART_WORDS,
  treatments: CHART_TREATMENTS,
  /** The chart of a customer */
  record: {
    none: text({
      en: 'This customer has no chart yet. A chart holds the medical conditions and the state of health to take care of before a treatment, the products the customer prefers and those to avoid, and the treatments they had at other salons, and is checked before a treatment.',
      ja: 'このお客様のカルテは、まだありません。カルテには、施術の前に注意が必要な持病や体調、好みの商材と避ける商材、ほかのサロンで受けた施術を書き、施術の前に確かめます。',
    }),
    previousTreatmentsCaption: text({
      en: 'List of past treatments',
      ja: '過去の施術の一覧',
    }),
    noPreviousTreatments: text({ en: 'None recorded', ja: '記録はありません' }),
  },
  /** The screens that make and change a chart, when the customer has one or none */
  screens: {
    exists: text({
      en: 'This customer has a chart.',
      ja: 'このお客様には、カルテがあります。',
    }),
    noneYet: text({
      en: 'This customer has no chart yet.',
      ja: 'このお客様のカルテは、まだありません。',
    }),
  },
  search: {
    label: text({ en: 'Search the charts', ja: 'カルテを探す' }),
    keyword: salonScreenMessages.keyword,
    keywordDescription: text({
      en: 'Part of the medical conditions, the notes, or the names of the preferred products and the products to avoid.',
      ja: '持病や体調、メモ、好みの商材と避ける商材の名前の一部。',
    }),
    allergies: text({ en: 'Allergy records', ja: 'アレルギーの記録' }),
    all: text({ en: 'All', ja: 'すべて' }),
    withAllergies: text({ en: 'Recorded', ja: 'ある' }),
    withoutAllergies: text({ en: 'None', ja: 'ない' }),
    caption: CHART_WORDS.chart,
    narrowedCaption: text({
      en: 'Charts matching the filters',
      ja: '条件に合うカルテ',
    }),
    none: text({ en: 'No charts', ja: 'カルテはありません' }),
    noneDescription: text({
      en: 'Charts are created from the record of a customer.',
      ja: 'カルテは、お客様の台帳から作ります。',
    }),
    noneMatching: text({
      en: 'No charts match these filters',
      ja: '条件に合うカルテはありません',
    }),
    noneMatchingDescription: text({
      en: 'Change the filters and search again.',
      ja: '条件を変えて探してください。',
    }),
  },
  allergies: chartAllergies,
  ...chartForm,
}
