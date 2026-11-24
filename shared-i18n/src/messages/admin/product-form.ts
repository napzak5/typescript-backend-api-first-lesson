import { text } from '../../languages/localized-text'
import { uiMessages } from '../ui/components'
import { fieldMessages } from '../ui/fields'
import { followed } from '../written'
import {
  CARRIED,
  FOR_SALE,
  FOR_TREATMENT,
  productCalled,
} from './product-words'

/*
 * The form of a product, which adds one and changes one, what it says
 * after the API took it or not, and the removal of a product.
 */

/** A price that is not a whole number of yen from 0 */
const PRICE_ERRORS = {
  purchasePrice: text({
    en: 'Enter the purchase price as a whole number of yen from 0.',
    ja: '仕入価格は、0 以上の円の整数で入力してください。',
  }),
  retailPrice: text({
    en: 'Enter the list price as a whole number of yen from 0.',
    ja: '定価は、0 以上の円の整数で入力してください。',
  }),
  salonPrice: text({
    en: 'Enter the sale price as a whole number of yen from 0.',
    ja: '販売価格は、0 以上の円の整数で入力してください。',
  }),
}

/** A level of the stock that the API does not take */
const LEVEL_ERRORS = {
  minimumStock: text({
    en: 'Enter the minimum stock as a number from 0 to 99,999,999.99, with up to 2 decimal places.',
    ja: '最低在庫数は、0 から 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。',
  }),
  reorderPoint: text({
    en: 'Enter the reorder point as a number from 0 to 99,999,999.99, with up to 2 decimal places.',
    ja: '発注点は、0 から 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。',
  }),
  maximumStock: text({
    en: 'Enter the maximum stock as a number from 0 to 99,999,999.99, with up to 2 decimal places.',
    ja: '最大在庫数は、0 から 99,999,999.99 までの数（小数は 2 桁まで）で入力してください。',
  }),
}

export const productForm = {
  form: {
    productCodeDescription: (most: number) =>
      followed(
        fieldMessages.upTo(most),
        text({
          en: 'Another product of this salon that was not removed cannot have the same code, nor can a product that is no longer carried.',
          ja: 'このサロンの、削除していないほかの商品と同じコードは使えません。取り扱いをやめた商品のコードも使えません。',
        }),
      ),
    unitDescription: (most: number) =>
      followed(
        text({ en: 'Such as bottles, pieces or ml.', ja: '本、個、ml など。' }),
        fieldMessages.upTo(most),
        text({
          en: 'The unit the stock is counted in.',
          ja: '在庫の数を数える単位です。',
        }),
      ),
    categoryDescription: (most: number) =>
      followed(
        fieldMessages.upTo(most),
        text({
          en: 'The product ledger can be searched by category, and the value of the stock is totalled by category.',
          ja: '商品台帳で、カテゴリーで探せます。在庫の評価額をカテゴリーごとに集計します。',
        }),
      ),
    forSale: FOR_SALE,
    forTreatment: FOR_TREATMENT,
    forTreatmentDescription: text({
      en: 'Shown among the materials of the treatment records. For supplies used for neither, clear both.',
      ja: '施術記録の材料に出ます。どちらにも使わない備品は、両方の印を外します。',
    }),
    carried: CARRIED,
    carriedDescription: text({
      en: 'Without it, the product is discontinued and no longer shown among the materials of the treatment records. Its stock records and treatment records stay.',
      ja: '外すと、取り扱いをやめた商品になり、施術記録の材料に出なくなります。在庫の記録と施術記録は、そのまま残ります。',
    }),
    pricesDescription: text({
      en: 'Whole numbers of yen. Leave a price empty not to record it (0 is 0 yen).',
      ja: '円の整数で入力します。空にすると、記録しません（0 は 0 円です）。',
    }),
    retailPriceDescription: text({
      en: 'The retail price the manufacturer suggests.',
      ja: 'メーカーの希望小売価格。',
    }),
    salonPriceDescription: text({
      en: 'The price it is sold for at the counter of this salon.',
      ja: 'このサロンの店頭で売る価格。',
    }),
    levelsDescription: text({
      en: 'In the unit, with up to 2 decimal places. The minimum stock, the reorder point and the maximum stock go up in that order, or stay the same. Leave the reorder point or the maximum stock empty not to set it.',
      ja: '単位の数で、小数は 2 桁まで。最低在庫数、発注点、最大在庫数の順に、同じか大きくします。発注点と最大在庫数は、空にすると決めません。',
    }),
    minimumStockDescription: text({
      en: 'Orders keep the stock from falling below this.',
      ja: '在庫がこれを下回らないように発注します。',
    }),
    reorderPointDescription: text({
      en: 'An order is placed when the stock falls to this or below.',
      ja: '在庫がこれ以下になったら発注します。',
    }),
    maximumStockDescription: text({
      en: 'No more than this is kept.',
      ja: 'これより多くは置きません。',
    }),
    supplierProductCodeDescription: (most: number) =>
      followed(
        fieldMessages.upTo(most),
        text({ en: 'Used when ordering.', ja: '発注するときに使います。' }),
      ),
    leadTimeDaysDescription: text({
      en: 'A whole number from 0: the days from ordering to delivery.',
      ja: '0 以上の整数。発注してから届くまでの日数です。',
    }),
    barcodeDescription: (most: number) =>
      followed(
        fieldMessages.upTo(most),
        text({
          en: 'The product ledger can be searched by barcode.',
          ja: '商品台帳で、バーコードで探せます。',
        }),
      ),
    expiryMonths: text({ en: 'Months to expiry', ja: '使用期限までの月数' }),
    expiryMonthsDescription: text({
      en: 'A whole number from 1: about how long it keeps unopened.',
      ja: '1 以上の整数。開封前の使用期限の目安です。',
    }),
    lots: text({
      en: 'Keep the stock by lot number',
      ja: '在庫をロット番号で分ける',
    }),
    lotsDescription: text({
      en: 'For what expires by lot, such as hair colour. A change leaves the lot numbers of the stock records as they are.',
      ja: 'カラー剤など、ロットごとに使用期限があるもの。変えても、在庫の記録のロット番号はそのままです。',
    }),
    safetyDataSheetDescription: (most: number) =>
      followed(
        text({
          en: 'The URL of the safety data sheet (SDS) of the manufacturer.',
          ja: 'メーカーの安全データシート（SDS）の URL。',
        }),
        fieldMessages.upTo(most),
      ),
    /** What the API refused, and what the form found wrong */
    errors: {
      ...PRICE_ERRORS,
      ...LEVEL_ERRORS,
      leadTimeDays: text({
        en: 'Enter the lead time as a whole number of days from 0.',
        ja: '納品までの日数は、0 以上の整数で入力してください。',
      }),
      expiryMonths: text({
        en: 'Enter the months to expiry as a whole number from 1.',
        ja: '使用期限までの月数は、1 以上の整数で入力してください。',
      }),
      reorderBelowMinimum: text({
        en: 'Make the reorder point the same as the minimum stock or larger.',
        ja: '発注点は、最低在庫数と同じか、それより大きい数にしてください。',
      }),
      maximumBelowReorder: text({
        en: 'Make the maximum stock the same as the reorder point or larger.',
        ja: '最大在庫数は、発注点と同じか、それより大きい数にしてください。',
      }),
      maximumBelowMinimum: text({
        en: 'Make the maximum stock the same as the minimum stock or larger.',
        ja: '最大在庫数は、最低在庫数と同じか、それより大きい数にしてください。',
      }),
      /** The API compared a level with the levels it keeps: another was changed meanwhile */
      minimumAgainstKept: text({
        en: 'Make the minimum stock the same as the reorder point and the maximum stock, or smaller.',
        ja: '最低在庫数は、発注点と最大在庫数と同じか、それより小さい数にしてください。',
      }),
      reorderAgainstKept: text({
        en: 'Make the reorder point a number from the minimum stock to the maximum stock.',
        ja: '発注点は、最低在庫数から最大在庫数までの数にしてください。',
      }),
      maximumAgainstKept: text({
        en: 'Make the maximum stock the same as the minimum stock and the reorder point, or larger.',
        ja: '最大在庫数は、最低在庫数と発注点と同じか、それより大きい数にしてください。',
      }),
      codeTaken: text({
        en: 'Another product of this salon uses this product code, and the code of a discontinued product cannot be used either. Enter another code.',
        ja: 'この商品コードは、このサロンのほかの商品が使っています。取り扱いをやめた商品のコードも使えません。ほかのコードを入力してください。',
      }),
    },
    /** The account may not keep the products of the salon */
    forbidden: text({
      en: 'The products of this salon cannot be changed. Only the owners and managers of that salon, and administrators, can change its products.',
      ja: 'このサロンの商品は、変えられません。商品を変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
    }),
    failed: text({
      en: 'Could not save the product. Check your connection and try again.',
      ja: '商品を保存できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  entry: {
    submit: text({ en: 'Add', ja: '足す' }),
    added: (name: string) =>
      text({
        en: `Added ${productCalled(name).en}.`,
        ja: `${productCalled(name).ja}を足しました。`,
      }),
  },
  change: {
    submit: text({ en: 'Save changes', ja: '変更を保存する' }),
    changed: (name: string) =>
      text({
        en: `Saved ${productCalled(name).en}.`,
        ja: `${productCalled(name).ja}を直しました。`,
      }),
  },
  removal: {
    remove: text({ en: 'Remove', ja: '削除' }),
    title: (name: string) =>
      text({
        en: `Remove ${productCalled(name).en}?`,
        ja: `${productCalled(name).ja}を削除しますか？`,
      }),
    description: text({
      en: 'It is no longer shown in the product ledger or among the materials of the treatment records. A product with stock records cannot be removed: discontinue it instead. A removed product cannot be restored.',
      ja: '商品台帳と、施術記録の材料に出なくなります。在庫の記録がある商品は、削除できません。そのときは、取り扱いをやめてください。削除した商品は、元に戻せません。',
    }),
    back: uiMessages.back,
    submit: text({ en: 'Remove', ja: '削除する' }),
    done: (name: string) =>
      text({
        en: `Removed ${productCalled(name).en}.`,
        ja: `${productCalled(name).ja}を削除しました。`,
      }),
    /** The salon keeps stock of the product: it stops carrying it instead */
    inStock: (name: string) =>
      text({
        en: `The product “${name}” has stock records, so it cannot be removed. To discontinue it, clear “${CARRIED.en}” and save.`,
        ja: `${productCalled(name).ja}には在庫の記録があるので、削除できません。取り扱いをやめるときは、「${CARRIED.ja}」の印を外して保存してください。`,
      }),
    failed: text({
      en: 'Could not remove the product. Check your connection and try again.',
      ja: '商品を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
}
