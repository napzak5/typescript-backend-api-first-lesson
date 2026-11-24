import { numberOf } from '../../formats/numbers'
import { type LocalizedText, text } from '../../languages/localized-text'
import { CHART_WORDS } from './chart-words'
import { honored } from './customer-words'

/*
 * The form of a chart, which makes one and changes one: its parts and
 * controls, the rows of the treatments had before, what is wrong with the
 * values, and what is said after the chart was to be written.
 */

/** A treatment of the form by its number, counted from 1 */
const rowNamed = (number: number): LocalizedText =>
  text({
    en: `Treatment ${numberOf(number).en}`,
    ja: `${numberOf(number).ja} 件目の施術`,
  })

/** How the names of products are written */
const PRODUCTS_DESCRIPTION = text({
  en: 'The names of products or brands. Separate them with “,” or “、”.',
  ja: '商材やブランドの名前を、「、」か「,」で区切って書きます。',
})

export const chartForm = {
  form: {
    beforeTreatment: text({
      en: 'To check before a treatment',
      ja: '施術の前に確かめること',
    }),
    medicalConditionsDescription: text({
      en: 'The medical conditions and the state of health to take care of before a treatment.',
      ja: '施術の前に注意が必要な持病や体調を書きます。',
    }),
    preferredProductsDescription: PRODUCTS_DESCRIPTION,
    avoidProductsDescription: PRODUCTS_DESCRIPTION,
    previousTreatmentsDescription: text({
      en: 'Treatments had at other salons, or before the salon kept a chart.',
      ja: 'ほかのサロンで受けた施術や、カルテを始める前の施術を書きます。',
    }),
    row: rowNamed,
    choose: text({ en: 'Choose', ja: '選んでください' }),
    salonNameDescription: text({
      en: 'The name of the salon where the treatment was had. Leave it empty if it is not known.',
      ja: '施術を受けたサロンの名前。分からなければ空のままにします。',
    }),
    treatmentNotes: text({ en: 'Treatment notes', ja: '施術のメモ' }),
    remove: text({ en: 'Remove', ja: '外す' }),
    removeRow: (number: number) =>
      text({
        en: `Remove treatment ${numberOf(number).en}`,
        ja: `${rowNamed(number).ja}を外す`,
      }),
    addRow: text({ en: 'Add a treatment', ja: '施術を足す' }),
    /** The most treatments a chart holds */
    mostRows: (most: number) =>
      text({
        en: `Up to ${numberOf(most).en} past treatments can be written.`,
        ja: `過去の施術は、${numberOf(most).ja} 件まで書けます。`,
      }),
    /** The name of the salon of a treatment, as a sentence about its length names it */
    salonName: text({ en: 'Salon name', ja: 'サロンの名前' }),
    /** The name of a product, as a sentence about its length names it */
    productName: text({ en: 'Product names', ja: '商材の名前' }),
    /** What the API refused, and what the form found wrong */
    errors: {
      treatmentMissing: text({
        en: 'Choose the treatment.',
        ja: '施術を選んでください。',
      }),
      dateMissing: text({
        en: 'Enter the treatment date.',
        ja: '施術日を入力してください。',
      }),
      dateTooEarly: text({
        en: 'Make the treatment date January 1, 1900 or later.',
        ja: '施術日は、1900年1月1日以降にしてください。',
      }),
      dateTooLate: text({
        en: 'Make the treatment date today or earlier.',
        ja: '施術日は、今日までにしてください。',
      }),
      /** The most names of products in a list */
      tooManyProducts: (most: number) =>
        text({
          en: `Enter up to ${numberOf(most).en} products.`,
          ja: `商材は、${numberOf(most).ja} 件までで入力してください。`,
        }),
    },
    /** The account may not write charts */
    forbidden: text({
      en: 'This account cannot write charts.',
      ja: 'このアカウントでは、カルテを書けません。',
    }),
  },
  entry: {
    submit: CHART_WORDS.entry,
    done: (name: string) =>
      text({
        en: `Created the chart of ${honored(name).en}.`,
        ja: `${honored(name).ja}のカルテを作りました。`,
      }),
    /** Another account made the chart of the customer meanwhile */
    exists: text({
      en: 'Another account created the chart of this customer meanwhile. Add what you wrote by editing that chart.',
      ja: 'その間に、ほかのアカウントがこのお客様のカルテを作っていました。書いた内容は、そのカルテを直して書き足してください。',
    }),
    changeExisting: text({ en: 'Edit that chart', ja: 'そのカルテを直す' }),
    failed: text({
      en: 'Could not create the chart. Check your connection and try again.',
      ja: 'カルテを作れませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  change: {
    submit: text({ en: 'Save changes', ja: '変更を保存する' }),
    done: (name: string) =>
      text({
        en: `Saved the chart of ${honored(name).en}.`,
        ja: `${honored(name).ja}のカルテを直しました。`,
      }),
    failed: text({
      en: 'Could not save the chart. Check your connection and try again.',
      ja: 'カルテを直せませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
}
