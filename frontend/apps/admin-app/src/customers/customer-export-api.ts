import {
  customerCrudExport,
  customerCrudExportData,
} from '@beauty-salon-frontend/api-client'
import { type FileToSave, fileNameOf } from '@beauty-salon-frontend/io'
import {
  FAILED,
  type Forbidden,
  NOT_FOUND,
  type NotFound,
  outsideTheContract,
  type Unread,
  unreadOf,
} from '@beauty-salon-frontend/salon-screens'
import { match, P } from 'ts-pattern'
import { rowsOfCsv } from './customer-file'
import {
  type CustomerConditions,
  customerListParamsOf,
} from './customer-ledger'

/*
 * The files the API makes of the ledger: the customers who meet the
 * conditions of the ledger, and everything held of one customer.
 */

/** No answer, or one that says nothing a person could act on */
const UNANSWERED = P.union(
  null,
  { status: 401 },
  { status: 429 },
  { status: 500 },
)

const FORBIDDEN: Forbidden = { type: 'forbidden' }

/** What a spreadsheet tells a CSV file of UTF-8 by: the mark of its byte order */
const BYTE_ORDER_MARK = '﻿'

/**
 * The file the API answered with, under the name it gave; `undefined` when
 * the answer names none.
 */
const fileOf = (headers: Headers, content: string): FileToSave | undefined => {
  const name = fileNameOf(headers)

  return name === undefined
    ? undefined
    : { name, type: headers.get('content-type') ?? '', content }
}

export type LedgerExport =
  | {
      type: 'exported'
      file: FileToSave
      /** The customers in the file: its rows but the one that names the columns */
      customers: number
    }
  /** More customers meet the conditions than the API writes at once */
  | { type: 'tooMany' }
  | Forbidden
  | Unread

/**
 * The customers who meet the conditions of the ledger, as the CSV file the
 * API writes (`GET /customers/export`), and how many they are. The fetch
 * function reads the text without the mark of its byte order: the file
 * gets it back, so that a spreadsheet reads it as UTF-8.
 */
export const exportLedger = async (
  conditions: CustomerConditions,
  timezone: string,
): Promise<LedgerExport> => {
  const answer = await customerCrudExport(
    customerListParamsOf(conditions, timezone),
  ).catch(() => null)

  return (
    match(answer)
      .returnType<LedgerExport>()
      .with({ status: 200 }, ({ data, headers }) => {
        const read = rowsOfCsv(data)
        const file = fileOf(headers, `${BYTE_ORDER_MARK}${data}`)

        return read.type === 'rows' && file !== undefined
          ? { type: 'exported', file, customers: read.rows.length - 1 }
          : FAILED
      })
      .with({ status: 409 }, () => ({ type: 'tooMany' }))
      .with({ status: 403 }, () => FORBIDDEN)
      // The conditions are those the ledger is read by, which the API takes
      .with({ status: 400 }, () => FAILED)
      .with(UNANSWERED, unreadOf)
      .exhaustive(outsideTheContract)
  )
}

export type DataExport =
  | { type: 'exported'; file: FileToSave }
  /** The customer left the ledger, or there was none of the ID */
  | NotFound
  | Forbidden
  | Unread

/**
 * Everything held of the customer, as the JSON file the API writes
 * (`GET /customers/{id}/export`). The fetch function read the JSON: the
 * file is written again as the API wrote it, indented by two spaces.
 */
export const exportCustomerData = async (
  customerId: string,
): Promise<DataExport> => {
  const answer = await customerCrudExportData(customerId).catch(() => null)

  return (
    match(answer)
      .returnType<DataExport>()
      .with({ status: 200 }, ({ data, headers }) => {
        const file = fileOf(headers, JSON.stringify(data, null, 2))

        return file === undefined ? FAILED : { type: 'exported', file }
      })
      .with({ status: 404 }, () => NOT_FOUND)
      .with({ status: 403 }, () => FORBIDDEN)
      // The ID is that of a customer the page shows
      .with({ status: 400 }, () => FAILED)
      .with(UNANSWERED, unreadOf)
      .exhaustive(outsideTheContract)
  )
}
