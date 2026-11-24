import { type LocalizedText, text } from '../../languages/localized-text'

/*
 * The words that the parts of the product catalogue share: the fields of
 * a product, which the form, the record and the ledger name alike, whether
 * the salon carries a product and what it is for, and a product as a
 * sentence names it.
 */

/** A product the salon carries, and the control that says so */
export const CARRIED = text({ en: 'Active', ja: '取り扱い中' })

/** A product the salon no longer carries */
export const DROPPED = text({ en: 'Discontinued', ja: '取り扱いをやめた' })

/** A product that is sold at the counter */
export const FOR_SALE = text({ en: 'Sold in store', ja: '店頭で販売する' })

/** A product that is used in treatments */
export const FOR_TREATMENT = text({
  en: 'Used in treatments',
  ja: '施術で使う',
})

/** The words of the fields of a product */
export const PRODUCT_WORDS = {
  product: text({ en: 'Product', ja: '商品' }),
  productCode: text({ en: 'Product code', ja: '商品コード' }),
  name: text({ en: 'Product name', ja: '商品名' }),
  description: text({ en: 'Description', ja: '説明' }),
  category: text({ en: 'Category', ja: 'カテゴリー' }),
  brand: text({ en: 'Brand', ja: 'ブランド' }),
  unit: text({ en: 'Unit', ja: '単位' }),
  uses: text({ en: 'Use', ja: '用途' }),
  status: text({ en: 'Status', ja: '状態' }),
  prices: text({ en: 'Prices', ja: '価格' }),
  purchasePrice: text({ en: 'Purchase price', ja: '仕入価格' }),
  retailPrice: text({ en: 'List price', ja: '定価' }),
  salonPrice: text({ en: 'Sale price', ja: '販売価格' }),
  levels: text({ en: 'Stock levels', ja: '在庫の水準' }),
  minimumStock: text({ en: 'Minimum stock', ja: '最低在庫数' }),
  reorderPoint: text({ en: 'Reorder point', ja: '発注点' }),
  maximumStock: text({ en: 'Maximum stock', ja: '最大在庫数' }),
  purchasing: text({ en: 'Purchasing', ja: '仕入れ' }),
  supplier: text({ en: 'Supplier', ja: '仕入先' }),
  supplierProductCode: text({
    en: 'Supplier product code',
    ja: '仕入先の商品コード',
  }),
  leadTimeDays: text({ en: 'Lead time in days', ja: '納品までの日数' }),
  management: text({ en: 'Management', ja: '管理' }),
  barcode: text({ en: 'Barcode', ja: 'バーコード' }),
  storageConditions: text({ en: 'Storage conditions', ja: '保管条件' }),
  imageUrl: text({ en: 'Product image URL', ja: '商品画像の URL' }),
  safetyDataSheet: text({
    en: 'Safety data sheet URL',
    ja: '安全データシートの URL',
  }),
  cancel: text({ en: 'Cancel', ja: 'やめる' }),
  toLedger: text({ en: 'Back to the product ledger', ja: '商品台帳へ' }),
}

/** Who keeps the products, said after what the account may not do */
export const PRODUCTS_KEPT_BY = text({
  en: 'Only the owners and managers of the salon, and administrators, can change products.',
  ja: '商品を変えられるのは、サロンのオーナーとマネージャーと、管理者です。',
})

/** A product, as a sentence names it: 「商品「シャンプー」」 */
export const productCalled = (name: string): LocalizedText =>
  text({ en: `the product “${name}”`, ja: `商品「${name}」` })
