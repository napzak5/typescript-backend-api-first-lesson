import { type LocalizedText, text } from '../../languages/localized-text'
import { followed, listed } from '../written'
import { TREATMENT_WORDS } from './treatment-words'

/*
 * What the list of the treatment records says, with its filter and its
 * table; what a record says, with its removal; and the part of the page of
 * a booking that leads to its record.
 */

export const treatmentRecordMessages = {
  /** The records of a salon, as the list finds them */
  list: {
    loading: text({
      en: 'Loading the treatment records',
      ja: '施術記録を読み込んでいます',
    }),
    none: TREATMENT_WORDS.none,
    noneDescription: text({
      en: 'Treatment records are written from the screen of a booking whose treatment started.',
      ja: '施術記録は、施術を始めた予約の画面から書きます。',
    }),
    noneMatching: text({
      en: 'No treatment records match the conditions',
      ja: '条件に合う施術記録はありません',
    }),
    noneMatchingDescription: text({
      en: 'Change the conditions and search again.',
      ja: '条件を変えて探してください。',
    }),
    /** What the table lists */
    records: TREATMENT_WORDS.records,
    matching: text({
      en: 'Treatment records that match the conditions',
      ja: '条件に合う施術記録',
    }),
  },
  /** Which records the list shows */
  filter: {
    label: text({
      en: 'Narrow the treatment records',
      ja: '施術記録を絞り込む',
    }),
    staff: TREATMENT_WORDS.staff,
    all: text({ en: 'All', ja: 'すべて' }),
    from: text({ en: 'Written on (from)', ja: '書いた日（から）' }),
    to: text({ en: 'Written on (to)', ja: '書いた日（まで）' }),
    /** The customer of the conditions, while their name is not known */
    thisCustomer: text({ en: 'This customer', ja: 'このお客様' }),
    allCustomers: text({
      en: 'Show all customers',
      ja: 'すべてのお客様にする',
    }),
  },
  /** The columns of the table of the records */
  table: {
    writtenAt: TREATMENT_WORDS.writtenAt,
    customer: TREATMENT_WORDS.customer,
    staff: TREATMENT_WORDS.staff,
    services: text({ en: 'Services', ja: 'サービス' }),
    processingTime: TREATMENT_WORDS.processingTime,
    /** The services of a record, by name: 「カット、カラー」 */
    servicesOf: (names: readonly string[]) => listed(names),
    satisfaction: text({ en: 'Satisfaction', ja: '満足度' }),
    notAnswered: TREATMENT_WORDS.notAnswered,
    none: TREATMENT_WORDS.none,
  },
  /** What a record holds, a part each */
  record: {
    treatment: TREATMENT_WORDS.treatment,
    customer: TREATMENT_WORDS.customer,
    booking: TREATMENT_WORDS.booking,
    /** The booking of a record, by its number and its day: 「BK-4F7H-2KQM（2026年11月20日（金））」 */
    bookingOf: (bookingNumber: string, day: LocalizedText) =>
      text({
        en: `${bookingNumber} (${day.en})`,
        ja: `${bookingNumber}（${day.ja}）`,
      }),
    staff: TREATMENT_WORDS.staff,
    services: TREATMENT_WORDS.services,
    techniques: TREATMENT_WORDS.techniques,
    processingTime: TREATMENT_WORDS.processingTime,
    writtenAt: TREATMENT_WORDS.writtenAt,
    changedAt: text({ en: 'Last edited at', ja: '最後に直した日時' }),
    consultation: TREATMENT_WORDS.consultation,
    consultationNotes: TREATMENT_WORDS.consultationNotes,
    scalpCondition: TREATMENT_WORDS.scalpCondition,
    hairCondition: TREATMENT_WORDS.hairCondition,
    colorFormula: TREATMENT_WORDS.colorFormula,
    materials: TREATMENT_WORDS.materials,
    materialList: text({
      en: 'List of materials used',
      ja: '使った商材の一覧',
    }),
    product: TREATMENT_WORDS.product,
    quantity: TREATMENT_WORDS.quantity,
    lotNumber: TREATMENT_WORDS.lotNumber,
    notes: text({ en: 'Notes', ja: 'メモ' }),
    noMaterials: text({
      en: 'No materials used',
      ja: '使った商材はありません',
    }),
    result: TREATMENT_WORDS.result,
    resultNotes: TREATMENT_WORDS.resultNotes,
    satisfaction: TREATMENT_WORDS.satisfaction,
    notAnswered: TREATMENT_WORDS.notAnswered,
    nextRecommendedDate: TREATMENT_WORDS.nextRecommendedDate,
    nextRecommendedServices: TREATMENT_WORDS.nextRecommendedServices,
    homeCareSuggestions: TREATMENT_WORDS.homeCareSuggestions,
    staffEvaluation: TREATMENT_WORDS.staffEvaluation,
    change: TREATMENT_WORDS.change,
  },
  /** The removal of a record written by mistake */
  removal: {
    open: text({ en: 'Remove', ja: '削除' }),
    /** The customer is named as a sentence names them */
    title: (customer: LocalizedText) =>
      text({
        en: `Remove the treatment record of ${customer.en}?`,
        ja: `${customer.ja}の施術記録を削除しますか？`,
      }),
    description: text({
      en: 'The treatment record written by mistake is removed with its materials and photos. A removed treatment record cannot be brought back.',
      ja: '間違えて書いた施術記録を、使った商材と写真と一緒に削除します。削除した施術記録は、元に戻せません。',
    }),
    back: TREATMENT_WORDS.back,
    submit: text({ en: 'Remove', ja: '削除する' }),
    done: (customer: LocalizedText) =>
      text({
        en: `Removed the treatment record of ${customer.en}.`,
        ja: `${customer.ja}の施術記録を削除しました。`,
      }),
    /** The role of the account changed meanwhile */
    forbidden: followed(
      text({
        en: 'This account cannot remove treatment records.',
        ja: 'このアカウントでは、施術記録を削除できません。',
      }),
      text({
        en: 'The owner and the managers can remove a treatment record written by mistake.',
        ja: '間違えて書いた施術記録の削除は、オーナーとマネージャーができます。',
      }),
    ),
    failed: text({
      en: 'The treatment record could not be removed. Check your connection and try again.',
      ja: '施術記録を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** The part of the page of a booking that leads to its record */
  booking: {
    title: TREATMENT_WORDS.record,
    loading: TREATMENT_WORDS.loading,
    none: text({
      en: 'No treatment record has been written yet.',
      ja: 'まだ施術記録を書いていません。',
    }),
    write: TREATMENT_WORDS.entry,
    /** When the record of the booking was written */
    writtenAt: (moment: LocalizedText) =>
      text({
        en: `A treatment record was written on ${moment.en}.`,
        ja: `${moment.ja}に書いた施術記録があります。`,
      }),
    view: TREATMENT_WORDS.view,
    notBegun: text({
      en: 'A treatment record can be written once the treatment starts.',
      ja: '施術を始めると、施術記録を書けます。',
    }),
    notTreated: text({
      en: 'A booking whose treatment did not take place has no treatment record.',
      ja: '施術をしなかった予約には、施術記録はありません。',
    }),
  },
}
