import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'
import { countedIn } from '../written'
import { TREATMENT_WORDS } from './treatment-words'

/*
 * What the form of a treatment record says: its parts and controls, the
 * rows of the materials used, what is wrong with the values, and what is
 * said after the record was to be written or changed; and the screen that
 * writes the record of a booking, with what the API said of the booking.
 */

/** A material of the form by its number, counted from 1 */
const materialNamed = (number: number): LocalizedText =>
  text({
    en: `Material ${numberOf(number).en}`,
    ja: `${numberOf(number).ja} 件目の商材`,
  })

export const treatmentFormMessages = {
  treatment: TREATMENT_WORDS.treatment,
  staff: TREATMENT_WORDS.staff,
  choose: text({ en: 'Choose', ja: '選んでください' }),
  staffDescription: text({
    en: 'The staff member who did the treatment. It need not be the staff member of the booking.',
    ja: '施術をしたスタッフ。予約の担当でなくても選べます。',
  }),
  services: TREATMENT_WORDS.services,
  /** How many services a record takes */
  servicesDescription: (most: number) =>
    text({
      en: `Choose 1 to ${numberOf(most).en}.`,
      ja: `1 件から ${numberOf(most).ja} 件まで選びます。`,
    }),
  techniques: TREATMENT_WORDS.techniques,
  /** How the techniques are written, and how many a record takes */
  techniquesDescription: (most: number) =>
    text({
      en: `Separate the names of the techniques with commas. Up to ${numberOf(most).en}.`,
      ja: `技法の名前を、「、」か「,」で区切って書きます。${numberOf(most).ja} 件までです。`,
    }),
  /** The name of a technique, as a sentence about its length names it */
  techniqueName: text({ en: 'Name of a technique', ja: '技法の名前' }),
  processingTime: text({
    en: 'Treatment time (min)',
    ja: '施術時間（分）',
  }),
  /** The longest treatment a record takes, in minutes */
  processingTimeDescription: (most: number) =>
    text({
      en: `Minutes from 0 to ${numberOf(most).en}.`,
      ja: `0 から ${numberOf(most).ja} までの分。`,
    }),
  consultation: TREATMENT_WORDS.consultation,
  consultationNotes: TREATMENT_WORDS.consultationNotes,
  scalpCondition: TREATMENT_WORDS.scalpCondition,
  hairCondition: TREATMENT_WORDS.hairCondition,
  colorFormula: TREATMENT_WORDS.colorFormula,
  colorFormulaDescription: text({
    en: 'Leave it empty for a treatment without color.',
    ja: 'カラーをしない施術では、空のままにします。',
  }),
  materials: TREATMENT_WORDS.materials,
  materialsDescription: text({
    en: 'Recording them does not reduce the stock. Record what was taken from the stock on the screens of the inventory.',
    ja: '記録しても在庫は減りません。在庫から出した分は、在庫の画面で記録します。',
  }),
  /** The group of the controls of a material */
  materialOf: materialNamed,
  product: TREATMENT_WORDS.product,
  quantity: TREATMENT_WORDS.quantity,
  quantityDescription: text({
    en: 'Up to two decimal places.',
    ja: '小数第 2 位まで。',
  }),
  unit: TREATMENT_WORDS.unit,
  unitDescription: text({
    en: 'Choosing a product fills in its unit.',
    ja: '商品を選ぶと、商品の単位が入ります。',
  }),
  lotNumber: TREATMENT_WORDS.lotNumber,
  lotNumberDescription: text({
    en: 'This product is kept by lots. Write the lot number of the product used.',
    ja: 'ロットで管理している商品です。使った商品のロット番号を書きます。',
  }),
  materialNotes: text({ en: 'Material notes', ja: '商材のメモ' }),
  remove: TREATMENT_WORDS.remove,
  removeMaterial: (number: number) => {
    const material = materialNamed(number)

    return text({
      en: `Remove ${material.en.toLowerCase()}`,
      ja: `${material.ja}を外す`,
    })
  },
  addMaterial: text({ en: 'Add a material', ja: '商材を足す' }),
  /** The form has the most materials a record holds */
  mostMaterials: (most: number) =>
    text({
      en: `Up to ${countedIn(most, 'material', 'materials')} can be recorded.`,
      ja: `使った商材は、${numberOf(most).ja} 件まで書けます。`,
    }),
  result: TREATMENT_WORDS.result,
  resultNotes: TREATMENT_WORDS.resultNotes,
  resultNotesDescription: text({
    en: 'Leave it empty if nothing was out of the ordinary.',
    ja: 'いつもと違うことがなければ、空のままにします。',
  }),
  satisfaction: TREATMENT_WORDS.satisfaction,
  notRecorded: text({ en: 'Not recorded', ja: '記録しない' }),
  nextRecommendedDate: TREATMENT_WORDS.nextRecommendedDate,
  nextRecommendedDateDescription: text({
    en: 'The day of the booking or a later one. Leave it empty if there is nothing to recommend.',
    ja: '予約の日から後の日。勧めることがなければ、空のままにします。',
  }),
  nextRecommendedServices: TREATMENT_WORDS.nextRecommendedServices,
  /** How many services may be recommended */
  nextRecommendedServicesDescription: (most: number) =>
    text({
      en: `Up to ${numberOf(most).en} can be chosen.`,
      ja: `${numberOf(most).ja} 件まで選べます。`,
    }),
  homeCareSuggestions: TREATMENT_WORDS.homeCareSuggestions,
  staffEvaluation: TREATMENT_WORDS.staffEvaluation,
  staffEvaluationDescription: text({
    en: 'A look back at the treatment, and what to pass on to the staff member who does the next one.',
    ja: '施術の振り返りや、次に担当するスタッフへ伝えること。',
  }),
  /** What is wrong with the values of the form */
  errors: {
    staff: text({
      en: 'Choose the staff member.',
      ja: '担当を選んでください。',
    }),
    services: text({
      en: 'Choose the services provided.',
      ja: '提供したサービスを選んでください。',
    }),
    tooManyServices: (most: number) =>
      text({
        en: `Choose up to ${numberOf(most).en} services provided.`,
        ja: `提供したサービスは、${numberOf(most).ja} 件までにしてください。`,
      }),
    tooManyTechniques: (most: number) =>
      text({
        en: `Enter up to ${numberOf(most).en} techniques.`,
        ja: `技法は、${numberOf(most).ja} 件までで入力してください。`,
      }),
    processingTime: (most: number) =>
      text({
        en: `Enter the treatment time as a whole number of minutes from 0 to ${numberOf(most).en}.`,
        ja: `施術時間は、0 から ${numberOf(most).ja} までの分の整数で入力してください。`,
      }),
    nextRecommendedDate: text({
      en: 'Enter the next recommended date as a date.',
      ja: '次に勧める日を、日付で入力してください。',
    }),
    /** The next visit is recommended before the day of the booking */
    nextRecommendedDateTooEarly: (bookingDay: LocalizedText) =>
      text({
        en: `Make the next recommended date the day of the booking (${bookingDay.en}) or a later one.`,
        ja: `次に勧める日は、予約の日（${bookingDay.ja}）から後の日にしてください。`,
      }),
    tooManyNextServices: (most: number) =>
      text({
        en: `Choose up to ${numberOf(most).en} next recommended services.`,
        ja: `次に勧めるサービスは、${numberOf(most).ja} 件までにしてください。`,
      }),
    satisfaction: text({
      en: 'Choose the satisfaction again.',
      ja: '満足度を選び直してください。',
    }),
    product: text({ en: 'Choose a product.', ja: '商品を選んでください。' }),
    productGone: text({
      en: 'This product was removed meanwhile. Choose another product, or remove this material.',
      ja: 'この商品は、その間に削除されました。ほかの商品を選ぶか、この商材を外してください。',
    }),
    quantity: text({
      en: 'Enter a quantity greater than 0, with up to two decimal places.',
      ja: '量は、0 より大きい数で、小数第 2 位まで入力してください。',
    }),
    unit: text({ en: 'Enter the unit.', ja: '単位を入力してください。' }),
    lotNumber: text({
      en: 'This product is kept by lots. Enter the lot number.',
      ja: 'この商品は、ロットで管理しています。ロット番号を入力してください。',
    }),
    lotNumberNotTaken: text({
      en: 'This product is not kept by lots. Clear the lot number.',
      ja: 'この商品は、ロットで管理していません。ロット番号を消してください。',
    }),
    lotsChanged: text({
      en: 'Meanwhile the salon changed whether this product is kept by lots. Open the screen again and write the material again.',
      ja: 'その間に、この商品のロットの管理が変わりました。画面を開き直して、書き直してください。',
    }),
    staffGone: text({
      en: 'This staff member was removed or moved to another salon meanwhile. Choose another staff member.',
      ja: 'このスタッフは、その間に削除されたか、ほかのサロンに移りました。ほかのスタッフを選んでください。',
    }),
    serviceGone: text({
      en: 'A service was removed meanwhile. Choose again.',
      ja: 'その間に削除されたサービスがあります。選び直してください。',
    }),
    /** The customer of the booking left the ledger meanwhile */
    customerGone: text({
      en: 'This customer was removed from the ledger meanwhile. No treatment record can be written.',
      ja: 'このお客様は、その間に台帳から削除されました。施術記録は書けません。',
    }),
  },
  /** What the API refused, or what came to nothing, by the write that was made */
  forbidden: text({
    en: 'This account cannot write treatment records.',
    ja: 'このアカウントでは、施術記録を書けません。',
  }),
  failed: {
    entry: text({
      en: 'The treatment record could not be written. Check your connection and try again.',
      ja: '施術記録を書けませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
    change: text({
      en: 'The treatment record could not be changed. Check your connection and try again.',
      ja: '施術記録を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** What the record was written or changed for; the customer is named as a sentence names them */
  written: {
    entry: (customer: LocalizedText) =>
      text({
        en: `Wrote the treatment record of ${customer.en}.`,
        ja: `${customer.ja}の施術記録を書きました。`,
      }),
    change: (customer: LocalizedText) =>
      text({
        en: `Saved the treatment record of ${customer.en}.`,
        ja: `${customer.ja}の施術記録を直しました。`,
      }),
  },
  /** The screen that writes the record of a booking */
  entry: {
    submit: TREATMENT_WORDS.entry,
    cancel: TREATMENT_WORDS.cancel,
    preparing: text({
      en: 'Preparing to write the treatment record',
      ja: '施術記録を書く準備をしています',
    }),
    /** The record of the booking was written before the screen was opened */
    written: text({
      en: 'The treatment record of this booking has been written.',
      ja: 'この予約の施術記録は、書いてあります。',
    }),
    view: TREATMENT_WORDS.view,
    /** Another account wrote the record of the booking meanwhile */
    exists: text({
      en: 'Meanwhile another account wrote the treatment record of this booking. Add what you wrote to that treatment record by editing it.',
      ja: 'その間に、ほかのアカウントがこの予約の施術記録を書いていました。書いた内容は、その施術記録を直して書き足してください。',
    }),
    viewExisting: text({
      en: 'View the treatment record that was written',
      ja: '書かれていた施術記録を見る',
    }),
    /** The booking was cancelled meanwhile, or its treatment has not started */
    notBegun: text({
      en: 'This booking is neither in progress nor completed. A treatment record can be written for a booking whose treatment started.',
      ja: 'この予約は、施術中でも完了でもありません。施術を始めた予約に、施術記録を書けます。',
    }),
  },
  /** The screen that changes a record */
  change: {
    submit: text({ en: 'Save changes', ja: '変更を保存する' }),
    cancel: TREATMENT_WORDS.cancel,
  },
}
