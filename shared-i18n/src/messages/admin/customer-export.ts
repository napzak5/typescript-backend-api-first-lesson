import { numberOf } from '../../formats/numbers'
import { text } from '../../languages/localized-text'
import { followed } from '../written'
import { ANSWERED_BY_OTHERS, customersOf } from './customer-words'

/*
 * The files the ledger exports: the ledger as CSV, and everything held of
 * one customer as JSON, which the salon hands to the customer who asks for
 * it. The names of the files and of the customers stand as they are.
 */

export const customerExportMessages = {
  /** What follows an export of the ledger */
  ledger: {
    noneMatch: text({
      en: 'No customers match the filters, so nothing was exported.',
      ja: '条件に合うお客様がいないため、出力しませんでした。',
    }),
    exported: (count: number, file: string) =>
      text({
        en: `Exported ${customersOf(count).en} to ${file}.`,
        ja: `${customersOf(count).ja}のお客様を、${file} に出力しました。`,
      }),
    tooMany: (most: number) =>
      text({
        en: `More than ${numberOf(most).en} customers match the filters, so they cannot be exported. Narrow the filters, then export again.`,
        ja: `条件に合うお客様が ${customersOf(most).ja}を超えるため、出力できません。条件を絞ってから、もう一度出力してください。`,
      }),
    forbidden: text({
      en: 'This account cannot export the customer ledger. Owners and managers export the ledger.',
      ja: 'このアカウントでは、顧客台帳を出力できません。台帳の出力は、オーナーとマネージャーができます。',
    }),
    failed: text({
      en: 'The customer ledger could not be exported. Check your connection and try again.',
      ja: '顧客台帳を出力できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** The part of the page of a customer that answers what the customer asks of their data */
  requests: {
    title: text({ en: 'Requests from the customer', ja: 'ご本人からの請求' }),
    disclosure: text({ en: 'Disclosure of the data', ja: 'データの開示' }),
    disclosureAbout: text({
      en: 'When a customer asks to see the personal data held of them, make sure it is the customer, then export the data and hand it to them. The record, the account, the preferences, the chart and the allergies, the bookings, the sales, the points, the reviews, the treatment records and the versions of the record go into one JSON file.',
      ja: 'お客様ご本人から、保有している個人データの開示を求められたときは、ご本人であることを確かめてから、データを出力してお渡しします。台帳、アカウント、好み設定、カルテとアレルギー、予約、売上、ポイント、レビュー、施術記録、台帳の版を、1 つの JSON ファイルにします。',
    }),
    exportData: text({ en: 'Export the data', ja: 'データを出力する' }),
    answeredByOthers: ANSWERED_BY_OTHERS,
  },
  /** What follows an export of the data of a customer */
  data: {
    exported: (name: string, file: string) =>
      text({
        en: `Exported the data of ${name} to ${file}.`,
        ja: `${name} 様のデータを、${file} に出力しました。`,
      }),
    forbidden: followed(
      text({
        en: 'This account cannot export the data of customers.',
        ja: 'このアカウントでは、お客様のデータを出力できません。',
      }),
      ANSWERED_BY_OTHERS,
    ),
    failed: text({
      en: 'The data of the customer could not be exported. Check your connection and try again.',
      ja: 'お客様のデータを出力できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
}
