import { type LocalizedText, text } from '../../languages/localized-text'
import { uiMessages } from '../ui/components'
import { countOf } from '../written'

/*
 * What the catalogues of the inventory share: how a product, a stock row
 * and the place it is kept are named, how a quantity is written in the
 * unit of its product, who keeps the stock, and the words of its columns.
 * The names of the products, their codes and units, the lots, the places
 * and the names of the staff stand as they were written. Each part of the
 * inventory is a file of its own, and `adminInventoryMessages`
 * (`inventory.ts`) collects them under one name.
 */

/** A product that is not among those read: it was removed */
export const REMOVED_PRODUCT = text({
  en: 'Removed product',
  ja: '削除した商品',
})

/** A product by its name and its code: 「Hair Color（COLOR001）」 */
export const productNamed = (name: string, code: string): LocalizedText =>
  text({ en: `${name} (${code})`, ja: `${name}（${code}）` })

/**
 * A stock row by the name of its product (`null` for one that was removed)
 * and its lot: 「Hair Color（ロット LOT-1）」.
 */
export const rowNamed = (
  product: string | null,
  lot: string | null,
): LocalizedText => {
  const name =
    product === null ? REMOVED_PRODUCT : text({ en: product, ja: product })

  return lot === null
    ? name
    : text({ en: `${name.en} (lot ${lot})`, ja: `${name.ja}（ロット ${lot}）` })
}

/** A quantity in the unit of its product: 「12.5 bottle」 */
export const inUnit = (quantity: LocalizedText, unit: string): LocalizedText =>
  text({ en: `${quantity.en} ${unit}`, ja: `${quantity.ja} ${unit}` })

/** Who keeps the stock rows, said after what the account may not do */
export const ROWS_KEPT_BY = text({
  en: 'Only the owners and managers of the salon, and administrators, can change stock rows.',
  ja: '在庫の行を変えられるのは、サロンのオーナーとマネージャーと、管理者です。',
})

/** What a list that is narrowed and holds nothing says */
export const LOOK_AGAIN = text({
  en: 'Change the filters and look again.',
  ja: '条件を変えて、見直してください。',
})

/** How many stock rows: 「3 行」, "3 rows" */
export const rowsOf = (count: number): LocalizedText =>
  countOf(count, 'row', 'rows', '行')

/** The words of the inventory that more than one of its parts says */
export const INVENTORY_WORDS = {
  product: text({ en: 'Product', ja: '商品' }),
  lot: text({ en: 'Lot number', ja: 'ロット番号' }),
  expiry: text({ en: 'Expiry date', ja: '使用期限' }),
  location: text({ en: 'Storage location', ja: '保管場所' }),
  shelf: text({ en: 'Shelf', ja: '棚' }),
  notes: text({ en: 'Notes', ja: 'メモ' }),
  inStock: text({ en: 'In stock', ja: '在庫数' }),
  reason: text({ en: 'Reason', ja: '理由' }),
  all: text({ en: 'All', ja: 'すべて' }),
  record: text({ en: 'Record', ja: '記録する' }),
  cancel: text({ en: 'Cancel', ja: 'やめる' }),
  back: uiMessages.back,
  noExpiry: text({ en: 'No expiry', ja: '期限なし' }),
  expired: text({ en: 'Expired', ja: '期限切れ' }),
  optional: text({ en: 'Optional.', ja: '任意。' }),
  addRow: text({ en: 'Add a stock row', ja: '在庫の行を足す' }),
  recordMovement: text({
    en: 'Record a stock movement',
    ja: '在庫の移動を記録する',
  }),
  /** The way from a screen of the inventory back to the stock */
  toInventory: text({ en: 'Back to the inventory', ja: '在庫へ' }),
  loadingRow: text({
    en: 'Loading the stock row',
    ja: '在庫の行を読み込んでいます',
  }),
  /** When something was done, and by whom when it is known: 「2026年11月20日（金） 10:00（佐藤 健）」 */
  byWhom: (moment: LocalizedText, who: LocalizedText) =>
    text({ en: `${moment.en} (${who.en})`, ja: `${moment.ja}（${who.ja}）` }),
}
