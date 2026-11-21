import type { FileToSave } from '@beauty-salon-frontend/io'
import {
  type Period,
  periodNameOf,
  unreadMessageOf,
} from '@beauty-salon-frontend/salon-screens'
import { match } from 'ts-pattern'
import type { SalesReportExport } from './sales-report-api'

/*
 * How the sales report says what it counts, and what follows its export:
 * the file that is saved and what is said of it, or why there is none.
 */

/** What is said of the days a report counts over */
export const REPORT_PERIOD =
  '会計した日（サロンの日付）で数えます。期間は 366 日までです。'

/** How many sales, payments or services: 「12 件」. */
export const countNameOf = (count: number): string =>
  `${count.toLocaleString('ja-JP')} 件`

const PERCENT = new Intl.NumberFormat('ja-JP', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** A share of the whole, as the API rounds it: 「42.5%」. */
export const percentNameOf = (percentage: number): string =>
  `${PERCENT.format(percentage)}%`

/** A place among the members of the staff: 「1 位」. */
export const rankNameOf = (rank: number): string => `${rank} 位`

/** How the sales of a member of the staff are counted, said under them */
export const STAFF_SALES_NOTE =
  '明細を担当したスタッフ（明細になければ、会計の担当）の売上で、商品の売上も入ります。施術の数と施術の平均単価は、施術の明細だけで数えます。名前は、いまの表示名です。'

/** How the sales of a kind of service are counted, said under them */
export const CATEGORY_SALES_NOTE =
  'サービスの売上を、サービスがいま属している区分で数えます。商品の売上は入りません。'

export type ExportSays =
  /** The file is saved, and the notification says what it holds */
  | { type: 'saved'; file: FileToSave; message: string }
  /** No file: said beside the button that exports, which may be pressed again */
  | { type: 'refused'; message: string }

/** What follows an export of the sales of a period. */
export const afterReportExport = (
  outcome: SalesReportExport,
  period: Period,
): ExportSays =>
  match(outcome)
    .returnType<ExportSays>()
    .with({ type: 'exported' }, ({ file }) => ({
      type: 'saved',
      file,
      message: `${periodNameOf(period)}の売上を、${file.name} に出力しました。`,
    }))
    .with({ type: 'notFound' }, () => ({
      type: 'refused',
      message: 'このサロンは削除されたため、売上を出力できません。',
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message:
        'このアカウントでは、このサロンの売上を出力できません。売上を出力できるのは、そのサロンのオーナーとマネージャーと、管理者です。',
    }))
    .with({ type: 'tooManyRequests' }, (reason) => ({
      type: 'refused',
      message: unreadMessageOf('売上', reason),
    }))
    .with({ type: 'failed' }, () => ({
      type: 'refused',
      message:
        '売上を出力できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()
