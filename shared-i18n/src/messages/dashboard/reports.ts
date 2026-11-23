import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'

/*
 * What the screens of the sales say in the dashboard: the sales report of
 * a period and its export, the trends of the sales, the sales of one day,
 * of every member of the staff and of every kind of service, and what a
 * screen says instead of them. The names of the members of the staff and
 * of the salon stand as they were written.
 */

const REPORT = text({ en: 'Sales report', ja: '売上レポート' })
const TRENDS = text({ en: 'Sales trends', ja: '売上の推移' })
const DAILY = text({ en: 'Daily sales', ja: '1 日の売上' })
const BY_STAFF = text({ en: 'Sales by staff', ja: 'スタッフ別の売上' })
const BY_CATEGORY = text({ en: 'Sales by category', ja: '区分別の売上' })

const SALES_INCLUDE = text({
  en: 'Sales include tax, less discounts.',
  ja: '売上は、消費税を含み、値引きを引いた額です。',
})
const NET_SALES = text({
  en: 'Net sales are the sales less refunds.',
  ja: '純売上は、売上から返金を引いた額です。',
})
const CATEGORY_NOTE = text({
  en: 'Service sales are counted by the category each service is in now. Products are not included.',
  ja: 'サービスの売上を、サービスがいま属している区分で数えます。商品の売上は入りません。',
})
const TREND_PARTS = text({
  en: 'The first and the last week or month count only the days within the period.',
  ja: '最初と最後の週や月は、期間の中の日だけを数えます。',
})

/** Sentences said one after the other: English puts a space between them, Japanese none */
const followed = (...sentences: LocalizedText[]): LocalizedText =>
  text({
    en: sentences.map(({ en }) => en).join(' '),
    ja: sentences.map(({ ja }) => ja).join(''),
  })

export const dashboardReportMessages = {
  /** The title of each screen, which the links of the header name too */
  titles: {
    report: REPORT,
    trends: TRENDS,
    daily: DAILY,
    staff: BY_STAFF,
    categories: BY_CATEGORY,
  },
  /** What is said of the days a report counts over */
  period: text({
    en: 'Sales are counted by the day of the checkout (the date at the salon). A period is up to 366 days.',
    ja: '会計した日（サロンの日付）で数えます。期間は 366 日までです。',
  }),
  counting: text({ en: 'Counting the sales', ja: '売上を集計しています' }),
  noSales: text({
    en: 'No sales in this period',
    ja: 'この期間の売上はありません',
  }),
  changePeriod: text({
    en: 'Change the period and count again.',
    ja: '期間を変えて集計してください。',
  }),
  /** How many sales, payments or services: 「12 件」 */
  count: (count: number) =>
    text({ en: numberOf(count).en, ja: `${numberOf(count).ja} 件` }),
  /** The headers of the columns that more than one table has */
  columns: {
    rank: text({ en: 'Rank', ja: '順位' }),
    staff: text({ en: 'Staff', ja: 'スタッフ' }),
    sales: text({ en: 'Sales', ja: '売上' }),
    services: text({ en: 'Services', ja: '施術の数' }),
    averageService: text({
      en: 'Average per service',
      ja: '施術の平均単価',
    }),
    transactions: text({ en: 'Checkouts', ja: '会計の件数' }),
    averageTransaction: text({
      en: 'Average per checkout',
      ja: '客単価',
    }),
    share: text({ en: 'Share', ja: '割合' }),
  },
  /** The sales report of a period */
  report: {
    /** The period counted, said above the report */
    of: (period: LocalizedText) =>
      text({ en: `Sales for ${period.en}`, ja: `${period.ja}の売上` }),
    export: text({ en: 'Export as CSV', ja: 'CSV に出力する' }),
    /** What the notification says of the file that was saved */
    exported: (period: LocalizedText, file: string) =>
      text({
        en: `The sales for ${period.en} were exported to ${file}.`,
        ja: `${period.ja}の売上を、${file} に出力しました。`,
      }),
    exportGone: text({
      en: 'This salon was removed, so its sales cannot be exported.',
      ja: 'このサロンは削除されたため、売上を出力できません。',
    }),
    exportForbidden: text({
      en: 'This account cannot export the sales of this salon. Only the owner and the managers of the salon and the administrators can.',
      ja: 'このアカウントでは、このサロンの売上を出力できません。売上を出力できるのは、そのサロンのオーナーとマネージャーと、管理者です。',
    }),
    exportFailed: text({
      en: 'The sales could not be exported. Check your connection and try again.',
      ja: '売上を出力できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
    totals: {
      title: text({ en: 'Totals for the period', ja: '期間の合計' }),
      refunds: text({ en: 'Refunds', ja: '返金' }),
      net: text({ en: 'Net sales', ja: '純売上' }),
      tax: text({ en: 'Tax', ja: '消費税' }),
      discounts: text({ en: 'Discounts', ja: '値引き' }),
      note: followed(
        SALES_INCLUDE,
        NET_SALES,
        text({
          en: 'A refund is counted on the day of its checkout, not on the day it was made.',
          ja: '返金は、返金した日ではなく、もとの会計の日で数えます。',
        }),
      ),
    },
    payments: {
      title: text({ en: 'By payment method', ja: '支払い方法別' }),
      caption: text({
        en: 'Received by payment method',
        ja: '支払い方法別の入金',
      }),
      method: text({ en: 'Payment method', ja: '支払い方法' }),
      received: text({ en: 'Received', ja: '入金' }),
      payments: text({ en: 'Payments', ja: '支払いの件数' }),
      none: text({
        en: 'No payments received',
        ja: '受け取った支払いはありません',
      }),
      note: text({
        en: 'Received is what was paid, less refunds. What is not paid yet is not included, so the sum may differ from the sales.',
        ja: '入金は、受け取った支払いから返金を引いた額です。まだ受け取っていない額は入らないので、合わせても売上と同じにならないことがあります。',
      }),
    },
    categories: {
      title: text({ en: 'By menu category', ja: 'メニューの区分別' }),
      caption: text({
        en: 'Sales by menu category',
        ja: 'メニューの区分別の売上',
      }),
      category: text({ en: 'Menu category', ja: 'メニューの区分' }),
      all: text({
        en: 'See the sales by category',
        ja: '区分別の売上へ',
      }),
    },
    topStaff: {
      title: text({ en: 'Top 5 staff', ja: 'スタッフ別の上位 5 人' }),
      caption: text({
        en: 'Top 5 staff by sales',
        ja: 'スタッフ別の売上の上位 5 人',
      }),
      all: text({
        en: 'See the sales of all staff',
        ja: 'すべてのスタッフの売上へ',
      }),
    },
  },
  /** The sales of every member of the staff */
  staff: {
    of: (period: LocalizedText) =>
      text({
        en: `Sales by staff for ${period.en}`,
        ja: `${period.ja}のスタッフ別の売上`,
      }),
    none: text({
      en: 'No sales handled by the staff in this period',
      ja: 'この期間に、スタッフが担当した売上はありません',
    }),
    title: text({
      en: 'Sales per staff member',
      ja: 'スタッフごとの売上',
    }),
    noneInTable: text({
      en: 'No sales handled by the staff',
      ja: '担当したスタッフのいる売上はありません',
    }),
    note: text({
      en: 'Sales are credited to the staff member in charge of each line (or of the checkout, when the line names none), products included. Services and the average per service count service lines only. Names are the current display names.',
      ja: '明細を担当したスタッフ（明細になければ、会計の担当）の売上で、商品の売上も入ります。施術の数と施術の平均単価は、施術の明細だけで数えます。名前は、いまの表示名です。',
    }),
  },
  /** The sales of every kind of service */
  categories: {
    of: (period: LocalizedText) =>
      text({
        en: `Sales by menu category for ${period.en}`,
        ja: `${period.ja}のメニューの区分別の売上`,
      }),
    none: text({
      en: 'No menu sales in this period',
      ja: 'この期間のメニューの売上はありません',
    }),
    title: text({
      en: 'Sales per menu category',
      ja: 'メニューの区分ごとの売上',
    }),
    category: text({ en: 'Category', ja: '区分' }),
    perService: text({ en: 'Per service', ja: '1 件あたり' }),
    noneInTable: text({
      en: 'No menu sales',
      ja: 'メニューの売上はありません',
    }),
    note: CATEGORY_NOTE,
    /** The note of the screen, which has the sales of one service too */
    noteWithPerService: followed(
      CATEGORY_NOTE,
      text({
        en: 'Per service is the sales divided by the number of services (rounded down to a whole amount).',
        ja: '1 件あたりは、売上を施術の数で割った額です（1 円未満は切り捨て）。',
      }),
    ),
  },
  /** The trends of the sales, part by part */
  trends: {
    of: (period: LocalizedText) =>
      text({
        en: `Sales trends for ${period.en}`,
        ja: `${period.ja}の売上の推移`,
      }),
    unit: text({ en: 'Interval', ja: '区切り' }),
    units: {
      daily: text({ en: 'Day', ja: '日' }),
      weekly: text({ en: 'Week', ja: '週' }),
      monthly: text({ en: 'Month', ja: '月' }),
    },
    unitHelp: text({
      en: 'A week runs from Monday to Sunday.',
      ja: '週は、月曜日から日曜日までです。',
    }),
    /** The week from a Monday: 「2026年11月16日（月）からの週」 */
    weekFrom: (monday: LocalizedText) =>
      text({ en: `Week from ${monday.en}`, ja: `${monday.ja}からの週` }),
    title: text({ en: 'Sales by interval', ja: '区切りごとの売上' }),
    caption: text({
      en: 'Sales, checkouts and average per checkout by interval',
      ja: '区切りごとの売上、会計の件数、客単価',
    }),
    none: text({ en: 'No intervals', ja: '区切りはありません' }),
    note: followed(
      SALES_INCLUDE,
      text({
        en: 'The average per checkout is the sales divided by the number of checkouts (rounded down to a whole amount).',
        ja: '客単価は、売上を会計の件数で割った額です（1 円未満は切り捨て）。',
      }),
      TREND_PARTS,
    ),
    /** What a column of the chart says on a pointer over it: the part and its sales */
    tip: (part: LocalizedText, sales: LocalizedText) =>
      text({ en: `${part.en}: ${sales.en}`, ja: `${part.ja} ${sales.ja}` }),
  },
  /** The sales of one day */
  daily: {
    choice: text({ en: 'Day to view', ja: '売上を見る日' }),
    day: text({ en: 'Date', ja: '日付' }),
    dayDescription: text({
      en: 'Sales are counted by the day of the checkout (the date at the salon).',
      ja: '会計した日（サロンの日付）で数えます。',
    }),
    otherDays: text({ en: 'Other days', ja: 'ほかの日' }),
    of: (day: LocalizedText) =>
      text({ en: `Sales on ${day.en}`, ja: `${day.ja}の売上` }),
    note: followed(
      SALES_INCLUDE,
      text({
        en: 'Refunds are the amounts returned from the checkouts of this day; they are not counted on the day of the refund.',
        ja: '返金は、この日の会計から返した額で、返金した日には数えません。',
      }),
      NET_SALES,
    ),
  },
  /** What a screen says instead of the sales: they are another salon's, or the salon was removed */
  refusal: {
    /** That the salon was removed since it was read, and what of it cannot be seen */
    removed: (what: LocalizedText) =>
      text({
        en: `This salon was removed, so you cannot see its ${what.en}.`,
        ja: `このサロンは削除されたため、${what.ja}を見られません。`,
      }),
  },
  /** The names that the sentences of other catalogues put in theirs */
  names: {
    /** What was not read */
    read: {
      report: text({ en: 'the sales report', ja: '売上レポート' }),
      trends: text({ en: 'the sales trends', ja: '売上の推移' }),
      sales: text({ en: 'the sales', ja: '売上' }),
      staff: text({ en: 'the sales by staff', ja: 'スタッフ別の売上' }),
      categories: text({
        en: 'the sales by category',
        ja: '区分別の売上',
      }),
    },
    /** What is not theirs to see, as it stands after 「the」 */
    seen: {
      report: text({ en: 'sales report', ja: '売上レポート' }),
      trends: text({ en: 'sales trends', ja: '売上の推移' }),
      sales: text({ en: 'sales', ja: '売上' }),
      staff: text({ en: 'sales by staff', ja: 'スタッフ別の売上' }),
      categories: text({ en: 'sales by category', ja: '区分別の売上' }),
    },
    /** Who may see the sales of a salon */
    who: text({
      en: 'the owner and the managers of the salon and the administrators',
      ja: 'そのサロンのオーナーとマネージャーと、管理者',
    }),
  },
}
