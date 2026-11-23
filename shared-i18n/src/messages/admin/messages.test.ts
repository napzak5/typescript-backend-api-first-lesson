import { describe, expect, it } from 'vitest'
import type { LocalizedText } from '../../languages/localized-text'
import { JAPANESE, messagesOf } from '../__tests__/found-messages'
import { termMessages } from '../ui/terms'
import * as catalogues from './index'
import { adminCustomerMessages, adminStaffMessages } from './index'

const FOUND = messagesOf(catalogues, '')

const {
  choices,
  history,
  items,
  keeping,
  naming,
  notices,
  record,
  removed,
  restoration,
  table,
  use,
  version,
} = adminCustomerMessages

/** A moment and a period, as the formats write them */
const MOMENT = {
  en: 'Tue, November 24, 2026 at 10:30',
  ja: '2026年11月24日（火） 10:30',
}
const PERIOD = {
  en: 'Mon, November 24, 2025 – Tue, November 24, 2026',
  ja: '2025年11月24日（月）〜2026年11月24日（火）',
}

/** A name and its reading, which stand in every language as they were written */
const NAME = '山田 花子'
const KANA = 'ヤマダ ハナコ'

/** Every message that is made from a value, with the value and what it says */
const MADE: [string, LocalizedText, LocalizedText][] = [
  [
    'adminStaffMessages.named',
    adminStaffMessages.named('田中 美咲'),
    { en: '田中 美咲', ja: '田中 美咲' },
  ],
  [
    'adminCustomerMessages.naming.honored',
    naming.honored(NAME),
    { en: NAME, ja: '山田 花子 様' },
  ],
  [
    'adminCustomerMessages.naming.full',
    naming.full(NAME, KANA),
    { en: '山田 花子 (ヤマダ ハナコ)', ja: '山田 花子（ヤマダ ハナコ）' },
  ],
  [
    'adminCustomerMessages.naming.honoredFull',
    naming.honoredFull(NAME, KANA),
    { en: '山田 花子 (ヤマダ ハナコ)', ja: '山田 花子（ヤマダ ハナコ） 様' },
  ],
  [
    'adminCustomerMessages.table.chooseCustomer',
    table.chooseCustomer(NAME),
    { en: 'Select 山田 花子', ja: '山田 花子 様を選ぶ' },
  ],
  [
    'adminCustomerMessages.choices.thisCustomer',
    choices.thisCustomer(NAME),
    { en: '山田 花子 (this customer)', ja: '山田 花子（このお客様）' },
  ],
  [
    'adminCustomerMessages.notices.registered',
    notices.registered(NAME),
    {
      en: '山田 花子 was registered in the ledger.',
      ja: '山田 花子 様を台帳に登録しました。',
    },
  ],
  [
    'adminCustomerMessages.notices.removed',
    notices.removed(NAME),
    {
      en: '山田 花子 was removed from the ledger.',
      ja: '山田 花子 様を台帳から削除しました。',
    },
  ],
  [
    'adminCustomerMessages.notices.restored',
    notices.restored(NAME),
    {
      en: '山田 花子 was brought back to the ledger.',
      ja: '山田 花子 様を台帳に戻しました。',
    },
  ],
  [
    'adminCustomerMessages.record.visits.visitsOf',
    record.visits.visitsOf(12),
    { en: '12 visits', ja: '12 回' },
  ],
  [
    'adminCustomerMessages.record.visits.noShowsOf',
    record.visits.noShowsOf(1),
    { en: '1 no-show', ja: '1 回' },
  ],
  [
    'adminCustomerMessages.record.visits.cancellationsOf',
    record.visits.cancellationsOf(2),
    { en: '2 cancellations', ja: '2 回' },
  ],
  [
    'adminCustomerMessages.record.visits.pointsOf',
    record.visits.pointsOf(2500),
    { en: '2,500 points', ja: '2,500 ポイント' },
  ],
  [
    'adminCustomerMessages.items.listed',
    items.listed([
      termMessages.serviceCategory.cut,
      termMessages.serviceCategory.color,
    ]),
    { en: 'Cut, Color', ja: 'カット、カラー' },
  ],
  [
    'adminCustomerMessages.items.contactsOf',
    items.contactsOf([items.byEmail, items.bySms]),
    { en: 'Email, SMS', ja: 'メール、SMS' },
  ],
  [
    'adminCustomerMessages.items.hairOf',
    items.hairOf(
      termMessages.hairType.straight,
      termMessages.hairThickness.thin,
      termMessages.scalpCondition.dry,
    ) ?? { en: '', ja: '' },
    {
      en: 'Type: Straight; Thickness: Fine; Scalp: Dry',
      ja: 'ストレート、細い髪、頭皮は乾燥',
    },
  ],
  [
    'adminCustomerMessages.items.addressOf',
    items.addressOf(
      '150-0001',
      ['東京都', '渋谷区', '神宮前 4-1-1'],
      'ハイツ 101',
    ) ?? { en: '', ja: '' },
    {
      en: '150-0001 東京都 渋谷区 神宮前 4-1-1 ハイツ 101',
      ja: '〒150-0001 東京都渋谷区神宮前 4-1-1 ハイツ 101',
    },
  ],
  [
    'adminCustomerMessages.use.of',
    use.of(PERIOD),
    {
      en: 'Figures for Mon, November 24, 2025 – Tue, November 24, 2026',
      ja: '2025年11月24日（月）〜2026年11月24日（火）の集計',
    },
  ],
  [
    'adminCustomerMessages.use.bookingsOf',
    use.bookingsOf(3),
    { en: '3 bookings', ja: '3 件' },
  ],
  [
    'adminCustomerMessages.keeping.confirm',
    keeping.confirm(NAME),
    {
      en: 'Remove 山田 花子 from the ledger?',
      ja: '山田 花子 様を台帳から削除しますか？',
    },
  ],
  [
    'adminCustomerMessages.restoration.emailTaken',
    restoration.emailTaken('hanako@example.com'),
    {
      en: "A customer registered after the removal uses this customer's email address (hanako@example.com). Change that customer's email address, then bring this one back to the ledger.",
      ja: 'このお客様のメールアドレス（hanako@example.com）は、削除のあとに登録されたお客様が使っています。そのお客様のメールアドレスを変えてから、台帳に戻してください。',
    },
  ],
  [
    'adminCustomerMessages.removed.done',
    removed.done(MOMENT, history.changers.you, 'deleted'),
    {
      en: 'You removed this customer from the ledger on Tue, November 24, 2026 at 10:30.',
      ja: '2026年11月24日（火） 10:30 に、あなたが台帳から削除しました。',
    },
  ],
  [
    'adminCustomerMessages.history.versionOf',
    history.versionOf(3),
    { en: 'Version 3', ja: '版 3' },
  ],
  [
    'adminCustomerMessages.history.changedItems',
    history.changedItems([items.email, items.tags]),
    { en: 'Email address, Tags', ja: 'メールアドレス、タグ' },
  ],
  [
    'adminCustomerMessages.version.line',
    version.line([
      history.versionOf(3),
      history.operations.update,
      MOMENT,
      history.changers.you,
    ]),
    {
      en: 'Version 3 · Updated · Tue, November 24, 2026 at 10:30 · You',
      ja: '版 3・更新・2026年11月24日（火） 10:30・あなた',
    },
  ],
]

/** A name that stands inside a sentence: it begins as it stands there */
const INSIDE_A_SENTENCE = /\.names\./

/** The words that are written in Latin letters in every language */
const WRITTEN_ALIKE = [
  'adminCustomerMessages.statuses.vip',
  'adminCustomerMessages.items.bySms',
]

describe('the messages of the admin application', () => {
  it.each(
    FOUND.texts.filter(
      ([where]) =>
        !INSIDE_A_SENTENCE.test(where) && !WRITTEN_ALIKE.includes(where),
    ),
  )('should be written in each language: %s', (_where, written) => {
    // Assert
    expect(written.en).toMatch(/^[A-Z]/)
    expect(written.en).not.toMatch(JAPANESE)
    expect(written.ja).toMatch(JAPANESE)
  })

  it.each(FOUND.texts.filter(([where]) => INSIDE_A_SENTENCE.test(where)))(
    'should be written in each language as it stands inside a sentence: %s',
    (_where, written) => {
      // Assert
      expect(written.en).toMatch(/^[a-z]/)
      expect(written.en).not.toMatch(JAPANESE)
      expect(written.ja).toMatch(JAPANESE)
    },
  )

  it.each(FOUND.texts.filter(([where]) => WRITTEN_ALIKE.includes(where)))(
    'should be written alike in each language, in Latin letters: %s',
    (_where, written) => {
      // Assert
      expect(written.ja).toBe(written.en)
      expect(written.en).toMatch(/^[A-Z]+$/)
    },
  )

  it('should find every word that is written alike in the catalogues', () => {
    // Act
    const found = FOUND.texts
      .map(([where]) => where)
      .filter((where) => WRITTEN_ALIKE.includes(where))

    // Assert
    expect(found.toSorted()).toEqual(WRITTEN_ALIKE.toSorted())
  })

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
      FOUND.made.toSorted(),
    )
  })

  it('should name the customer alone when there is no reading of the name', () => {
    // Assert
    expect(naming.full(NAME, '')).toEqual({ en: NAME, ja: NAME })
    expect(naming.honoredFull(NAME, '')).toEqual({
      en: NAME,
      ja: '山田 花子 様',
    })
  })

  it('should say that no way of contact is allowed when none is', () => {
    // Assert
    expect(items.contactsOf([])).toEqual({
      en: 'None allowed',
      ja: '受け取らない',
    })
  })

  it('should say only what was recorded of the hair, and nothing when none was', () => {
    // Assert
    expect(items.hairOf(null, null, termMessages.scalpCondition.oily)).toEqual({
      en: 'Scalp: Oily',
      ja: '頭皮は脂性',
    })
    expect(items.hairOf(null, null, null)).toBeNull()
  })

  it('should write only the parts of an address that were recorded, and nothing when none was', () => {
    // Assert
    expect(items.addressOf(null, [], 'ハイツ 101')).toEqual({
      en: 'ハイツ 101',
      ja: 'ハイツ 101',
    })
    expect(items.addressOf(null, [], null)).toBeNull()
  })

  it('should say the items a version changed, and that there was none', () => {
    // Assert
    expect(history.changedItems([])).toEqual({ en: 'None', ja: 'なし' })
  })

  it('should say how a customer left the ledger, by whom and when', () => {
    // Assert
    expect(removed.done(MOMENT, history.changers.another, 'merged')).toEqual({
      en: 'Another account merged this customer into another on Tue, November 24, 2026 at 10:30.',
      ja: '2026年11月24日（火） 10:30 に、ほかのアカウントがほかのお客様に統合しました。',
    })
    expect(removed.done(MOMENT, history.changers.another, 'erased')).toEqual({
      en: 'Another account erased this customer on a deletion request on Tue, November 24, 2026 at 10:30.',
      ja: '2026年11月24日（火） 10:30 に、ほかのアカウントが削除の依頼で消去しました。',
    })
    expect(removed.done(MOMENT, null, 'deleted')).toEqual({
      en: 'Somebody removed this customer from the ledger on Tue, November 24, 2026 at 10:30.',
      ja: '2026年11月24日（火） 10:30 に、台帳から削除しました。',
    })
  })

  it('should say a refusal and who may do it, one sentence after another', () => {
    // Assert
    expect(adminCustomerMessages.removal.forbidden).toEqual({
      en: 'This account cannot remove customers from the ledger. Owners and managers remove customers from the ledger, merge them and read the change history.',
      ja: 'このアカウントでは、お客様を台帳から削除できません。台帳からの削除と統合、変更履歴は、オーナーとマネージャーができます。',
    })
  })
})
