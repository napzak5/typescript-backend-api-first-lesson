import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'
import { countOf } from '../written'
import { INVENTORY_WORDS, rowsOf } from './inventory-words'

/*
 * The count of the stock, with what it says when the API did not take it
 * and what it found; and what the stock of a salon is worth. The reason
 * the API records for a count without one stands as it is stored.
 */

const ON_THE_BOOKS = text({ en: 'On the books', ja: '帳簿の在庫数' })
const COUNTED = text({ en: 'Counted', ja: '数えた数' })
const VALUE = text({ en: 'Inventory value', ja: '在庫評価額' })
const NO_STOCK = text({
  en: 'No products are in stock',
  ja: '在庫のある商品はありません',
})

/** How many products: 「3 品目」, "3 items" */
const itemsOf = (count: number): LocalizedText =>
  countOf(count, 'item', 'items', '品目')

export const inventoryCountMessages = {
  title: text({ en: 'Stock count', ja: '棚卸し' }),
  /** The form of a count */
  form: {
    part: COUNTED,
    description: text({
      en: 'Enter the count on the rows you counted. A row left empty is not counted, and its stock does not change. Up to 2 decimal places.',
      ja: '数えた行に、数えた数を入力します。空のままの行は数えず、在庫数も変わりません。小数は 2 桁まで。',
    }),
    /**
     * What the books say of a row: its stock, what of it is reserved
     * (`null` when nothing is), and where it is kept (`null` when that is
     * not recorded)
     */
    books: (
      current: LocalizedText,
      reserved: LocalizedText | null,
      place: LocalizedText | null,
    ) =>
      text({
        en: `On the books: ${current.en}${reserved === null ? '' : ` (${reserved.en} reserved)`}${place === null ? '' : `, stored at ${place.en}`}`,
        ja: `帳簿の在庫数 ${current.ja}${reserved === null ? '' : `（うち引き当て ${reserved.ja}）`}${place === null ? '' : `、保管場所 ${place.ja}`}`,
      }),
    reason: INVENTORY_WORDS.reason,
    reasonDescription: text({
      en: 'Optional. It becomes the reason of the adjustment that corrects the difference from the books. When it is empty, the adjustment is recorded as a stock count difference.',
      ja: '任意。帳簿の在庫数との差を直す、在庫の調整の理由になります。空のときは「棚卸しの差異」と記録します。',
    }),
    record: INVENTORY_WORDS.record,
    cancel: INVENTORY_WORDS.cancel,
  },
  /** What is wrong with the values of the form */
  errors: {
    count: text({
      en: 'Enter the count as a number from 0 to 99,999,999.99 (up to 2 decimal places).',
      ja: '数えた数は、0 から 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。',
    }),
    /** What was counted of a row is below what is reserved of it, which is still on the shelf */
    belowReserved: (reserved: LocalizedText) =>
      text({
        en: `This is below the ${reserved.en} reserved. Count the reserved stock as well.`,
        ja: `引き当てた数の ${reserved.ja} を下回ります。引き当てた在庫も、数えた数に入れてください。`,
      }),
    noneCounted: text({
      en: 'No row was counted. Enter the count on the rows you counted.',
      ja: '数えた行がありません。数えた行に、数えた数を入力してください。',
    }),
    /** More rows were counted than one count holds */
    tooMany: (most: number) =>
      text({
        en: `Up to ${rowsOf(most).en} can be recorded at once. Record these, then count the remaining rows again.`,
        ja: `一度に記録できるのは ${rowsOf(most).ja}までです。残りの行は、記録したあとに、もう一度棚卸しをして記録してください。`,
      }),
  },
  rowsChanged: text({
    en: 'One of the counted stock rows was removed meanwhile. The stock rows were loaded again. Check the counts and record them again.',
    ja: '数えた在庫の行のどれかが、その間に削除されました。在庫の行を読み直しました。数えた数を確かめて、もう一度記録してください。',
  }),
  reservedMeanwhile: text({
    en: 'On some rows the count is below what is reserved: stock was reserved meanwhile. The stock rows were loaded again. Check the counts and record them again.',
    ja: '数えた数が、引き当てた数を下回る行があります。その間に在庫が引き当てられました。在庫の行を読み直しました。数えた数を確かめて、もう一度記録してください。',
  }),
  forbidden: text({
    en: 'This account cannot record stock counts. Only the owners and managers of the salon, and administrators, can record them.',
    ja: 'このアカウントでは、棚卸しを記録できません。棚卸しを記録できるのは、サロンのオーナーとマネージャーと、管理者です。',
  }),
  failed: text({
    en: 'The stock count could not be recorded. Check your connection and try again.',
    ja: '棚卸しを記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
  }),
  /** A count that was recorded: how many rows it counted, and how many differed */
  done: (counted: number, differed: number) =>
    text({
      en: `Recorded the count of ${rowsOf(counted).en}. Rows that differed from the books: ${numberOf(differed).en}.`,
      ja: `${rowsOf(counted).ja}の棚卸しを記録しました。帳簿の在庫数と差のあった行は ${rowsOf(differed).ja}です。`,
    }),
  /** What the count found */
  result: {
    same: text({
      en: 'Every row counted matched the books. The stock does not change.',
      ja: '数えたどの行も、帳簿の在庫数と同じでした。在庫数は変わりません。',
    }),
    caption: text({
      en: 'Rows that differed from the books',
      ja: '帳簿の在庫数と差のあった行',
    }),
    row: text({ en: 'Stock row', ja: '在庫の行' }),
    onTheBooks: ON_THE_BOOKS,
    counted: COUNTED,
    difference: text({ en: 'Difference', ja: '差' }),
    empty: text({ en: 'No rows differed', ja: '差のあった行はありません' }),
    again: text({ en: 'Count more stock', ja: '続けて棚卸しする' }),
  },
  loading: INVENTORY_WORDS.loadingRow,
  /** A salon without stock rows */
  noRows: text({
    en: 'There are no stock rows to count',
    ja: '数える在庫の行がありません',
  }),
  noRowsDescription: text({
    en: 'Once stock rows are added, they can be counted here.',
    ja: '在庫の行を足すと、ここで数えられます。',
  }),
  /** What the stock of a salon is worth */
  value: {
    title: VALUE,
    loading: text({
      en: 'Loading the inventory value',
      ja: '在庫評価額を読み込んでいます',
    }),
    forbidden: text({
      en: 'This account cannot see the inventory value. Only the owners and managers of the salon, and administrators, can see it.',
      ja: 'このアカウントでは、在庫評価額を見られません。在庫評価額を見られるのは、サロンのオーナーとマネージャーと、管理者です。',
    }),
    empty: NO_STOCK,
    emptyDescription: text({
      en: 'Products whose stock went above 0 with a stock movement or a count appear here.',
      ja: '在庫の移動か棚卸しで在庫数が 0 より多くなった商品が、ここに出ます。',
    }),
    /** The worth of the stock in all, and of how many products */
    total: (amount: LocalizedText, items: number) =>
      text({
        en: `The inventory is worth ${amount.en} in all (${itemsOf(items).en}). It is the stock times the purchase price of each product; a product without a purchase price counts for nothing.`,
        ja: `在庫評価額の合計は ${amount.ja}（${itemsOf(items).ja}）です。在庫数に商品の仕入価格を掛けた額で、仕入価格のない商品は 0 円として数えます。`,
      }),
    caption: text({
      en: 'Inventory value by category',
      ja: 'カテゴリーごとの在庫評価額',
    }),
    category: text({ en: 'Category', ja: 'カテゴリー' }),
    noCategory: text({ en: 'No category', ja: 'カテゴリーなし' }),
    itemCount: text({ en: 'Items', ja: '品目数' }),
    itemsOf,
    value: VALUE,
  },
}
