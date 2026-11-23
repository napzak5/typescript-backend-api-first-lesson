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
  aMedicalChartOfList: text({
    en: 'Must name a medical chart of the list',
    ja: 'この一覧のカルテを指定してください',
  }),
  customerHasChart: text({
    en: 'The customer has a medical chart already; a customer has one',
    ja: 'この顧客には、すでにカルテがあります。カルテは、顧客に 1 つです',
  }),
}
