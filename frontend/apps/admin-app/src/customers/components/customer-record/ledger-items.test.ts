import { type LocalizedText, textIn } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import { aCustomer } from '../../../bookings/components/examples'
import { changedItemsOf, changedTermsOf } from './ledger-items'

const noReferrer = (): null => null

/** How a screen in Japanese says the items, and one in English */
const inJapanese = (message: LocalizedText): string => textIn(message, 'ja')
const inEnglish = (message: LocalizedText): string => textIn(message, 'en')

describe('changedTermsOf', () => {
  it('should name the items that show the values, in the order of the page, and a value the ledger does not know as the API names it', () => {
    // Act
    const terms = changedTermsOf([
      'internalNotes',
      'city',
      'visitCount',
      'postalCode',
      'lastName',
    ])

    // Assert
    expect(terms).toEqual([
      { en: 'Name', ja: 'お名前' },
      { en: 'Address', ja: '住所' },
      { en: 'Notes between staff', ja: 'スタッフ間の申し送り' },
      'visitCount',
    ])
  })

  it('should name both items that show the preferences', () => {
    // Act, Assert
    expect(changedTermsOf(['preferences'])).toEqual([
      { en: 'Favorite services', ja: '好みのメニュー' },
      { en: 'Notes on preferences', ja: '好みについてのメモ' },
    ])
  })

  it('should name nothing for no value', () => {
    // Act, Assert
    expect(changedTermsOf([])).toEqual([])
  })
})

describe('changedItemsOf', () => {
  it('should show what an item showed before beside what it shows after', () => {
    // Act
    const changed = changedItemsOf(
      aCustomer(),
      aCustomer({
        phoneNumber: '080-3333-4444',
        alternativePhone: '03-1234-5678',
      }),
      noReferrer,
      inJapanese,
    )

    // Assert
    expect(changed).toEqual([
      { term: '電話番号', before: '090-1234-5678', after: '080-3333-4444' },
      { term: '予備の電話番号', before: null, after: '03-1234-5678' },
    ])
  })

  it('should leave out an item that shows the same, though the value it shows a part of changed', () => {
    // Act
    const changed = changedItemsOf(
      aCustomer({
        preferences: { preferredServices: ['cut'], notes: '静かに過ごしたい' },
      }),
      aCustomer({
        preferences: {
          preferredServices: ['cut', 'color'],
          notes: '静かに過ごしたい',
        },
      }),
      noReferrer,
      inJapanese,
    )

    // Assert
    expect(changed.map(({ term }) => term)).toEqual(['好みのメニュー'])
  })

  it('should take no preferences as preferences that hold nothing', () => {
    // Act
    const changed = changedItemsOf(
      aCustomer({ preferences: null }),
      aCustomer({ preferences: { preferredServices: [], notes: null } }),
      noReferrer,
      inJapanese,
    )

    // Assert
    expect(changed).toEqual([])
  })

  it('should show the customer who referred them as the screen does', () => {
    // Act
    const changed = changedItemsOf(
      aCustomer({ referredBy: null }),
      aCustomer({ referredBy: 'c19f4d7a-6e8c-4adf-8dbe-ac7e3f6a8bc5' }),
      ({ referredBy }) => `紹介: ${referredBy}`,
      inJapanese,
    )

    // Assert
    expect(changed).toEqual([
      {
        term: '紹介元',
        before: 'なし',
        after: '紹介: c19f4d7a-6e8c-4adf-8dbe-ac7e3f6a8bc5',
      },
    ])
  })

  it('should say the items and what they show in the language it is given', () => {
    // Act
    const changed = changedItemsOf(
      aCustomer({
        membershipTier: 'regular',
        isActive: true,
        referralCode: null,
      }),
      aCustomer({
        membershipTier: 'gold',
        isActive: false,
        referralCode: 'HANAKO-2026',
      }),
      noReferrer,
      inEnglish,
    )

    // Assert
    expect(changed).toEqual([
      { term: 'Membership rank', before: 'Regular', after: 'Gold' },
      {
        term: 'Active',
        before: 'Active',
        after: 'Inactive (cannot book by themselves)',
      },
      { term: 'Referral code', before: 'Not issued', after: 'HANAKO-2026' },
    ])
  })
})
