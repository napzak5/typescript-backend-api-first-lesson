import { serviceMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import { nthServiceId } from '../../../__tests__/fixtures/service-fixtures'
import { serviceRuleIssues } from '..'

/** The properties the rules tie together, of a service that keeps them all. */
const plainService = {
  price: 6600,
  discountPrice: 5940,
  isPackage: false,
  packageServiceIds: [],
}

/** `count` distinct service IDs. */
const members = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => nthServiceId(index))

/** The issues as `field:rule`. */
const rulesBrokenBy = (
  properties: Parameters<typeof serviceRuleIssues>[0],
): string[] =>
  serviceRuleIssues(properties).map(({ field, rule }) => `${field}:${rule}`)

describe('serviceRuleIssues', () => {
  it.each([
    ['a service with a discount below its price', plainService],
    [
      'a service with a discount equal to its price',
      { ...plainService, discountPrice: 6600 },
    ],
    ['a service with a discount of 0', { ...plainService, discountPrice: 0 }],
    ['a service without a discount', { ...plainService, discountPrice: null }],
    [
      'a free service without a discount',
      { ...plainService, price: 0, discountPrice: null },
    ],
    [
      'a free service with a discount of 0',
      { ...plainService, price: 0, discountPrice: 0 },
    ],
    [
      'a package of two services',
      { ...plainService, isPackage: true, packageServiceIds: members(2) },
    ],
    [
      'a package of 20 services',
      { ...plainService, isPackage: true, packageServiceIds: members(20) },
    ],
  ])('finds no issue with %s', (_case, properties) => {
    expect(serviceRuleIssues(properties)).toEqual([])
  })

  it('reports a discount above the price under discountPrice, with a message', () => {
    const issues = serviceRuleIssues({
      ...plainService,
      price: 6600,
      discountPrice: 6601,
    })

    expect(issues).toEqual([
      {
        field: 'discountPrice',
        rule: 'too_big',
        message: serviceMessages.notGreaterThanPrice,
      },
    ])
  })

  it('reports any discount of a free service as above the price', () => {
    expect(
      rulesBrokenBy({ ...plainService, price: 0, discountPrice: 1 }),
    ).toEqual(['discountPrice:too_big'])
  })

  it.each([
    ['no service', 0],
    ['one service', 1],
  ])('reports a package of %s as too small', (_case, count) => {
    expect(
      rulesBrokenBy({
        ...plainService,
        isPackage: true,
        packageServiceIds: members(count),
      }),
    ).toEqual(['packageServiceIds:too_small'])
  })

  it.each([
    ['one member', 1],
    ['two members', 2],
  ])(
    'reports %s of a service that is not a package as not allowed',
    (_case, count) => {
      expect(
        rulesBrokenBy({
          ...plainService,
          isPackage: false,
          packageServiceIds: members(count),
        }),
      ).toEqual(['packageServiceIds:not_allowed'])
    },
  )

  it('reports every broken rule at once', () => {
    expect(
      rulesBrokenBy({
        price: 1000,
        discountPrice: 2000,
        isPackage: true,
        packageServiceIds: members(1),
      }),
    ).toEqual(['discountPrice:too_big', 'packageServiceIds:too_small'])
    expect(
      rulesBrokenBy({
        price: 1000,
        discountPrice: 2000,
        isPackage: false,
        packageServiceIds: members(2),
      }),
    ).toEqual(['discountPrice:too_big', 'packageServiceIds:not_allowed'])
  })
})
