import { text } from '../../languages/localized-text'

/** What the API says of the medical charts. */
export const medicalChartMessages = {
  invalidMedicalChart: text({
    en: 'Invalid medical chart',
    ja: 'カルテの内容が正しくありません',
  }),
  invalidMedicalChartId: text({
    en: 'Invalid medical chart ID',
    ja: 'カルテの ID が正しくありません',
  }),
  invalidMedicalChartSearch: text({
    en: 'Invalid medical chart search',
    ja: 'カルテの検索の条件が正しくありません',
  }),
}
