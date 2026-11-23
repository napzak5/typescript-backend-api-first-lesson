import { text } from '../../languages/localized-text'

/** What the API says of the reports of a review. */
export const reviewReportMessages = {
  invalidReviewReport: text({
    en: 'Invalid review report',
    ja: 'レビューの通報の内容が正しくありません',
  }),
  invalidReviewReportId: text({
    en: 'Invalid review report ID',
    ja: 'レビューの通報の ID が正しくありません',
  }),
  invalidReviewReportSearch: text({
    en: 'Invalid review report search',
    ja: 'レビューの通報の検索の条件が正しくありません',
  }),
  detailsForOther: text({
    en: 'Must be given when reason is other',
    ja: 'reason が other のときは、指定してください',
  }),
  aListedReviewReport: text({
    en: 'Must name a review report that is listed',
    ja: '一覧にある通報を指定してください',
  }),
}
