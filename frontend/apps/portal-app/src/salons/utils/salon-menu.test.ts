import type {
  ModelsPricingStrategyType,
  ModelsServiceStatusType,
} from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { categories, services } from '../components/examples'
import { type MenuGroup, menuOf, priceOf } from './salon-menu'

/** A part of the menu by its name: the category's, or `unsorted` for the others */
const nameOf = (group: MenuGroup): string =>
  group.type === 'category' ? group.name : 'unsorted'

const FIXED: Parameters<typeof priceOf>[0] = {
  price: 5500,
  discountPrice: null,
  pricingStrategy: 'fixed',
  taxIncluded: true,
}

const NOT_ON_OFFER: ModelsServiceStatusType[] = [
  'inactive',
  'coming_soon',
  'discontinued',
]

const RISING: ModelsPricingStrategyType[] = ['variable', 'tiered', 'dynamic']

/** ￥5,500 as each language writes it */
const YEN_5500 = { en: '¥5,500', ja: '￥5,500' }

describe('menuOf', () => {
  it('should put the services under their categories, both in the order they are given, and the others last', () => {
    expect(
      menuOf(categories, services).map((group) => [
        nameOf(group),
        group.services.map((service) => service.name),
      ]),
    ).toEqual([
      ['カット', ['レディースカット', 'キッズカット（小学生まで）']],
      ['カラー', ['フルカラー', 'ハイライト']],
      ['unsorted', ['ブライダルヘアセット']],
    ])
  })

  it('should carry the ID and the description of a category, and none for the part of the others', () => {
    expect(
      menuOf(categories, services).map((group) =>
        group.type === 'category'
          ? [group.id, group.description]
          : [group.type],
      ),
    ).toEqual([
      [categories.at(0)?.id, 'シャンプーとブローを含みます。'],
      [categories.at(1)?.id, null],
      ['unsorted'],
    ])
  })

  it.each(NOT_ON_OFFER)(
    'should leave out a service that is %s',
    (serviceStatus) => {
      const menu = menuOf(
        categories,
        services.map((service) =>
          service.name === 'フルカラー'
            ? { ...service, serviceStatus }
            : service,
        ),
      )

      expect(
        menu.flatMap((group) => group.services.map((service) => service.name)),
      ).toEqual([
        'レディースカット',
        'キッズカット（小学生まで）',
        'ハイライト',
        'ブライダルヘアセット',
      ])
    },
  )

  it('should leave out a category that has no service on offer', () => {
    expect(
      menuOf(
        categories,
        services.filter((service) => service.categoryId === null),
      ).map(nameOf),
    ).toEqual(['unsorted'])
  })

  it('should have no part for the others when every service has a category that is shown', () => {
    expect(
      menuOf(
        categories,
        services.filter((service) => service.categoryId !== null),
      ).map(nameOf),
    ).toEqual(['カット', 'カラー'])
  })

  it('should put a service whose category is not among those shown under the others', () => {
    expect(
      menuOf(categories.slice(0, 1), services).map((group) => [
        nameOf(group),
        group.services.map((service) => service.name),
      ]),
    ).toEqual([
      ['カット', ['レディースカット', 'キッズカット（小学生まで）']],
      ['unsorted', ['フルカラー', 'ハイライト', 'ブライダルヘアセット']],
    ])
  })

  it('should be empty for a salon without a service', () => {
    expect(menuOf(categories, [])).toEqual([])
  })
})

describe('priceOf', () => {
  it('should be the amount for a fixed price, with the tax said', () => {
    expect(priceOf(FIXED, 'JPY')).toEqual({
      type: 'amount',
      amount: YEN_5500,
      before: null,
      orMore: false,
      tax: { en: '(tax included)', ja: '（税込）' },
    })
  })

  it('should say that the tax comes on top when it is not in the price', () => {
    expect(priceOf({ ...FIXED, taxIncluded: false }, 'JPY')).toMatchObject({
      tax: { en: '(plus tax)', ja: '（税別）' },
    })
  })

  it('should be the discounted amount, with the price before the discount', () => {
    expect(priceOf({ ...FIXED, discountPrice: 4950 }, 'JPY')).toMatchObject({
      amount: { en: '¥4,950', ja: '￥4,950' },
      before: YEN_5500,
    })
  })

  it('should name no price before a discount that takes nothing off', () => {
    expect(priceOf({ ...FIXED, discountPrice: 5500 }, 'JPY')).toMatchObject({
      amount: YEN_5500,
      before: null,
    })
  })

  it.each(RISING)(
    'should be where the price begins for a %s price',
    (pricingStrategy) => {
      expect(priceOf({ ...FIXED, pricingStrategy }, 'JPY')).toMatchObject({
        amount: YEN_5500,
        orMore: true,
      })
    },
  )

  it('should name no amount for a price that is agreed on in the consultation', () => {
    expect(
      priceOf(
        { ...FIXED, price: 0, pricingStrategy: 'consultation_based' },
        'JPY',
      ),
    ).toEqual({ type: 'onConsultation' })
  })

  it('should write the amount in the currency of the salon', () => {
    expect(priceOf({ ...FIXED, price: 45.5 }, 'USD')).toMatchObject({
      amount: { en: '$45.50', ja: '$45.50' },
    })
  })
})
