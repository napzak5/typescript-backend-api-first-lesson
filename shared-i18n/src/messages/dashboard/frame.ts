import { text } from '../../languages/localized-text'
import { salonScreenMessages } from '../ui/salon-screens'
import { dashboardReportMessages } from './reports'

const { titles } = dashboardReportMessages

/**
 * What the frame of the dashboard says: the links of the header, which
 * name the screens by their titles, and the start, where an administrator
 * chooses a salon.
 */
export const dashboardFrameMessages = {
  navigation: {
    chooseSalon: salonScreenMessages.salonChoice.title,
    report: titles.report,
    trends: titles.trends,
    daily: titles.daily,
    staff: titles.staff,
    categories: titles.categories,
  },
  /** What the start says to an administrator, above the salons */
  choice: text({
    en: 'Choose the salon whose sales report to open.',
    ja: '売上レポートを開くサロンを選びます。',
  }),
}
