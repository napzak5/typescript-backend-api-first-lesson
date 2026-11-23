import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import type { ServicesChange } from '../api/menu-api'
import {
  aCategory,
  aDiscountedColour,
  aPackage,
  aService,
  CATEGORIES_OF_THE_MENU,
  colouring,
  SERVICES_OF_THE_MENU,
} from '../components/examples'
import {
  afterServicesChange,
  changedMessageOf,
  readServicesChange,
  refusesCategory,
  serviceChoicesOf,
} from './services-change'

/** A form with the services chosen and the values chosen; a value not named is kept. */
const formWith = (
  serviceIds: readonly string[],
  chosen: Record<string, string>,
): FormData => {
  const values = new FormData()
  for (const id of serviceIds) {
    values.append('serviceIds', id)
  }
  for (const name of [
    'categoryId',
    'isActive',
    'allowOnlineBooking',
    'serviceStatus',
    'availability',
    'requiredStaffLevel',
  ]) {
    values.set(name, chosen[name] ?? '')
  }

  return values
}

const refused = (
  ...fields: string[]
): Extract<ServicesChange, { type: 'invalid' }> => ({
  type: 'invalid',
  values: fields.map((field) => ({ field, rule: 'not_found' })),
})

describe('serviceChoicesOf', () => {
  it('should offer the services in the order of the menu, each with the path of its category', () => {
    expect(
      serviceChoicesOf(CATEGORIES_OF_THE_MENU, SERVICES_OF_THE_MENU),
    ).toEqual([
      {
        value: aService().id,
        label: { en: 'カット (カット)', ja: 'カット（カット）' },
      },
      {
        value: aDiscountedColour().id,
        label: { en: 'フルカラー (カラー)', ja: 'フルカラー（カラー）' },
      },
      {
        value: aPackage().id,
        label: {
          en: 'カットとカラー (Uncategorized)',
          ja: 'カットとカラー（未分類）',
        },
      },
    ])
  })

  it('should name a service of a category that was not read as one of none', () => {
    expect(serviceChoicesOf([], [aService()])).toEqual([
      {
        value: aService().id,
        label: { en: 'カット (Uncategorized)', ja: 'カット（未分類）' },
      },
    ])
  })
})

describe('readServicesChange', () => {
  it('should send the services chosen with every value chosen, and nothing of what is kept', () => {
    // Act
    const read = readServicesChange(
      formWith(['b', 'a'], {
        categoryId: colouring().id,
        isActive: 'off',
        allowOnlineBooking: 'on',
        serviceStatus: 'coming_soon',
        availability: 'weekends_only',
        requiredStaffLevel: 'senior',
      }),
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        serviceIds: ['b', 'a'],
        updates: {
          categoryId: colouring().id,
          isActive: false,
          allowOnlineBooking: true,
          serviceStatus: 'coming_soon',
          availability: 'weekends_only',
          requiredStaffLevel: 'senior',
        },
      },
    })
  })

  it.each<[string, Record<string, string>, Record<string, unknown>]>([
    ['the category taken away', { categoryId: 'none' }, { categoryId: null }],
    [
      'the level taken away',
      { requiredStaffLevel: 'none' },
      { requiredStaffLevel: null },
    ],
    ['a service switched on', { isActive: 'on' }, { isActive: true }],
    [
      'online booking stopped',
      { allowOnlineBooking: 'off' },
      { allowOnlineBooking: false },
    ],
    [
      'a state',
      { serviceStatus: 'discontinued' },
      { serviceStatus: 'discontinued' },
    ],
  ])('should send only %s', (_, chosen, updates) => {
    // Act
    const read = readServicesChange(formWith([aCategory().id], chosen))

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: { serviceIds: [aCategory().id], updates },
    })
  })

  it('should send nothing when no service was chosen', () => {
    expect(readServicesChange(formWith([], { isActive: 'off' }))).toEqual({
      type: 'invalid',
      says: {
        message: undefined,
        errors: {
          serviceIds: {
            en: 'Choose at least one service to change.',
            ja: '変えるサービスを、1 件以上選んでください。',
          },
        },
      },
    })
  })

  it('should send nothing when more services were chosen than the API changes at once', () => {
    // Arrange
    const many = Array.from({ length: 101 }, (_, index) => `s${index}`)

    // Act
    const read = readServicesChange(formWith(many, { isActive: 'off' }))

    // Assert
    expect(read).toEqual({
      type: 'invalid',
      says: {
        message: undefined,
        errors: {
          serviceIds: {
            en: 'Up to 100 services can be changed at once.',
            ja: '一度に変えられるサービスは、100 件までです。',
          },
        },
      },
    })
  })

  it('should take a hundred services', () => {
    // Arrange
    const hundred = Array.from({ length: 100 }, (_, index) => `s${index}`)

    // Act
    const read = readServicesChange(formWith(hundred, { isActive: 'off' }))

    // Assert
    expect(read.type).toBe('valid')
  })

  it('should send nothing when every value is kept, and say so', () => {
    expect(readServicesChange(formWith(['a'], {}))).toEqual({
      type: 'invalid',
      says: {
        message: {
          en: 'Choose at least one value to change. Left at “Keep”, nothing changes.',
          ja: '変える項目を、1 つ以上選んでください。「変えない」のままでは、何も変わりません。',
        },
        errors: {},
      },
    })
  })

  it('should keep a value that is none of the choices', () => {
    expect(
      readServicesChange(
        formWith(['a'], { serviceStatus: 'closed', isActive: 'off' }),
      ),
    ).toEqual({
      type: 'valid',
      value: { serviceIds: ['a'], updates: { isActive: false } },
    })
  })
})

describe('refusesCategory', () => {
  it.each<[string[], boolean]>([
    [['updates.categoryId'], true],
    [['updates.isActive', 'updates.categoryId'], true],
    [['serviceIds'], false],
  ])('should tell a refusal of %j as one of the category: %s', (fields, is) => {
    expect(refusesCategory(refused(...fields))).toBe(is)
  })
})

describe('afterServicesChange', () => {
  it('should say a category removed meanwhile at the category', () => {
    expect(afterServicesChange(refused('updates.categoryId'))).toEqual({
      message: undefined,
      errors: {
        categoryId: {
          en: 'This category was removed meanwhile. Choose the category again.',
          ja: 'このカテゴリーは、その間に削除されていました。カテゴリーを選び直してください。',
        },
      },
    })
  })

  it('should say a refusal of what the form has no control of above the form', () => {
    expect(
      afterServicesChange(refused('updates.categoryId', 'serviceIds')),
    ).toEqual({
      message: {
        en: 'Check what you entered and try again.',
        ja: '入力した内容を確かめて、もう一度お試しください。',
      },
      errors: {
        categoryId: {
          en: 'This category was removed meanwhile. Choose the category again.',
          ja: 'このカテゴリーは、その間に削除されていました。カテゴリーを選び直してください。',
        },
      },
    })
    expect(afterServicesChange(refused('serviceIds'))).toEqual({
      message: {
        en: 'Check what you entered and try again.',
        ja: '入力した内容を確かめて、もう一度お試しください。',
      },
      errors: {},
    })
  })

  it.each<[Parameters<typeof afterServicesChange>[0], LocalizedText]>([
    [
      { type: 'servicesGone' },
      {
        en: 'One of the chosen services was removed from the menu meanwhile. No service was changed. Choose again from the menu as it is now.',
        ja: '選んだサービスのどれかが、その間にメニューから削除されていました。どのサービスも変えていません。いまのメニューから、選び直してください。',
      },
    ],
    [
      { type: 'forbidden' },
      {
        en: 'The menu of this salon cannot be changed. Only the owners and managers of that salon, and administrators, can change its menu.',
        ja: 'このサロンのメニューは、変えられません。メニューを変えられるのは、そのサロンのオーナーとマネージャーと、管理者です。',
      },
    ],
    [
      { type: 'tooManyRequests' },
      {
        en: 'There are too many requests. Wait a while and try again.',
        ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
      },
    ],
    [
      { type: 'failed' },
      {
        en: 'The services could not be changed. Check your connection and try again.',
        ja: 'サービスを変えられませんでした。通信の状態を確かめて、もう一度お試しください。',
      },
    ],
  ])('should say what came of %j above the form', (outcome, message) => {
    expect(afterServicesChange(outcome)).toEqual({ message, errors: {} })
  })
})

describe('changedMessageOf', () => {
  it('should count the services that were changed', () => {
    expect(changedMessageOf(['a', 'b', 'c'])).toEqual({
      en: 'Changed 3 services.',
      ja: '3 件のサービスを変えました。',
    })
  })
})
