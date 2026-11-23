import type { FileToSave } from '@beauty-salon-frontend/io'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import type { DataExport, LedgerExport } from '../api/customer-export-api'
import { afterDataExport, afterLedgerExport } from './customer-export'

const CSV: FileToSave = {
  name: 'customers-2026-11-20.csv',
  type: 'text/csv; charset=utf-8',
  content: '﻿id\r\n1\r\n',
}

const JSON_FILE: FileToSave = {
  name: 'customer-0b1c2d3e.json',
  type: 'application/json; charset=utf-8',
  content: '{}',
}

const TOO_MANY_REQUESTS = {
  en: 'There are too many requests. Wait a while and try again.',
  ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
}

describe('afterLedgerExport', () => {
  it('should save the file and say how many customers it holds', () => {
    // Act
    const says = afterLedgerExport({
      type: 'exported',
      file: CSV,
      customers: 3,
    })

    // Assert
    expect(says).toEqual({
      type: 'saved',
      file: CSV,
      message: {
        en: 'Exported 3 customers to customers-2026-11-20.csv.',
        ja: '3 人のお客様を、customers-2026-11-20.csv に出力しました。',
      },
    })
  })

  it('should save no file that names the columns alone', () => {
    // Act
    const says = afterLedgerExport({
      type: 'exported',
      file: CSV,
      customers: 0,
    })

    // Assert
    expect(says).toEqual({
      type: 'said',
      tone: 'warning',
      message: {
        en: 'No customers match the filters, so nothing was exported.',
        ja: '条件に合うお客様がいないため、出力しませんでした。',
      },
    })
  })

  it.each<[LedgerExport['type'], LedgerExport, LocalizedText]>([
    [
      'tooMany',
      { type: 'tooMany' },
      {
        en: 'More than 10,000 customers match the filters, so they cannot be exported. Narrow the filters, then export again.',
        ja: '条件に合うお客様が 10,000 人を超えるため、出力できません。条件を絞ってから、もう一度出力してください。',
      },
    ],
    [
      'forbidden',
      { type: 'forbidden' },
      {
        en: 'This account cannot export the customer ledger. Owners and managers export the ledger.',
        ja: 'このアカウントでは、顧客台帳を出力できません。台帳の出力は、オーナーとマネージャーができます。',
      },
    ],
    ['tooManyRequests', { type: 'tooManyRequests' }, TOO_MANY_REQUESTS],
    [
      'failed',
      { type: 'failed' },
      {
        en: 'The customer ledger could not be exported. Check your connection and try again.',
        ja: '顧客台帳を出力できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say why %s saved no file', (_, outcome, message) => {
    // Act
    const says = afterLedgerExport(outcome)

    // Assert
    expect(says).toEqual({ type: 'said', tone: 'danger', message })
  })
})

describe('afterDataExport', () => {
  it('should save the file and say whose data it holds', () => {
    // Act
    const says = afterDataExport(
      { type: 'exported', file: JSON_FILE },
      '山田 花子',
    )

    // Assert
    expect(says).toEqual({
      type: 'saved',
      file: JSON_FILE,
      message: {
        en: 'Exported the data of 山田 花子 to customer-0b1c2d3e.json.',
        ja: '山田 花子 様のデータを、customer-0b1c2d3e.json に出力しました。',
      },
    })
  })

  it('should show a customer who left the ledger meanwhile as removed', () => {
    // Act
    const says = afterDataExport({ type: 'notFound' }, '山田 花子')

    // Assert
    expect(says).toEqual({ type: 'gone' })
  })

  it.each<[DataExport['type'], DataExport, LocalizedText]>([
    [
      'forbidden',
      { type: 'forbidden' },
      {
        en: 'This account cannot export the data of customers. Owners and managers answer the requests of customers to see or erase their data.',
        ja: 'このアカウントでは、お客様のデータを出力できません。ご本人からのデータの開示と消去の請求には、オーナーとマネージャーが応えます。',
      },
    ],
    ['tooManyRequests', { type: 'tooManyRequests' }, TOO_MANY_REQUESTS],
    [
      'failed',
      { type: 'failed' },
      {
        en: 'The data of the customer could not be exported. Check your connection and try again.',
        ja: 'お客様のデータを出力できませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say why %s saved no file', (_, outcome, message) => {
    // Act
    const says = afterDataExport(outcome, '山田 花子')

    // Assert
    expect(says).toEqual({ type: 'said', tone: 'danger', message })
  })
})
