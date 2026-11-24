import { describe, expect, it } from 'vitest'
import { numberOf } from '../../formats/numbers'
import type { LocalizedText } from '../../languages/localized-text'
import { messagesOf } from '../__tests__/found-messages'
import { adminShareLinkMessages } from './index'

const { form, values } = adminShareLinkMessages

const FILE = 'カラー同意書_田中様.pdf'

/** Every message that is made from a value, with the value and what it says */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'adminShareLinkMessages.fileOfSalon',
    adminShareLinkMessages.fileOfSalon(FILE, 'Salon Tokyo'),
    {
      en: 'カラー同意書_田中様.pdf (Salon Tokyo)',
      ja: 'カラー同意書_田中様.pdf（Salon Tokyo）',
    },
  ],
  [
    'adminShareLinkMessages.form.intro',
    form.intro(FILE),
    {
      en: 'Issues a link that shows “カラー同意書_田中様.pdf” to people who have no account.',
      ja: '「カラー同意書_田中様.pdf」を、アカウントを持たない人に見せるリンクを発行します。',
    },
  ],
  [
    'adminShareLinkMessages.form.daysOf',
    form.daysOf(7),
    { en: '7 days', ja: '7 日' },
  ],
  [
    'adminShareLinkMessages.form.errors.limit',
    form.errors.limit(numberOf(2_147_483_647)),
    {
      en: 'Enter the download limit as a whole number from 1 to 2,147,483,647. Leave it empty for no limit.',
      ja: '回数の上限は、1 から 2,147,483,647 までの整数で入力してください。上限を付けないときは、空のままにしてください。',
    },
  ],
  [
    'adminShareLinkMessages.values.timesOf',
    values.timesOf(1200),
    { en: '1,200 times', ja: '1,200 回' },
  ],
  [
    'adminShareLinkMessages.values.downloadsOf',
    values.downloadsOf(2, 3),
    { en: '2 times (limit: 3 times)', ja: '2 回（上限 3 回）' },
  ],
]

describe('the messages of the share links of the admin application', () => {
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
      messagesOf({ adminShareLinkMessages }, '').made.toSorted(),
    )
  })

  it.each<[string, LocalizedText, LocalizedText]>([
    ['day', form.daysOf(1), { en: '1 day', ja: '1 日' }],
    ['time', values.timesOf(1), { en: '1 time', ja: '1 回' }],
    [
      'download against a limit of one',
      values.downloadsOf(1, 1),
      { en: '1 time (limit: 1 time)', ja: '1 回（上限 1 回）' },
    ],
  ])(
    'should count one %s as one in English, and with the same word in Japanese',
    (_what, made, expected) => {
      // Assert
      expect(made).toEqual(expected)
    },
  )

  it('should say the downloads of a link that has no limit', () => {
    // Assert
    expect(values.downloadsOf(4, null)).toEqual({
      en: '4 times (no limit)',
      ja: '4 回（上限なし）',
    })
  })
})
