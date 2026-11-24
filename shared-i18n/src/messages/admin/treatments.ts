import { type LocalizedText, text } from '../../languages/localized-text'
import { treatmentFormMessages } from './treatment-form'
import { treatmentPhotoMessages } from './treatment-photos'
import { treatmentRecordMessages } from './treatment-records'
import { treatmentStatisticsMessages } from './treatment-statistics'
import {
  rated,
  recordsOf,
  SATISFACTIONS,
  TREATMENT_WORDS,
} from './treatment-words'

/*
 * What the screens of the treatment records say in the admin application:
 * the list of the records of a salon, a record with its photos and its
 * removal, the form that writes a record of a booking and changes one, the
 * form that adds photos, the statistics of a period, and the part of the
 * page of a booking that leads to its record; the frame around a screen of
 * a record, and how a record names its customer. The names of the
 * customers, the staff, the services and the products, the techniques, the
 * notes and the addresses of the photos stand as they were written.
 *
 * The other parts of the treatment records are files of their own beside
 * this one, collected here under the same name: the list and a record, the
 * form, the photos and the statistics.
 */

export const adminTreatmentMessages = {
  titles: {
    list: TREATMENT_WORDS.records,
    record: text({
      en: 'Treatment record details',
      ja: '施術記録の内容',
    }),
    entry: TREATMENT_WORDS.entry,
    change: TREATMENT_WORDS.change,
    photos: text({ en: 'Add treatment photos', ja: '施術写真を足す' }),
    statistics: TREATMENT_WORDS.statistics,
  },
  /** What a screen could not read, and a customer who left the ledger, as a sentence names them */
  names: {
    record: text({ en: 'the treatment record', ja: '施術記録' }),
    records: text({ en: 'the treatment records', ja: '施術記録' }),
    customerAndProducts: text({
      en: 'the customer and the products',
      ja: 'お客様と商品',
    }),
    statistics: text({
      en: 'the treatment statistics',
      ja: '施術の統計',
    }),
    removedCustomer: text({
      en: 'a customer removed from the ledger',
      ja: '台帳から削除されたお客様',
    }),
  },
  /** A customer who left the ledger, as a cell and a term name them */
  removedCustomer: text({
    en: 'Removed from the ledger',
    ja: '台帳から削除されたお客様',
  }),
  /** The frame around a screen of a record */
  frame: {
    loading: TREATMENT_WORDS.loading,
    notFound: text({
      en: 'Treatment record not found',
      ja: '施術記録が見つかりません',
    }),
    notFoundDescription: text({
      en: 'Check that the address is right. A removed treatment record cannot be shown.',
      ja: 'アドレスが正しいか、お確かめください。削除された施術記録は、表示できません。',
    }),
    toList: TREATMENT_WORDS.toList,
    /** The customer of a record, as a screen names them: 「お客様：山田 花子 様」 */
    customerOf: (customer: LocalizedText) =>
      text({
        en: `Customer: ${customer.en}`,
        ja: `お客様：${customer.ja}`,
      }),
    /** The record a screen writes, by its customer, as a sentence names them, and the number of its booking */
    recordOf: (customer: LocalizedText, bookingNumber: string) =>
      text({
        en: `Treatment record of ${customer.en} (booking ${bookingNumber})`,
        ja: `${customer.ja}の施術記録（予約番号 ${bookingNumber}）`,
      }),
  },
  /** The way from the list to the statistics */
  toStatistics: TREATMENT_WORDS.statistics,
  satisfactions: SATISFACTIONS,
  /** A satisfaction by its value and its name: 「5（とても満足）」 */
  rated,
  /** How many records were counted: 「12 件」 */
  recordsOf,
  ...treatmentRecordMessages,
  form: treatmentFormMessages,
  photos: treatmentPhotoMessages,
  statistics: treatmentStatisticsMessages,
}
