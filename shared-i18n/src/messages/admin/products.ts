import { type LocalizedText, text } from '../../languages/localized-text'
import { salonScreenMessages } from '../ui/salon-screens'
import { countOf, followed, listed } from '../written'
import { productForm } from './product-form'
import {
  CARRIED,
  DROPPED,
  FOR_SALE,
  FOR_TREATMENT,
  PRODUCT_WORDS,
  PRODUCTS_KEPT_BY,
} from './product-words'

/*
 * What the screens of the products say in the admin application: the
 * product ledger with its search, a product shown, added, changed and
 * removed, and who may keep them. The names, codes, categories, brands,
 * units, suppliers, barcodes and descriptions of the products stand as
 * they were written.
 */

const LEDGER = text({ en: 'Product ledger', ja: '商品台帳' })

/** What a product is for, as the ledger and the record name it */
const USES = {
  sale: text({ en: 'In-store sale', ja: '店頭販売' }),
  treatment: text({ en: 'Treatment', ja: '施術' }),
}

export const adminProductMessages = {
  titles: {
    ledger: LEDGER,
    product: text({ en: 'Product details', ja: '商品の内容' }),
    entry: text({ en: 'Add a product', ja: '商品を足す' }),
    change: text({ en: 'Edit the product', ja: '商品を直す' }),
  },
  /** What a sentence names */
  names: {
    ledger: text({ en: 'the product ledger', ja: '商品台帳' }),
    product: text({ en: 'the product', ja: '商品' }),
    /** What a member of another salon cannot see of this one */
    productsOfTheSalon: text({ en: 'products', ja: '商品' }),
  },
  words: PRODUCT_WORDS,
  loading: {
    products: text({
      en: 'Loading the products',
      ja: '商品を読み込んでいます',
    }),
    product: text({ en: 'Loading the product', ja: '商品を読み込んでいます' }),
  },
  /** Whether the salon carries a product, and the choices of the search */
  carried: CARRIED,
  dropped: DROPPED,
  forSale: FOR_SALE,
  forTreatment: FOR_TREATMENT,
  /** What a product is for: 「店頭販売、施術」, or 「どちらでもない」 for supplies */
  usesOf: ({
    isForSale,
    isForTreatment,
  }: {
    isForSale: boolean
    isForTreatment: boolean
  }): LocalizedText => {
    const uses = [
      ...(isForSale ? [USES.sale] : []),
      ...(isForTreatment ? [USES.treatment] : []),
    ]

    return uses.length === 0
      ? text({ en: 'Neither', ja: 'どちらでもない' })
      : listed(uses)
  },
  /** A level of the stock that is not set */
  noLevel: text({ en: 'Not set', ja: '決めていない' }),
  /** The days a delivery takes: 「3 日」 */
  leadTimeOf: (days: number) => countOf(days, 'day', 'days', '日'),
  /** How long a product keeps: 「24 か月」 */
  expiryOf: (months: number) => countOf(months, 'month', 'months', 'か月'),
  lots: {
    kept: text({ en: 'By lot number', ja: 'ロット番号で分ける' }),
    notKept: text({ en: 'Not by lot', ja: '分けない' }),
  },
  ledger: {
    entry: text({ en: 'Add a product', ja: '商品を足す' }),
    narrowedCaption: text({
      en: 'Products matching the filters',
      ja: '条件に合う商品',
    }),
    none: text({ en: 'No products', ja: '商品はありません' }),
    noneMatching: text({
      en: 'No products match these filters',
      ja: '条件に合う商品はありません',
    }),
    noneMatchingDescription: text({
      en: 'Change the filters and search again.',
      ja: '条件を変えて探してください。',
    }),
    empty: text({
      en: 'There are no products in the ledger',
      ja: '台帳に商品はありません',
    }),
    keeperDescription: text({
      en: 'Add what is sold in store and what is used in treatments.',
      ja: '店頭で売るものと、施術で使うものを足してください。',
    }),
    otherDescription: text({
      en: 'Only the owners and managers of the salon, and administrators, can add products.',
      ja: '商品を足せるのは、サロンのオーナーとマネージャーと、管理者です。',
    }),
  },
  filter: {
    label: text({ en: 'Search products', ja: '商品を探す' }),
    keyword: salonScreenMessages.keyword,
    keywordDescription: text({
      en: 'Part of the name, the product code or the brand.',
      ja: '商品名、商品コード、ブランドの一部。',
    }),
    barcodeDescription: text({
      en: 'The whole barcode. A barcode reader can enter it.',
      ja: 'バーコードのすべて。読み取り機で入力できます。',
    }),
    carried: text({ en: 'Availability', ja: '取り扱い' }),
    all: text({ en: 'All', ja: 'すべて' }),
  },
  record: {
    lots: text({ en: 'Lot numbers', ja: 'ロット番号' }),
    expiry: text({ en: 'Expiry guide', ja: '使用期限の目安' }),
  },
  ...productForm,
  /** What a screen for the keepers of the products says to an account that does not keep them */
  keepers: {
    forbidden: followed(
      text({
        en: 'This account cannot change the products.',
        ja: 'このアカウントでは、商品を変えられません。',
      }),
      PRODUCTS_KEPT_BY,
    ),
    back: text({
      en: 'Back to the product ledger',
      ja: '商品台帳へ戻る',
    }),
  },
  /** A screen of a product when there is none to show */
  notFound: {
    title: text({ en: 'Product not found', ja: '商品が見つかりません' }),
    description: text({
      en: 'Check that the address is right. A removed product cannot be shown.',
      ja: 'アドレスが正しいか、お確かめください。削除した商品は、表示できません。',
    }),
  },
}
