import { TOO_MANY_REQUESTS_MESSAGE } from '@beauty-salon-frontend/answers'
import type { FileToSave } from '@beauty-salon-frontend/io'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { adminCustomerMessages } from '@beauty-salon-shared/i18n/messages/admin'
import { match } from 'ts-pattern'
import type { DataExport, LedgerExport } from '../api/customer-export-api'

const { exports: words } = adminCustomerMessages

/*
 * What follows an export: the file that is saved and what is said of it,
 * or why there is none.
 */

/** The largest number of customers the API writes into one file */
const MOST_EXPORTED = 10_000

export type ExportSays =
  /** The file is saved, and the notification says what it holds */
  | { type: 'saved'; file: FileToSave; message: LocalizedText }
  /** No file: said beside the button that exports, which may be pressed again */
  | { type: 'said'; tone: 'warning' | 'danger'; message: LocalizedText }

/** What follows an export of the ledger. */
export const afterLedgerExport = (outcome: LedgerExport): ExportSays =>
  match(outcome)
    .returnType<ExportSays>()
    // A file that names the columns alone is of no use
    .with({ type: 'exported', customers: 0 }, () => ({
      type: 'said',
      tone: 'warning',
      message: words.ledger.noneMatch,
    }))
    .with({ type: 'exported' }, ({ file, customers }) => ({
      type: 'saved',
      file,
      message: words.ledger.exported(customers, file.name),
    }))
    .with({ type: 'tooMany' }, () => ({
      type: 'said',
      tone: 'danger',
      message: words.ledger.tooMany(MOST_EXPORTED),
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'said',
      tone: 'danger',
      message: words.ledger.forbidden,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'said',
      tone: 'danger',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'said',
      tone: 'danger',
      message: words.ledger.failed,
    }))
    .exhaustive()

export type DataExportSays =
  | ExportSays
  /** The customer left the ledger meanwhile: the page shows them as removed */
  | { type: 'gone' }

/** What follows an export of the data of a customer, named as 「山田 花子」. */
export const afterDataExport = (
  outcome: DataExport,
  name: string,
): DataExportSays =>
  match(outcome)
    .returnType<DataExportSays>()
    .with({ type: 'exported' }, ({ file }) => ({
      type: 'saved',
      file,
      message: words.data.exported(name, file.name),
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'forbidden' }, () => ({
      type: 'said',
      tone: 'danger',
      message: words.data.forbidden,
    }))
    .with({ type: 'tooManyRequests' }, () => ({
      type: 'said',
      tone: 'danger',
      message: TOO_MANY_REQUESTS_MESSAGE,
    }))
    .with({ type: 'failed' }, () => ({
      type: 'said',
      tone: 'danger',
      message: words.data.failed,
    }))
    .exhaustive()
