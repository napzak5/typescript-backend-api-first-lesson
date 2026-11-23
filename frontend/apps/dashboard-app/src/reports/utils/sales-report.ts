import { unreadMessageOf } from '@beauty-salon-frontend/answers'
import type { FileToSave } from '@beauty-salon-frontend/io'
import { type Period, periodNameOf } from '@beauty-salon-frontend/salon-screens'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import * as formats from '@beauty-salon-shared/i18n/formats'
import { dashboardReportMessages } from '@beauty-salon-shared/i18n/messages/dashboard'
import { match } from 'ts-pattern'
import type { SalesReportExport } from '../api/sales-report-api'

/*
 * How the sales report writes a share, and what follows its export: the
 * file that is saved and what is said of it, or why there is none.
 */

const { names, report: words } = dashboardReportMessages

/** A share of the whole, as the API rounds it: 「42.5%」. */
export const percentNameOf = (percentage: number): LocalizedText =>
  formats.percentOf(percentage, { most: 1, least: 1 })

export type ExportSays =
  /** The file is saved, and the notification says what it holds */
  | { type: 'saved'; file: FileToSave; message: LocalizedText }
  /** No file: said beside the button that exports, which may be pressed again */
  | { type: 'refused'; message: LocalizedText }

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
      message: words.exported(periodNameOf(period), file.name),
    }))
    .with({ type: 'notFound' }, () => ({
      type: 'refused',
      message: words.exportGone,
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'refused',
      message: words.exportForbidden,
    }))
    .with({ type: 'tooManyRequests' }, (reason) => ({
      type: 'refused',
      message: unreadMessageOf(names.read.sales, reason),
    }))
    .with({ type: 'failed' }, () => ({
      type: 'refused',
      message: words.exportFailed,
    }))
    .exhaustive()
