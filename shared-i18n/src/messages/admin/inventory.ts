import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'
import { fieldMessages } from '../ui/fields'
import { followed } from '../written'
import { inventoryAlertMessages } from './inventory-alerts'
import { inventoryCountMessages } from './inventory-count'
import { inventoryMovementMessages } from './inventory-movements'
import {
  INVENTORY_WORDS,
  inUnit,
  productNamed,
  REMOVED_PRODUCT,
  ROWS_KEPT_BY,
  rowNamed,
} from './inventory-words'

/*
 * What the screens of the inventory say in the admin application: the
 * stock of a salon in its views, a stock row shown, added, changed and
 * removed, and who may keep the stock. The names of the products, their
 * codes and units, the lots, the places, the notes and the name of the
 * salon stand as they were written.
 *
 * The other parts of the inventory are files of their own beside this
 * one, collected here under the same name: the movements, the count and
 * the value, and the alerts.
 */

const TITLE = text({ en: 'Inventory', ja: '在庫' })
const ROW = text({ en: 'Stock row', ja: '在庫の行' })
const CHANGE = text({ en: 'Edit the stock row', ja: '在庫の行を直す' })
const LOW_STOCK = inventoryAlertMessages.kinds.low_stock
const EXPIRING = inventoryAlertMessages.kinds.expiring

export const adminInventoryMessages = {
  titles: {
    inventory: TITLE,
    row: ROW,
    entry: INVENTORY_WORDS.addRow,
    change: CHANGE,
    movements: inventoryMovementMessages.title,
    movementEntry: inventoryMovementMessages.entryTitle,
    count: inventoryCountMessages.title,
    value: inventoryCountMessages.value.title,
    alerts: inventoryAlertMessages.title,
  },
  /** What a screen could not read, and what a sentence names, as it stands there */
  names: {
    inventory: text({ en: 'the inventory', ja: '在庫' }),
    /** What a member of another salon cannot see of this one */
    inventoryOfTheSalon: text({ en: 'inventory', ja: '在庫' }),
    row: text({ en: 'the stock row', ja: '在庫の行' }),
    products: text({ en: 'the products', ja: '商品' }),
    movements: text({ en: 'the stock movements', ja: '在庫の移動' }),
    staff: text({ en: 'the staff', ja: 'スタッフ' }),
    value: text({ en: 'the inventory value', ja: '在庫評価額' }),
    alertCount: text({ en: 'the number of alerts', ja: 'アラートの件数' }),
    alerts: text({ en: 'the inventory alerts', ja: '在庫のアラート' }),
  },
  words: INVENTORY_WORDS,
  removedProduct: REMOVED_PRODUCT,
  productNamed,
  rowNamed,
  inUnit,
  /**
   * Where a row is kept, by its place and its shelf: 「Storage Room A（棚
   * B-2）」; `null` when neither is recorded.
   */
  placeOf: (
    location: string | null,
    shelf: string | null,
  ): LocalizedText | null => {
    if (shelf === null) {
      return location === null ? null : text({ en: location, ja: location })
    }

    return location === null
      ? text({ en: `Shelf ${shelf}`, ja: `棚 ${shelf}` })
      : text({
          en: `${location} (shelf ${shelf})`,
          ja: `${location}（棚 ${shelf}）`,
        })
  },
  /** The stock of a salon, in its views */
  stock: {
    loading: text({
      en: 'Loading the inventory',
      ja: '在庫を読み込んでいます',
    }),
    viewsLabel: text({ en: 'Views of the inventory', ja: '在庫の見かた' }),
    views: {
      all: INVENTORY_WORDS.all,
      lowStock: LOW_STOCK,
      expiring: EXPIRING,
    },
    lowStockAbout: text({
      en: 'The stock rows of the products carried whose stock, all lots together, is at their minimum or below.',
      ja: '取り扱い中の商品のうち、すべてのロットを合わせた在庫数が最低在庫数以下の商品の、在庫の行です。',
    }),
    /** What a view is called above its rows, and what it says when it has none */
    lowStock: {
      caption: LOW_STOCK,
      empty: text({
        en: 'No products are low in stock',
        ja: '在庫僅少の商品はありません',
      }),
      emptyDescription: text({
        en: 'The stock rows of products whose stock falls to their minimum or below appear here.',
        ja: '在庫数が最低在庫数以下になった商品の在庫の行は、ここに出ます。',
      }),
    },
    expiring: {
      caption: EXPIRING,
      empty: text({
        en: 'No stock is expiring soon',
        ja: '期限切れ間近の在庫はありません',
      }),
      emptyDescription: text({
        en: 'Change the period and look again.',
        ja: '期間を変えて、見直してください。',
      }),
    },
    narrowed: {
      caption: text({
        en: 'Stock rows matching the filters',
        ja: '条件に合う在庫の行',
      }),
      empty: text({
        en: 'No stock rows match these filters',
        ja: '条件に合う在庫の行はありません',
      }),
      emptyDescription: text({
        en: 'Change the filters and search again.',
        ja: '条件を変えて探してください。',
      }),
    },
    all: {
      caption: TITLE,
      empty: text({ en: 'No stock rows', ja: '在庫の行はありません' }),
      keeperDescription: text({
        en: 'Add a stock row for each product whose stock is counted.',
        ja: '在庫を数える商品の、在庫の行を足してください。',
      }),
      staffDescription: text({
        en: 'Only the owners and managers of the salon, and administrators, can add stock rows.',
        ja: '在庫の行を足せるのは、サロンのオーナーとマネージャーと、管理者です。',
      }),
    },
    addRow: INVENTORY_WORDS.addRow,
    alerts: inventoryAlertMessages.title,
    count: text({ en: 'Count the stock', ja: '棚卸しする' }),
    value: inventoryCountMessages.value.title,
  },
  /** Which rows the stock shows */
  filter: {
    label: text({ en: 'Find stock', ja: '在庫を探す' }),
    product: INVENTORY_WORDS.product,
    all: INVENTORY_WORDS.all,
    lot: INVENTORY_WORDS.lot,
    lotDescription: text({
      en: 'The whole lot number. Upper and lower case are told apart.',
      ja: 'ロット番号のすべて。大文字と小文字を区別します。',
    }),
    /** A product the salon no longer carries, still offered for what is left of it */
    notCarried: (product: LocalizedText) =>
      text({
        en: `${product.en}, no longer carried`,
        ja: `${product.ja}・取り扱いをやめた`,
      }),
    expiryLabel: text({ en: 'Narrow by expiry date', ja: '使用期限で絞る' }),
    expiry: INVENTORY_WORDS.expiry,
    expiryDescription: text({
      en: 'Stock whose expiry date comes between today and the day chosen. Stock past its expiry date is shown too.',
      ja: '今日から、選んだ日までに使用期限が来る在庫です。期限が過ぎたものも出ます。',
    }),
    /** How many days ahead the rows that expire soon are looked for */
    today: text({ en: 'By today', ja: '今日まで' }),
    within: (days: number) =>
      text({
        en: `Within ${numberOf(days).en} days`,
        ja: `${numberOf(days).ja} 日後まで`,
      }),
  },
  /** The columns of the stock */
  table: {
    productCode: text({ en: 'Product code', ja: '商品コード' }),
    productName: text({ en: 'Product name', ja: '商品名' }),
    lot: INVENTORY_WORDS.lot,
    expiry: INVENTORY_WORDS.expiry,
    location: INVENTORY_WORDS.location,
    inStock: INVENTORY_WORDS.inStock,
  },
  /** What a stock row keeps */
  record: {
    row: ROW,
    product: INVENTORY_WORDS.product,
    lot: INVENTORY_WORDS.lot,
    expiry: INVENTORY_WORDS.expiry,
    location: INVENTORY_WORDS.location,
    shelf: INVENTORY_WORDS.shelf,
    notes: INVENTORY_WORDS.notes,
    stock: text({ en: 'Stock', ja: '在庫' }),
    inStock: INVENTORY_WORDS.inStock,
    reserved: text({ en: 'Reserved', ja: '引き当てた数' }),
    available: text({ en: 'Available', ja: '使える数' }),
    lastCounted: text({ en: 'Last counted', ja: '最後の棚卸し' }),
    notCounted: text({ en: 'Not counted yet', ja: '棚卸ししていません' }),
    /** What is done with a row from its screen */
    history: text({
      en: 'Stock movement history',
      ja: '在庫の移動の履歴',
    }),
    change: CHANGE,
  },
  /** The form of a stock row */
  form: {
    part: ROW,
    newDescription: text({
      en: 'It is added as a row with a stock of 0. The stock changes with receipts and counts.',
      ja: '在庫数 0 の行として足します。在庫数は、入庫と棚卸しで変わります。',
    }),
    product: INVENTORY_WORDS.product,
    choose: text({ en: 'Choose', ja: '選んでください' }),
    productDescription: text({
      en: 'The products carried. When a product kept by lot numbers is chosen, the lot number is entered.',
      ja: '取り扱い中の商品です。ロット番号で分ける商品を選ぶと、ロット番号を入力します。',
    }),
    lot: INVENTORY_WORDS.lot,
    /** How long the lot of a product kept by lots may be, and that it is the lot of one row */
    lotDescription: (most: number) =>
      followed(
        fieldMessages.upTo(most),
        text({
          en: 'A lot number another stock row of this product has cannot be used.',
          ja: 'この商品のほかの在庫の行と同じロット番号は使えません。',
        }),
      ),
    expiry: INVENTORY_WORDS.expiry,
    expiryDescription: text({
      en: 'Leave it empty for stock without an expiry date.',
      ja: '使用期限のないものは、空にします。',
    }),
    location: INVENTORY_WORDS.location,
    shelf: INVENTORY_WORDS.shelf,
    notes: INVENTORY_WORDS.notes,
    add: text({ en: 'Add', ja: '足す' }),
    save: text({ en: 'Save changes', ja: '変更を保存する' }),
    cancel: INVENTORY_WORDS.cancel,
    remove: text({ en: 'Remove', ja: '削除' }),
  },
  /** What is wrong with the values of the form of a row, and what the API refused */
  errors: {
    product: text({ en: 'Choose a product.', ja: '商品を選んでください。' }),
    productRemoved: text({
      en: 'This product was removed. Choose another product.',
      ja: 'この商品は、削除されました。ほかの商品を選んでください。',
    }),
    /** A product kept by lots needs a lot that is not too long */
    lotNeeded: (most: number) =>
      followed(
        fieldMessages.neededWithin(INVENTORY_WORDS.lot, most),
        text({
          en: 'This product keeps its stock by lot numbers.',
          ja: 'この商品は、在庫をロット番号で分けます。',
        }),
      ),
    /** A product not kept by lots: said at its lot, and as the description of one to clear */
    lotNotKept: text({
      en: 'This product does not keep its stock by lot numbers. The lot number can only be cleared.',
      ja: 'この商品は、在庫をロット番号で分けません。ロット番号は、消すことだけができます。',
    }),
    expiry: text({
      en: 'Enter the expiry date as a date from January 1, 1900 to December 31, 2999.',
      ja: '使用期限は、1900年1月1日から2999年12月31日までの日付で入力してください。',
    }),
    lotTaken: text({
      en: 'This product already has a stock row with this lot number. Record the stock of that lot on that row.',
      ja: 'このロット番号の在庫の行は、この商品にすでにあります。同じロットの在庫は、その行で記録してください。',
    }),
    rowTaken: text({
      en: 'This product already has a stock row without a lot number. Record the stock without a lot number on that row.',
      ja: 'ロット番号のない在庫の行は、この商品にすでにあります。ロット番号のない在庫は、その行で記録してください。',
    }),
    lotMarkChanged: text({
      en: 'The mark “Keep the stock by lot numbers” of this product changed. The products were loaded again with the mark as it is now: check the lot number and try again.',
      ja: 'この商品の「在庫をロット番号で分ける」の印が、変わっていました。いまの印で読み直したので、ロット番号を確かめて、もう一度お試しください。',
    }),
  },
  /** An account that may not change the stock of the salon of the address, as the API says */
  forbidden: text({
    en: 'The stock of this salon cannot be changed. Only the owners and managers of that salon, and administrators, can change its stock rows.',
    ja: 'このサロンの在庫は、変えられません。在庫の行を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
  }),
  saveFailed: text({
    en: 'The stock row could not be saved. Check your connection and try again.',
    ja: '在庫の行を保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
  }),
  /** What follows a row that was written: the row stands as the stock names it */
  added: (row: LocalizedText) =>
    text({
      en: `Added the stock row “${row.en}”.`,
      ja: `在庫の行「${row.ja}」を足しました。`,
    }),
  changed: (row: LocalizedText) =>
    text({
      en: `Saved the stock row “${row.en}”.`,
      ja: `在庫の行「${row.ja}」を直しました。`,
    }),
  /** The removal of a row */
  removal: {
    confirm: (row: LocalizedText) =>
      text({
        en: `Remove the stock row “${row.en}”?`,
        ja: `在庫の行「${row.ja}」を削除しますか？`,
      }),
    description: text({
      en: 'Only a row with a stock of 0 can be removed. The records of the movements of the row stay. A removed row cannot be brought back.',
      ja: '在庫数が 0 の行だけを削除できます。この行の在庫の移動の記録は残ります。削除した行は、元に戻せません。',
    }),
    back: INVENTORY_WORDS.back,
    confirmRemoval: text({ en: 'Remove', ja: '削除する' }),
    done: (row: LocalizedText) =>
      text({
        en: `Removed the stock row “${row.en}”.`,
        ja: `在庫の行「${row.ja}」を削除しました。`,
      }),
    inStock: (row: LocalizedText) =>
      text({
        en: `The stock row “${row.en}” still has stock, so it cannot be removed. Bring its stock to 0 with a stock movement, then remove it.`,
        ja: `在庫の行「${row.ja}」は、在庫数が 0 でないので、削除できません。在庫の移動で在庫数を 0 にしてから、削除してください。`,
      }),
    failed: text({
      en: 'The stock row could not be removed. Check your connection and try again.',
      ja: '在庫の行を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** A new row of a salon that carries no products */
  entry: {
    loading: text({ en: 'Loading the products', ja: '商品を読み込んでいます' }),
    noProducts: text({
      en: 'No products are carried',
      ja: '取り扱い中の商品はありません',
    }),
    noProductsDescription: text({
      en: 'Stock rows are added to the products carried. Add a product to the product catalog first.',
      ja: '在庫の行は、取り扱い中の商品に足します。先に、商品台帳に商品を足してください。',
    }),
    addProduct: text({ en: 'Add a product', ja: '商品を足す' }),
  },
  /** What a screen for the keepers of the stock says to an account that does not keep it */
  keepers: {
    rowsForbidden: followed(
      text({
        en: 'This account cannot change stock rows.',
        ja: 'このアカウントでは、在庫の行を変えられません。',
      }),
      ROWS_KEPT_BY,
    ),
    back: text({ en: 'Back to the inventory', ja: '在庫へ戻る' }),
  },
  /** A screen of a stock row when there is none to show */
  notFound: {
    title: text({ en: 'Stock row not found', ja: '在庫の行が見つかりません' }),
    description: text({
      en: 'Check that the address is right. A removed stock row cannot be shown.',
      ja: 'アドレスが正しいか、お確かめください。削除した在庫の行は、表示できません。',
    }),
  },
  movements: inventoryMovementMessages,
  count: inventoryCountMessages,
  alerts: inventoryAlertMessages,
}
