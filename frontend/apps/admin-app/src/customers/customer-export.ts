import type { FileToSave } from '@beauty-salon-frontend/io'
import { unreadMessageOf } from '@beauty-salon-frontend/salon-screens'
import { match } from 'ts-pattern'
import type { DataExport, LedgerExport } from './customer-export-api'

/*
 * What follows an export: the file that is saved and what is said of it,
 * or why there is none.
 */

/** The largest number of customers the API writes into one file */
const MOST_EXPORTED = 10_000

/** What a member of the staff is told where the requests of a customer would be answered */
export const ANSWERED_BY_OTHERS =
  'ご本人からのデータの開示と消去の請求には、オーナーとマネージャーが応えます。'

export type ExportSays =
  /** The file is saved, and the notification says what it holds */
  | { type: 'saved'; file: FileToSave; message: string }
  /** No file: said beside the button that exports, which may be pressed again */
  | { type: 'said'; tone: 'warning' | 'danger'; message: string }

/** What follows an export of the ledger. */
export const afterLedgerExport = (outcome: LedgerExport): ExportSays =>
  match(outcome)
    .returnType<ExportSays>()
    // A file that names the columns alone is of no use
    .with({ type: 'exported', customers: 0 }, () => ({
      type: 'said',
      tone: 'warning',
      message: '条件に合うお客様がいないため、出力しませんでした。',
    }))
    .with({ type: 'exported' }, ({ file, customers }) => ({
      type: 'saved',
      file,
      message: `${customers} 人のお客様を、${file.name} に出力しました。`,
    }))
    .with({ type: 'tooMany' }, () => ({
      type: 'said',
      tone: 'danger',
      message: `条件に合うお客様が ${MOST_EXPORTED.toLocaleString('ja-JP')} 人を超えるため、出力できません。条件を絞ってから、もう一度出力してください。`,
    }))
    .with({ type: 'forbidden' }, () => ({
      type: 'said',
      tone: 'danger',
      message:
        'このアカウントでは、顧客台帳を出力できません。台帳の出力は、オーナーとマネージャーができます。',
    }))
    .with({ type: 'tooManyRequests' }, (reason) => ({
      type: 'said',
      tone: 'danger',
      message: unreadMessageOf('顧客台帳', reason),
    }))
    .with({ type: 'failed' }, () => ({
      type: 'said',
      tone: 'danger',
      message:
        '顧客台帳を出力できませんでした。通信の状態を確かめて、もう一度お試しください。',
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
      message: `${name} 様のデータを、${file.name} に出力しました。`,
    }))
    .with({ type: 'notFound' }, () => ({ type: 'gone' }))
    .with({ type: 'forbidden' }, () => ({
      type: 'said',
      tone: 'danger',
      message: `このアカウントでは、お客様のデータを出力できません。${ANSWERED_BY_OTHERS}`,
    }))
    .with({ type: 'tooManyRequests' }, (reason) => ({
      type: 'said',
      tone: 'danger',
      message: unreadMessageOf('お客様のデータ', reason),
    }))
    .with({ type: 'failed' }, () => ({
      type: 'said',
      tone: 'danger',
      message:
        'お客様のデータを出力できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }))
    .exhaustive()
