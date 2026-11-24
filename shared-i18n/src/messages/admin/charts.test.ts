import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import { messagesOf } from '../__tests__/found-messages'
import { adminChartMessages } from './index'

const { allergies, change, entry, form } = adminChartMessages

/** A name of a customer and an allergen, which stand in every language as they were written */
const NAME = '山田 花子'
const ALLERGEN = 'PPD'

/** Every message that is made from a value, with the value and what it says */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'adminChartMessages.form.row',
    form.row(2),
    { en: 'Treatment 2', ja: '2 件目の施術' },
  ],
  [
    'adminChartMessages.form.removeRow',
    form.removeRow(2),
    { en: 'Remove treatment 2', ja: '2 件目の施術を外す' },
  ],
  [
    'adminChartMessages.form.mostRows',
    form.mostRows(50),
    {
      en: 'Up to 50 past treatments can be written.',
      ja: '過去の施術は、50 件まで書けます。',
    },
  ],
  [
    'adminChartMessages.form.errors.tooManyProducts',
    form.errors.tooManyProducts(50),
    {
      en: 'Enter up to 50 products.',
      ja: '商材は、50 件までで入力してください。',
    },
  ],
  [
    'adminChartMessages.entry.done',
    entry.done(NAME),
    {
      en: 'Created the chart of 山田 花子.',
      ja: '山田 花子 様のカルテを作りました。',
    },
  ],
  [
    'adminChartMessages.change.done',
    change.done(NAME),
    {
      en: 'Saved the chart of 山田 花子.',
      ja: '山田 花子 様のカルテを直しました。',
    },
  ],
  [
    'adminChartMessages.allergies.list.changeOf',
    allergies.list.changeOf(ALLERGEN),
    { en: 'Edit the record of PPD', ja: 'PPDの記録を直す' },
  ],
  [
    'adminChartMessages.allergies.list.removeOf',
    allergies.list.removeOf(ALLERGEN),
    { en: 'Remove the record of PPD', ja: 'PPDの記録を削除する' },
  ],
  [
    'adminChartMessages.allergies.removal.title',
    allergies.removal.title(ALLERGEN),
    { en: 'Remove the record of PPD?', ja: 'PPDの記録を削除しますか？' },
  ],
  [
    'adminChartMessages.allergies.removal.done',
    allergies.removal.done(NAME, ALLERGEN),
    {
      en: 'Removed the record of the allergy (PPD) of 山田 花子.',
      ja: '山田 花子 様のアレルギー（PPD）の記録を削除しました。',
    },
  ],
  [
    'adminChartMessages.allergies.entry.done',
    allergies.entry.done(NAME, ALLERGEN),
    {
      en: 'Recorded the allergy (PPD) of 山田 花子.',
      ja: '山田 花子 様のアレルギー（PPD）を記録しました。',
    },
  ],
  [
    'adminChartMessages.allergies.change.done',
    allergies.change.done(NAME, ALLERGEN),
    {
      en: 'Saved the record of the allergy (PPD) of 山田 花子.',
      ja: '山田 花子 様のアレルギー（PPD）の記録を直しました。',
    },
  ],
]

describe('the messages of the charts of the admin application', () => {
  it.each(MADE)(
    'should name the value it is made from: %s',
    (_where, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should have a value in this test for every message that is made from one', () => {
    // Assert
    expect(MADE.map(([where]) => where).toSorted()).toEqual(
      messagesOf({ adminChartMessages }, '').made.toSorted(),
    )
  })

  it('should say a refused removal of an allergy and who removes one, one sentence after another', () => {
    // Assert
    expect(allergies.removal.forbidden).toEqual({
      en: 'This account cannot remove allergy records. Owners and managers can remove an allergy recorded by mistake.',
      ja: 'このアカウントでは、アレルギーの記録を削除できません。間違えて記録したアレルギーの削除は、オーナーとマネージャーができます。',
    })
  })
})
