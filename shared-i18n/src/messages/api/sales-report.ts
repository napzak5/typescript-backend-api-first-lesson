import { text } from '../../languages/localized-text'

/** What the API says of the sales reports. */
export const salesReportMessages = {
  invalidDailySales: text({
    en: 'Invalid daily sales',
    ja: '日ごとの売上の条件が正しくありません',
  }),
  invalidSalesReport: text({
    en: 'Invalid sales report',
    ja: '売上の集計の条件が正しくありません',
  }),
  invalidSalesTrends: text({
    en: 'Invalid sales trends',
    ja: '売上の推移の条件が正しくありません',
  }),
  /** `days` is the longest period of a report. */
  withinDaysOfStartDate: (days: number) =>
    text({
      en: `Must be within ${days} days of startDate, both included`,
      ja: `startDate から、両端を含めて ${days} 日以内にしてください`,
    }),
}
