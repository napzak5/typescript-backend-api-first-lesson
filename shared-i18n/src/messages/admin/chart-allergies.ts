import { type LocalizedText, text } from '../../languages/localized-text'
import { uiMessages } from '../ui/components'
import { followed } from '../written'
import { honored } from './customer-words'

/*
 * The allergies of a customer, which the chart shows first: the kinds and
 * the severities, the list with the removal of one recorded by mistake,
 * and the form that records one and changes one. The allergens, the
 * symptoms and the notes stand as they were written.
 */

/** Who removes an allergy recorded by mistake */
const REMOVED_BY_OTHERS = text({
  en: 'Owners and managers can remove an allergy recorded by mistake.',
  ja: '間違えて記録したアレルギーの削除は、オーナーとマネージャーができます。',
})

/** An allergy of a customer, as a sentence names it: 「山田 花子 様のアレルギー（PPD）」 */
const allergyOf = (name: string, allergen: string): LocalizedText =>
  text({
    en: `the allergy (${allergen}) of ${honored(name).en}`,
    ja: `${honored(name).ja}のアレルギー（${allergen}）`,
  })

export const chartAllergies = {
  /** The kind of an allergy: 「香料」 */
  types: {
    chemical: text({ en: 'Chemical', ja: '化学物質' }),
    fragrance: text({ en: 'Fragrance', ja: '香料' }),
    metal: text({ en: 'Metal', ja: '金属' }),
    latex: text({ en: 'Latex', ja: 'ラテックス' }),
    plant: text({ en: 'Plant', ja: '植物' }),
    other: text({ en: 'Other', ja: 'その他' }),
  },
  /** How heavy an allergy is: 「命に関わる」 */
  severities: {
    mild: text({ en: 'Mild', ja: '軽い' }),
    moderate: text({ en: 'Moderate', ja: '中程度' }),
    severe: text({ en: 'Severe', ja: '重い' }),
    life_threatening: text({ en: 'Life-threatening', ja: '命に関わる' }),
  },
  words: {
    allergies: text({ en: 'Allergies', ja: 'アレルギー' }),
    allergen: text({ en: 'Allergen', ja: 'アレルゲン' }),
    severity: text({ en: 'Severity', ja: '重篤度' }),
    type: text({ en: 'Type', ja: '種類' }),
    symptoms: text({ en: 'Symptoms', ja: '症状' }),
    notes: text({ en: 'Care during a treatment', ja: '施術のときの注意' }),
    confirmedDate: text({ en: 'Confirmed on', ja: '確かめた日' }),
  },
  list: {
    record: text({ en: 'Record an allergy', ja: 'アレルギーを記録する' }),
    caption: text({ en: 'List of allergies', ja: 'アレルギーの一覧' }),
    none: text({
      en: 'No allergies recorded',
      ja: 'アレルギーの記録はありません',
    }),
    actions: text({ en: 'Actions', ja: '操作' }),
    /** The day an allergy was confirmed on is not known */
    unknownDate: text({ en: 'Unknown', ja: '不明' }),
    change: text({ en: 'Edit', ja: '直す' }),
    changeOf: (allergen: string) =>
      text({
        en: `Edit the record of ${allergen}`,
        ja: `${allergen}の記録を直す`,
      }),
    remove: text({ en: 'Remove', ja: '削除' }),
    removeOf: (allergen: string) =>
      text({
        en: `Remove the record of ${allergen}`,
        ja: `${allergen}の記録を削除する`,
      }),
    removedByOthers: REMOVED_BY_OTHERS,
  },
  removal: {
    title: (allergen: string) =>
      text({
        en: `Remove the record of ${allergen}?`,
        ja: `${allergen}の記録を削除しますか？`,
      }),
    description: text({
      en: 'Removes an allergy recorded by mistake from the chart. A removed record cannot be restored.',
      ja: '間違えて記録したアレルギーを、カルテから削除します。削除した記録は、元に戻せません。',
    }),
    back: uiMessages.back,
    submit: text({ en: 'Remove', ja: '削除する' }),
    done: (name: string, allergen: string) =>
      text({
        en: `Removed the record of ${allergyOf(name, allergen).en}.`,
        ja: `${allergyOf(name, allergen).ja}の記録を削除しました。`,
      }),
    /** Another account removed the allergy meanwhile */
    gone: text({
      en: 'Another account removed this allergy record meanwhile.',
      ja: 'その間に、ほかのアカウントがこのアレルギーの記録を削除していました。',
    }),
    /** The role of the account changed meanwhile */
    forbidden: followed(
      text({
        en: 'This account cannot remove allergy records.',
        ja: 'このアカウントでは、アレルギーの記録を削除できません。',
      }),
      REMOVED_BY_OTHERS,
    ),
    failed: text({
      en: 'Could not remove the allergy record. Check your connection and try again.',
      ja: 'アレルギーの記録を削除できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  form: {
    allergenDescription: text({
      en: 'The name of an ingredient of a product, a fragrance, a metal or the like. A customer has one record of an allergen.',
      ja: '薬剤の成分、香料、金属などの名前。お客様 1 人に、同じアレルゲンは 1 件です。',
    }),
    choose: text({ en: 'Choose', ja: '選んでください' }),
    symptomsDescription: text({
      en: 'The symptoms it gave. Leave it empty not to record them.',
      ja: '出た症状。記録しなければ空のままにします。',
    }),
    notesDescription: text({
      en: 'Such as the products not to use, and what to use instead.',
      ja: '使わない薬剤や、代わりに使うものなど。',
    }),
    confirmedDateDescription: text({
      en: 'The day it was confirmed in a consultation or a patch test. Leave it empty if it is not known.',
      ja: 'カウンセリングやパッチテストで確かめた日。分からなければ空のままにします。',
    }),
    /** What the API refused, and what the form found wrong */
    errors: {
      typeMissing: text({
        en: 'Choose the type.',
        ja: '種類を選んでください。',
      }),
      allergenMissing: text({
        en: 'Enter the allergen.',
        ja: 'アレルゲンを入力してください。',
      }),
      severityMissing: text({
        en: 'Choose the severity.',
        ja: '重篤度を選んでください。',
      }),
      dateNotADay: text({
        en: 'Enter the day it was confirmed on as a date.',
        ja: '確かめた日を、日付で入力してください。',
      }),
      dateTooEarly: text({
        en: 'Make the day it was confirmed on January 1, 1900 or later.',
        ja: '確かめた日は、1900年1月1日以降にしてください。',
      }),
      dateTooLate: text({
        en: 'Make the day it was confirmed on today or earlier.',
        ja: '確かめた日は、今日までにしてください。',
      }),
      /** The customer has an allergy of the allergen already */
      allergenExists: text({
        en: 'This customer has a record of the same allergen already.',
        ja: 'このお客様には、同じアレルゲンの記録があります。',
      }),
    },
    /** The account may not record allergies */
    forbidden: text({
      en: 'This account cannot record allergies.',
      ja: 'このアカウントでは、アレルギーを記録できません。',
    }),
  },
  entry: {
    submit: text({ en: 'Record', ja: '記録する' }),
    done: (name: string, allergen: string) =>
      text({
        en: `Recorded ${allergyOf(name, allergen).en}.`,
        ja: `${allergyOf(name, allergen).ja}を記録しました。`,
      }),
    failed: text({
      en: 'Could not record the allergy. Check your connection and try again.',
      ja: 'アレルギーを記録できませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  change: {
    submit: text({ en: 'Save changes', ja: '変更を保存する' }),
    done: (name: string, allergen: string) =>
      text({
        en: `Saved the record of ${allergyOf(name, allergen).en}.`,
        ja: `${allergyOf(name, allergen).ja}の記録を直しました。`,
      }),
    failed: text({
      en: 'Could not save the allergy record. Check your connection and try again.',
      ja: 'アレルギーの記録を直せませんでした。通信の状態を確かめて、もう一度お試しください。',
    }),
  },
  /** A screen of an allergy when there is none to show */
  notFound: text({
    en: 'This allergy record does not exist. Another account may have removed it.',
    ja: 'このアレルギーの記録は、ありません。ほかのアカウントが削除したのかもしれません。',
  }),
}
