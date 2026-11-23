import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'
import { countedIn } from '../written'

/*
 * What the catalogues of the ledger of the customers share: who may do
 * what the staff may not, what a search of the ledger looks in, how a
 * customer is named in a sentence, and how a count is written beside what
 * it counts. Each part of the ledger is a file of its own, and
 * `adminCustomerMessages` (`customers.ts`) collects them under one name.
 */

/** What a member of the staff is told where the record would be kept */
export const KEPT_BY_OTHERS = text({
  en: 'Owners and managers remove customers from the ledger, merge them and read the change history.',
  ja: '台帳からの削除と統合、変更履歴は、オーナーとマネージャーができます。',
})

/** What a member of the staff is told where the requests of a customer would be answered */
export const ANSWERED_BY_OTHERS = text({
  en: 'Owners and managers answer the requests of customers to see or erase their data.',
  ja: 'ご本人からのデータの開示と消去の請求には、オーナーとマネージャーが応えます。',
})

/** What a search of the ledger by a keyword looks in */
export const KEYWORD_DESCRIPTION = text({
  en: 'Part of a name (also phonetic), an email address or a phone number.',
  ja: 'お名前（カナでも）、メールアドレス、電話番号の一部。',
})

/** How the staff name a customer in a sentence: 「山田 花子 様」; English names them alone */
export const honored = (name: string): LocalizedText =>
  text({ en: name, ja: `${name} 様` })

/** A count beside the term that names what it counts, which Japanese counts with one word: 「3 回」, "3 visits" */
export const countOf = (
  count: number,
  one: string,
  many: string,
  counter: string,
): LocalizedText =>
  text({
    en: countedIn(count, one, many),
    ja: `${numberOf(count).ja} ${counter}`,
  })

/** How many customers: 「3 人」, "3 customers" */
export const customersOf = (count: number): LocalizedText =>
  countOf(count, 'customer', 'customers', '人')
