import type {
  ModelsServiceCategoryResponse,
  ModelsServiceResponse,
} from '@beauty-salon-frontend/api-client'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import {
  aCategory,
  aDiscountedColour,
  aPackage,
  aService,
  CATEGORIES_OF_THE_MENU,
  colouring,
  highlights,
} from '../components/examples'
import {
  AVAILABILITY_OPTIONS,
  availabilityNameOf,
  categoriesById,
  categoryPathOf,
  categoryStateOf,
  menuSectionsOf,
  nextDisplayOrderOf,
  nextSortOrderOf,
  OPTION_TYPE_OPTIONS,
  optionTypeNameOf,
  PRICING_OPTIONS,
  packagedChoicesOf,
  packagesOf,
  parentChoicesOf,
  priceLineOf,
  pricingNameOf,
  REQUIREMENT_OPTIONS,
  requirementNameOf,
  SERVICE_STATUS_OPTIONS,
  serviceStateOf,
  serviceStatusNameOf,
} from './menu-format'

/** A category below another, by their IDs */
const below = (id: string, parentId: string | null) =>
  aCategory({ id, name: id, parentId })

describe('the names of the values of a service', () => {
  it('should name them with the words of the contract', () => {
    expect([
      pricingNameOf('consultation_based'),
      serviceStatusNameOf('discontinued'),
      availabilityNameOf('weekends_only'),
      requirementNameOf('advance_booking_required'),
      optionTypeNameOf('duration_extension'),
    ]).toEqual([
      { en: 'Price on consultation', ja: '要相談' },
      { en: 'Discontinued', ja: '廃止' },
      { en: 'Weekends only', ja: '週末のみ' },
      { en: 'Advance booking required', ja: '事前予約必須' },
      { en: 'Time extension', ja: '時間延長' },
    ])
  })
})

describe('serviceStateOf', () => {
  it.each<
    [
      string,
      Pick<ModelsServiceResponse, 'isActive' | 'serviceStatus'>,
      LocalizedText,
    ]
  >([
    [
      'on and given',
      { isActive: true, serviceStatus: 'active' },
      { en: 'Active', ja: '有効' },
    ],
    [
      'off',
      { isActive: false, serviceStatus: 'active' },
      { en: 'Inactive', ja: '無効' },
    ],
    [
      'off and coming soon',
      { isActive: false, serviceStatus: 'coming_soon' },
      { en: 'Inactive · Coming soon', ja: '無効・近日公開' },
    ],
    [
      'on and paused',
      { isActive: true, serviceStatus: 'inactive' },
      { en: 'Active · Paused', ja: '有効・一時停止' },
    ],
  ])('should name a service that is %s', (_, service, state) => {
    expect(serviceStateOf(service)).toEqual(state)
  })
})

describe('categoryStateOf', () => {
  it('should say whether a category is switched on', () => {
    expect([aCategory(), highlights()].map(categoryStateOf)).toEqual([
      { en: 'Active', ja: '有効' },
      { en: 'Inactive', ja: '無効' },
    ])
  })
})

describe('priceLineOf', () => {
  it.each<[string, ModelsServiceResponse, LocalizedText]>([
    [
      'a fixed price with tax',
      aService(),
      { en: '¥5,500 · Tax included', ja: '￥5,500・税込' },
    ],
    [
      'a price on a discount, without tax, that depends on the hair',
      aDiscountedColour(),
      {
        en: '¥7,200 (discounted from ¥8,000) · Before tax · Variable price',
        ja: '￥7,200（￥8,000 から割引）・税別・変動価格',
      },
    ],
  ])('should name %s', (_, service, line) => {
    expect(priceLineOf(service, 'JPY')).toEqual(line)
  })
})

describe('categoryPathOf', () => {
  const tree = [
    below('top', null),
    below('middle', 'top'),
    below('bottom', 'middle'),
    below('orphan', 'unread'),
    below('one', 'other'),
    below('other', 'one'),
  ]
  const byId = categoriesById(tree)

  it.each<[string, string, string]>([
    ['of the top', 'top', 'top'],
    ['below another', 'middle', 'top › middle'],
    ['two below', 'bottom', 'top › middle › bottom'],
    ['below one that was not read', 'orphan', 'orphan'],
    ['in a circle', 'one', 'one › other › one'],
  ])('should name a category %s', (_, id, path) => {
    const category = byId.get(id) ?? aCategory()

    expect(categoryPathOf(category, byId)).toBe(path)
  })
})

describe('menuSectionsOf', () => {
  it('should give every category its services, in the order of the menu, and the services of none last', () => {
    // Act
    const sections = menuSectionsOf(CATEGORIES_OF_THE_MENU, [
      aService(),
      aDiscountedColour(),
      aPackage(),
      aService({ id: 'lost', categoryId: 'removed' }),
    ])

    // Assert
    expect(
      sections.map(({ category, services }) => [
        category?.name ?? null,
        services.map(({ id }) => id),
      ]),
    ).toEqual([
      ['カット', [aService().id]],
      ['カラー', [aDiscountedColour().id]],
      ['ハイライト', []],
      [null, [aPackage().id, 'lost']],
    ])
  })

  it('should have no part of the services of none when every service has a category', () => {
    // Act
    const sections = menuSectionsOf(CATEGORIES_OF_THE_MENU, [aService()])

    // Assert
    expect(sections.map(({ category }) => category?.id ?? null)).toEqual(
      CATEGORIES_OF_THE_MENU.map(({ id }) => id),
    )
  })
})

describe('parentChoicesOf', () => {
  const tree: ModelsServiceCategoryResponse[] = [
    below('a', null),
    below('a1', 'a'),
    below('a11', 'a1'),
    below('a12', 'a1'),
    below('b', null),
    below('b1', 'b'),
  ]
  const idsOf = (categories: readonly ModelsServiceCategoryResponse[]) =>
    categories.map(({ id }) => id)

  it('should offer a new category every category', () => {
    expect(idsOf(parentChoicesOf(tree, null))).toEqual(idsOf(tree))
  })

  it.each<[string, string, string[]]>([
    ['the top of a branch', 'a', ['b', 'b1']],
    ['the middle of a branch', 'a1', ['a', 'b', 'b1']],
    ['a leaf', 'a12', ['a', 'a1', 'a11', 'b', 'b1']],
  ])(
    'should offer %s neither itself nor what is below it',
    (_, id, choices) => {
      expect(idsOf(parentChoicesOf(tree, id))).toEqual(choices)
    },
  )
})

describe('nextDisplayOrderOf', () => {
  it.each<
    [string, Pick<ModelsServiceCategoryResponse, 'displayOrder'>[], number]
  >([
    ['no categories', [], 0],
    ['the categories of the menu', CATEGORIES_OF_THE_MENU, 4],
    [
      'categories out of order',
      [{ displayOrder: 7 }, colouring(), { displayOrder: 0 }],
      8,
    ],
  ])('should put a new category after %s', (_, categories, order) => {
    expect(nextDisplayOrderOf(categories)).toBe(order)
  })
})

describe('the choices of the values of a service', () => {
  it('should offer every value of the contract, in its order, by its name', () => {
    expect(PRICING_OPTIONS.map(({ label }) => label)).toEqual([
      { en: 'Fixed price', ja: '固定価格' },
      { en: 'Variable price', ja: '変動価格' },
      { en: 'Tiered price', ja: '段階価格' },
      { en: 'Dynamic price', ja: '動的価格' },
      { en: 'Price on consultation', ja: '要相談' },
    ])
    expect(SERVICE_STATUS_OPTIONS.map(({ value }) => value)).toEqual([
      'active',
      'inactive',
      'coming_soon',
      'discontinued',
    ])
    expect(AVAILABILITY_OPTIONS.map(({ label }) => label)).toEqual([
      { en: 'Always', ja: '常時提供' },
      { en: 'Weekdays only', ja: '平日のみ' },
      { en: 'Weekends only', ja: '週末のみ' },
      { en: 'By appointment only', ja: '予約制' },
      { en: 'Seasonal', ja: '季節限定' },
    ])
    expect(REQUIREMENT_OPTIONS.map(({ value }) => value)).toEqual([
      'consultation_required',
      'patch_test_required',
      'advance_booking_required',
      'deposit_required',
    ])
    expect(OPTION_TYPE_OPTIONS.map(({ label }) => label)).toEqual([
      { en: 'Add-on', ja: 'アドオン' },
      { en: 'Upgrade', ja: 'アップグレード' },
      { en: 'Time extension', ja: '時間延長' },
      { en: 'Product choice', ja: '商品選択' },
    ])
  })
})

describe('nextSortOrderOf', () => {
  it('should put a new service after the last of the menu', () => {
    expect(
      nextSortOrderOf([aService({ sortOrder: 7 }), aService({ sortOrder: 2 })]),
    ).toBe(8)
  })

  it('should put the first service of a menu first', () => {
    expect(nextSortOrderOf([])).toBe(0)
  })
})

describe('packagedChoicesOf', () => {
  const services = [aService(), aDiscountedColour(), aPackage()]

  it('should offer a new package every service that is no package', () => {
    expect(packagedChoicesOf(services, null)).toEqual([
      aService(),
      aDiscountedColour(),
    ])
  })

  it('should not offer a service as one of its own services', () => {
    expect(packagedChoicesOf(services, aService().id)).toEqual([
      aDiscountedColour(),
    ])
  })
})

describe('packagesOf', () => {
  const services = [aService(), aDiscountedColour(), aPackage()]

  it('should find the packages a service is one of the services of', () => {
    expect(packagesOf(services, aDiscountedColour().id)).toEqual([aPackage()])
  })

  it('should find none for a service no package has', () => {
    expect(packagesOf(services, aPackage().id)).toEqual([])
  })
})
