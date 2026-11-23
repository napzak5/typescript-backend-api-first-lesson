import { describe, expect, it } from 'vitest'
import {
  brokenRules,
  MADE_UP_HEADLINE,
  SALON_ID,
} from '../../__tests__/fixtures/fixtures'
import {
  CATEGORY_ID,
  OTHER_CATEGORY_ID,
} from '../../__tests__/fixtures/service-category-fixtures'
import {
  nthServiceId,
  OTHER_SERVICE_ID,
  SERVICE_ID,
  serviceCreateRequest,
  serviceOptionRequest,
  THIRD_SERVICE_ID,
} from '../../__tests__/fixtures/service-fixtures'
import { parseWith } from '../../shared'
import {
  serviceBulkUpdateRequestSchema,
  serviceCreateRequestSchema,
  serviceSearchRequestSchema,
  serviceUpdateRequestSchema,
} from '../service.schema'

const rulesBrokenBy = (
  schema: Parameters<typeof parseWith>[0],
  input: unknown,
): string[] => {
  const result = parseWith(schema, input, MADE_UP_HEADLINE)
  return result.type === 'error' ? brokenRules(result.error) : []
}

/** The largest value of an `integer` column. */
const MAX_INTEGER = 2_147_483_647

/** An http URL of exactly `length` characters. */
const urlOfLength = (length: number): string => {
  const start = 'https://aoyama.example.com/images/'
  return `${start}${'a'.repeat(length - start.length)}`
}

/** `count` distinct service IDs. */
const serviceIds = (count: number): string[] =>
  Array.from({ length: count }, (_, index) => nthServiceId(index))

/** A request whose only option has the given changes. */
const withOption = (change: Record<string, unknown>) => ({
  options: [{ ...serviceOptionRequest(), ...change }],
})

/**
 * What breaks the rule of a property, in a create request and, when the
 * property is present, in an update request.
 */
const violations: [string, Record<string, unknown>, string[]][] = [
  [
    'a category that is not a UUID',
    { categoryId: 'cut' },
    ['categoryId:invalid_format'],
  ],
  [
    'a category that is a UUID with a character too many',
    { categoryId: `${CATEGORY_ID}0` },
    ['categoryId:invalid_format'],
  ],
  ['an empty category', { categoryId: '' }, ['categoryId:invalid_format']],
  ['an empty name', { name: '' }, ['name:invalid_format']],
  ['a name of only spaces', { name: '   ' }, ['name:invalid_format']],
  [
    'a name of only full-width spaces',
    { name: '　　' },
    ['name:invalid_format'],
  ],
  ['a name of 256 characters', { name: 'a'.repeat(256) }, ['name:too_big']],
  ['null as the name', { name: null }, ['name:invalid_type']],
  ['a name that is not text', { name: 42 }, ['name:invalid_type']],
  ['an empty description', { description: '' }, ['description:invalid_format']],
  [
    'a description of only whitespace',
    { description: ' \n\t' },
    ['description:invalid_format'],
  ],
  [
    'a description that is not text',
    { description: 42 },
    ['description:invalid_type'],
  ],
  [
    'a blank short description',
    { shortDescription: ' ' },
    ['shortDescription:invalid_format'],
  ],
  [
    'a short description of 501 characters',
    { shortDescription: 'a'.repeat(501) },
    ['shortDescription:too_big'],
  ],
  ['a duration of 0', { duration: 0 }, ['duration:too_small']],
  ['a negative duration', { duration: -30 }, ['duration:too_small']],
  ['a duration of 1441 minutes', { duration: 1441 }, ['duration:too_big']],
  [
    'a duration that is not a whole number',
    { duration: 1.5 },
    ['duration:invalid_type'],
  ],
  ['a duration that is text', { duration: '60' }, ['duration:invalid_type']],
  ['null as the duration', { duration: null }, ['duration:invalid_type']],
  ['a negative price', { price: -1 }, ['price:too_small']],
  [
    'a price above the largest integer of the column',
    { price: MAX_INTEGER + 1 },
    ['price:too_big'],
  ],
  [
    'a price that is not a whole number',
    { price: 6600.5 },
    ['price:invalid_type'],
  ],
  ['null as the price', { price: null }, ['price:invalid_type']],
  ['a negative discount', { discountPrice: -1 }, ['discountPrice:too_small']],
  [
    'a discount above the largest integer of the column',
    { discountPrice: MAX_INTEGER + 1 },
    ['discountPrice:too_big'],
  ],
  [
    'a discount that is not a whole number',
    { discountPrice: 0.5 },
    ['discountPrice:invalid_type'],
  ],
  [
    'taxIncluded as text',
    { taxIncluded: 'true' },
    ['taxIncluded:invalid_type'],
  ],
  ['null as taxIncluded', { taxIncluded: null }, ['taxIncluded:invalid_type']],
  [
    'requiresConsultation as a number',
    { requiresConsultation: 1 },
    ['requiresConsultation:invalid_type'],
  ],
  [
    'allowOnlineBooking as text',
    { allowOnlineBooking: 'yes' },
    ['allowOnlineBooking:invalid_type'],
  ],
  ['null as isActive', { isActive: null }, ['isActive:invalid_type']],
  [
    'a pricing strategy that does not exist',
    { pricingStrategy: 'free' },
    ['pricingStrategy:invalid_value'],
  ],
  [
    'a pricing strategy in capitals',
    { pricingStrategy: 'FIXED' },
    ['pricingStrategy:invalid_value'],
  ],
  [
    'null as the pricing strategy',
    { pricingStrategy: null },
    ['pricingStrategy:invalid_value'],
  ],
  [
    'a status that does not exist',
    { serviceStatus: 'paused' },
    ['serviceStatus:invalid_value'],
  ],
  [
    'null as the status',
    { serviceStatus: null },
    ['serviceStatus:invalid_value'],
  ],
  [
    'an availability that does not exist',
    { availability: 'holidays' },
    ['availability:invalid_value'],
  ],
  [
    'null as the availability',
    { availability: null },
    ['availability:invalid_value'],
  ],
  [
    'an image URL that is not a URL',
    { imageUrl: 'images/cut.jpg' },
    ['imageUrl:invalid_format'],
  ],
  [
    'an image URL that is neither http nor https',
    { imageUrl: 'ftp://aoyama.example.com/images/cut.jpg' },
    ['imageUrl:invalid_format'],
  ],
  ['an empty image URL', { imageUrl: '' }, ['imageUrl:invalid_format']],
  [
    'an image URL of 501 characters',
    { imageUrl: urlOfLength(501) },
    ['imageUrl:too_big'],
  ],
  ['null as the image URLs', { imageUrls: null }, ['imageUrls:invalid_type']],
  [
    'one image URL in place of a list',
    { imageUrls: 'https://aoyama.example.com/images/cut.jpg' },
    ['imageUrls:invalid_type'],
  ],
  [
    'an entry of the image URLs that is not a URL',
    {
      imageUrls: ['https://aoyama.example.com/images/cut.jpg', 'cut.jpg'],
    },
    ['imageUrls.1:invalid_format'],
  ],
  [
    'an entry of the image URLs that is neither http nor https',
    { imageUrls: ['ftp://aoyama.example.com/images/cut.jpg'] },
    ['imageUrls.0:invalid_format'],
  ],
  [
    'a staff level that does not exist',
    { requiredStaffLevel: 'master' },
    ['requiredStaffLevel:invalid_value'],
  ],
  [
    'a limit of 0 bookings a day',
    { maxBookingsPerDay: 0 },
    ['maxBookingsPerDay:too_small'],
  ],
  [
    'a limit of bookings above the largest integer of the column',
    { maxBookingsPerDay: MAX_INTEGER + 1 },
    ['maxBookingsPerDay:too_big'],
  ],
  [
    'a limit of bookings that is not a whole number',
    { maxBookingsPerDay: 2.5 },
    ['maxBookingsPerDay:invalid_type'],
  ],
  [
    'a booking requirement that does not exist',
    { bookingRequirements: ['deposit_required', 'walk_in'] },
    ['bookingRequirements.1:invalid_value'],
  ],
  [
    'the same booking requirement twice',
    {
      bookingRequirements: [
        'deposit_required',
        'patch_test_required',
        'deposit_required',
      ],
    },
    ['bookingRequirements.2:custom'],
  ],
  [
    'null as the booking requirements',
    { bookingRequirements: null },
    ['bookingRequirements:invalid_type'],
  ],
  ['isPackage as text', { isPackage: 'no' }, ['isPackage:invalid_type']],
  ['null as isPackage', { isPackage: null }, ['isPackage:invalid_type']],
  [
    'null as the members of a package',
    { packageServiceIds: null },
    ['packageServiceIds:invalid_type'],
  ],
  [
    'a member that is not a UUID',
    { packageServiceIds: [OTHER_SERVICE_ID, 'cut'] },
    ['packageServiceIds.1:invalid_format'],
  ],
  [
    '21 members',
    { packageServiceIds: serviceIds(21) },
    ['packageServiceIds:too_big'],
  ],
  [
    'the same member twice',
    {
      packageServiceIds: [OTHER_SERVICE_ID, THIRD_SERVICE_ID, OTHER_SERVICE_ID],
    },
    ['packageServiceIds.2:custom'],
  ],
  [
    'the same member twice, once in upper and once in lower case',
    { packageServiceIds: [OTHER_SERVICE_ID, OTHER_SERVICE_ID.toUpperCase()] },
    ['packageServiceIds.1:custom'],
  ],
  ['a blank tag', { tags: ['popular', ' '] }, ['tags.1:invalid_format']],
  ['an empty tag', { tags: [''] }, ['tags.0:invalid_format']],
  ['a tag that is not text', { tags: [42] }, ['tags.0:invalid_type']],
  ['null as the tags', { tags: null }, ['tags:invalid_type']],
  ['a negative sort order', { sortOrder: -1 }, ['sortOrder:too_small']],
  [
    'a sort order above the largest integer of the column',
    { sortOrder: MAX_INTEGER + 1 },
    ['sortOrder:too_big'],
  ],
  [
    'a sort order that is not a whole number',
    { sortOrder: 1.5 },
    ['sortOrder:invalid_type'],
  ],
  ['null as the options', { options: null }, ['options:invalid_type']],
  [
    'one option in place of a list',
    { options: serviceOptionRequest() },
    ['options:invalid_type'],
  ],
  [
    'an option that is not an object',
    { options: ['トリートメント'] },
    ['options.0:invalid_type'],
  ],
  [
    'an option with a blank name',
    withOption({ name: ' ' }),
    ['options.0.name:invalid_format'],
  ],
  [
    'an option with a name of 256 characters',
    withOption({ name: 'a'.repeat(256) }),
    ['options.0.name:too_big'],
  ],
  [
    'an option without a name',
    withOption({ name: null }),
    ['options.0.name:invalid_type'],
  ],
  [
    'an option with a blank description',
    withOption({ description: '' }),
    ['options.0.description:invalid_format'],
  ],
  [
    'an option of a type that does not exist',
    withOption({ optionType: 'gift' }),
    ['options.0.optionType:invalid_value'],
  ],
  [
    'an option without a type',
    withOption({ optionType: null }),
    ['options.0.optionType:invalid_value'],
  ],
  [
    'an option with a negative additional time',
    withOption({ additionalTime: -1 }),
    ['options.0.additionalTime:too_small'],
  ],
  [
    'an option with a negative additional price',
    withOption({ additionalPrice: -1 }),
    ['options.0.additionalPrice:too_small'],
  ],
  [
    'an option with an additional price above the largest integer of the column',
    withOption({ additionalPrice: MAX_INTEGER + 1 }),
    ['options.0.additionalPrice:too_big'],
  ],
  [
    'an option with a quantity of 0',
    withOption({ maxQuantity: 0 }),
    ['options.0.maxQuantity:too_small'],
  ],
  [
    'an option with a fractional quantity',
    withOption({ maxQuantity: 1.5 }),
    ['options.0.maxQuantity:invalid_type'],
  ],
  [
    'an option with a negative sort order',
    withOption({ sortOrder: -1 }),
    ['options.0.sortOrder:too_small'],
  ],
  [
    'an option with isRequired as text',
    withOption({ isRequired: 'no' }),
    ['options.0.isRequired:invalid_type'],
  ],
  [
    'an option with null as isActive',
    withOption({ isActive: null }),
    ['options.0.isActive:invalid_type'],
  ],
  [
    'an option with an ID',
    withOption({ id: SERVICE_ID }),
    ['options.0.id:unrecognized_keys'],
  ],
  [
    'an option that names its service and its timestamps',
    withOption({
      serviceId: SERVICE_ID,
      createdAt: '2026-11-14T09:00:00.000Z',
    }),
    [
      'options.0.serviceId:unrecognized_keys',
      'options.0.createdAt:unrecognized_keys',
    ],
  ],
  [
    'a second option that breaks a rule',
    {
      options: [
        serviceOptionRequest(),
        { ...serviceOptionRequest(), maxQuantity: 0 },
      ],
    },
    ['options.1.maxQuantity:too_small'],
  ],
  [
    'the salon, which is given by the path',
    { salonId: SALON_ID },
    ['salonId:unrecognized_keys'],
  ],
  [
    'the products a service needs, which no request writes',
    { requiredProducts: [] },
    ['requiredProducts:unrecognized_keys'],
  ],
  [
    'what the server assigns',
    {
      id: SERVICE_ID,
      createdAt: '2026-11-14T09:00:00.000Z',
      updatedAt: '2026-11-14T09:00:00.000Z',
      deletedAt: null,
    },
    [
      'id:unrecognized_keys',
      'createdAt:unrecognized_keys',
      'updatedAt:unrecognized_keys',
      'deletedAt:unrecognized_keys',
    ],
  ],
]

/** Values at the edge of a rule that still satisfy it. */
const accepted: [string, Record<string, unknown>][] = [
  ['a name of one character', { name: 'a' }],
  ['a name of 255 characters', { name: 'a'.repeat(255) }],
  ['a name with spaces around it', { name: '  カット  ' }],
  ['a description of any length', { description: 'a'.repeat(5000) }],
  [
    'a short description of 500 characters',
    { shortDescription: 'a'.repeat(500) },
  ],
  ['a duration of 1 minute', { duration: 1 }],
  ['a duration of a whole day', { duration: 1440 }],
  ['a price of 0', { price: 0, discountPrice: null }],
  ['the largest price the column holds', { price: MAX_INTEGER }],
  ['a discount of 0', { discountPrice: 0 }],
  ['a discount equal to the price', { price: 6600, discountPrice: 6600 }],
  ['a price without tax', { taxIncluded: false }],
  ['an http image URL', { imageUrl: 'http://aoyama.example.com/cut.jpg' }],
  ['an image URL of 500 characters', { imageUrl: urlOfLength(500) }],
  ['no image URLs', { imageUrls: [] }],
  [
    'several image URLs, http and https',
    {
      imageUrls: [
        'http://aoyama.example.com/1.jpg',
        'https://aoyama.example.com/2.jpg',
      ],
    },
  ],
  ['a limit of 1 booking a day', { maxBookingsPerDay: 1 }],
  ['the largest limit of bookings', { maxBookingsPerDay: MAX_INTEGER }],
  ['no booking requirements', { bookingRequirements: [] }],
  [
    'every booking requirement once',
    {
      bookingRequirements: [
        'consultation_required',
        'patch_test_required',
        'advance_booking_required',
        'deposit_required',
      ],
    },
  ],
  [
    'a package of two services',
    {
      isPackage: true,
      packageServiceIds: [OTHER_SERVICE_ID, THIRD_SERVICE_ID],
    },
  ],
  [
    'a package of 20 services',
    { isPackage: true, packageServiceIds: serviceIds(20) },
  ],
  ['no tags', { tags: [] }],
  ['tags with spaces around them', { tags: [' popular ', '新メニュー'] }],
  ['the same tag twice', { tags: ['popular', 'popular'] }],
  ['a sort order of 0', { sortOrder: 0 }],
  ['the largest sort order the column holds', { sortOrder: MAX_INTEGER }],
  ['an inactive service', { isActive: false }],
  [
    'an inactive service that is active by its status',
    { isActive: false, serviceStatus: 'active' },
  ],
  [
    'an active service that is discontinued by its status',
    { isActive: true, serviceStatus: 'discontinued' },
  ],
  ['no options', { options: [] }],
  [
    'an option at the lower edges of its numbers',
    withOption({
      additionalTime: 0,
      additionalPrice: 0,
      maxQuantity: 1,
      sortOrder: 0,
    }),
  ],
  [
    'an option at the upper edges of its numbers',
    withOption({
      name: 'a'.repeat(255),
      additionalTime: MAX_INTEGER,
      additionalPrice: MAX_INTEGER,
      maxQuantity: MAX_INTEGER,
      sortOrder: MAX_INTEGER,
    }),
  ],
  ['an option without a description', withOption({ description: null })],
  [
    'several options with the same name and sort order',
    { options: [serviceOptionRequest(), serviceOptionRequest()] },
  ],
]

/**
 * Requests that break a rule which ties properties together. The schema
 * leaves them to the use case: for an update the rule holds for the service
 * as it will be stored.
 */
const tiedRuleBreaches: [string, Record<string, unknown>][] = [
  ['a discount above the price', { price: 6600, discountPrice: 6601 }],
  ['a package of no service', { isPackage: true, packageServiceIds: [] }],
  [
    'a package of one service',
    { isPackage: true, packageServiceIds: [OTHER_SERVICE_ID] },
  ],
  [
    'members of a service that is not a package',
    {
      isPackage: false,
      packageServiceIds: [OTHER_SERVICE_ID, THIRD_SERVICE_ID],
    },
  ],
]

describe('serviceCreateRequestSchema', () => {
  it('accepts a request that satisfies every rule and returns it unchanged', () => {
    const request = serviceCreateRequest()

    const result = parseWith(
      serviceCreateRequestSchema,
      request,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: request })
  })

  it('reads the category and the members written in upper case as the lower-case IDs, the ones the database returns', () => {
    const result = parseWith(
      serviceCreateRequestSchema,
      {
        ...serviceCreateRequest(),
        categoryId: CATEGORY_ID.toUpperCase(),
        isPackage: true,
        packageServiceIds: [
          THIRD_SERVICE_ID.toUpperCase(),
          OTHER_SERVICE_ID.toUpperCase(),
        ],
      },
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({
      type: 'success',
      data: {
        ...serviceCreateRequest(),
        categoryId: CATEGORY_ID,
        isPackage: true,
        packageServiceIds: [THIRD_SERVICE_ID, OTHER_SERVICE_ID],
      },
    })
  })

  it('accepts null for the seven properties that may be unset and keeps it', () => {
    const request = {
      ...serviceCreateRequest(),
      categoryId: null,
      description: null,
      shortDescription: null,
      discountPrice: null,
      imageUrl: null,
      requiredStaffLevel: null,
      maxBookingsPerDay: null,
    }

    const result = parseWith(
      serviceCreateRequestSchema,
      request,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: request })
  })

  it.each([
    ['pricingStrategy', 'fixed'],
    ['pricingStrategy', 'variable'],
    ['pricingStrategy', 'tiered'],
    ['pricingStrategy', 'dynamic'],
    ['pricingStrategy', 'consultation_based'],
    ['serviceStatus', 'active'],
    ['serviceStatus', 'inactive'],
    ['serviceStatus', 'coming_soon'],
    ['serviceStatus', 'discontinued'],
    ['availability', 'always'],
    ['availability', 'weekdays_only'],
    ['availability', 'weekends_only'],
    ['availability', 'by_appointment_only'],
    ['availability', 'seasonal'],
    ['requiredStaffLevel', 'junior'],
    ['requiredStaffLevel', 'stylist'],
    ['requiredStaffLevel', 'senior'],
    ['requiredStaffLevel', 'expert'],
    ['requiredStaffLevel', 'director'],
  ])('accepts %s %s', (property, value) => {
    const rules = rulesBrokenBy(serviceCreateRequestSchema, {
      ...serviceCreateRequest(),
      [property]: value,
    })

    expect(rules).toEqual([])
  })

  it.each(['addon', 'upgrade', 'duration_extension', 'product_choice'])(
    'accepts an option of the type %s',
    (optionType) => {
      const rules = rulesBrokenBy(serviceCreateRequestSchema, {
        ...serviceCreateRequest(),
        ...withOption({ optionType }),
      })

      expect(rules).toEqual([])
    },
  )

  it.each(accepted)('accepts %s and keeps it as it is', (_case, change) => {
    const request = { ...serviceCreateRequest(), ...change }

    const result = parseWith(
      serviceCreateRequestSchema,
      request,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: request })
  })

  it('counts the characters of a name, not the units of its encoding', () => {
    // 𠮷 (U+20BB7, as in 𠮷野) lies outside the Basic Multilingual Plane.
    const rules = rulesBrokenBy(serviceCreateRequestSchema, {
      ...serviceCreateRequest(),
      name: '𠮷'.repeat(255),
    })

    expect(rules).toEqual([])
  })

  it.each(tiedRuleBreaches)(
    'leaves %s to the rules that tie properties together',
    (_case, change) => {
      const request = { ...serviceCreateRequest(), ...change }

      const result = parseWith(
        serviceCreateRequestSchema,
        request,
        MADE_UP_HEADLINE,
      )

      expect(result).toEqual({ type: 'success', data: request })
    },
  )

  it.each(violations)('rejects %s', (_case, change, expected) => {
    const rules = rulesBrokenBy(serviceCreateRequestSchema, {
      ...serviceCreateRequest(),
      ...change,
    })

    expect(rules).toEqual(expected)
  })

  it.each(Object.keys(serviceCreateRequest()))(
    'rejects a request that leaves %s out',
    (property) => {
      const request: Record<string, unknown> = serviceCreateRequest()
      const withoutProperty = Object.fromEntries(
        Object.entries(request).filter(([name]) => name !== property),
      )

      const rules = rulesBrokenBy(serviceCreateRequestSchema, withoutProperty)

      expect(rules.map((rule) => rule.replace(/:.*$/, ''))).toEqual([property])
    },
  )

  it('has 24 properties, every one of them required', () => {
    const rules = rulesBrokenBy(serviceCreateRequestSchema, {})

    expect(rules.map((rule) => rule.replace(/:.*$/, '')).toSorted()).toEqual(
      Object.keys(serviceCreateRequest()).toSorted(),
    )
    expect(rules).toHaveLength(24)
  })

  it.each([
    ['name', 'name:invalid_type'],
    ['options', 'options:invalid_type'],
    ['imageUrls', 'imageUrls:invalid_type'],
  ])(
    'rejects a request that leaves %s out as a broken rule of its type',
    (property, expected) => {
      const request: Record<string, unknown> = serviceCreateRequest()
      const withoutProperty = Object.fromEntries(
        Object.entries(request).filter(([name]) => name !== property),
      )

      expect(
        rulesBrokenBy(serviceCreateRequestSchema, withoutProperty),
      ).toEqual([expected])
    },
  )

  it.each(Object.keys(serviceOptionRequest()))(
    'rejects an option that leaves %s out',
    (property) => {
      const option: Record<string, unknown> = serviceOptionRequest()
      const withoutProperty = Object.fromEntries(
        Object.entries(option).filter(([name]) => name !== property),
      )

      const rules = rulesBrokenBy(serviceCreateRequestSchema, {
        ...serviceCreateRequest(),
        options: [withoutProperty],
      })

      expect(rules.map((rule) => rule.replace(/:.*$/, ''))).toEqual([
        `options.0.${property}`,
      ])
    },
  )

  it('reports every broken rule at once', () => {
    const rules = rulesBrokenBy(serviceCreateRequestSchema, {
      ...serviceCreateRequest(),
      name: ' ',
      duration: 0,
      pricingStrategy: 'free',
      tags: [''],
      salonId: SALON_ID,
      ...withOption({ maxQuantity: 0 }),
    })

    expect(rules.toSorted()).toEqual([
      'duration:too_small',
      'name:invalid_format',
      'options.0.maxQuantity:too_small',
      'pricingStrategy:invalid_value',
      'salonId:unrecognized_keys',
      'tags.0:invalid_format',
    ])
  })

  it.each([
    ['text', 'name=Cut'],
    ['a list', [serviceCreateRequest()]],
    ['null', null],
    ['nothing', undefined],
  ])('rejects %s in place of the request', (_case, input) => {
    expect(rulesBrokenBy(serviceCreateRequestSchema, input)).toEqual([
      ':invalid_type',
    ])
  })
})

describe('serviceUpdateRequestSchema', () => {
  it.each(Object.entries(serviceCreateRequest()))(
    'accepts a request with %s alone',
    (property, value) => {
      const request = { [property]: value }

      const result = parseWith(
        serviceUpdateRequestSchema,
        request,
        MADE_UP_HEADLINE,
      )

      expect(result).toEqual({ type: 'success', data: request })
    },
  )

  it('accepts every property together and returns the request unchanged', () => {
    const request = serviceCreateRequest()

    const result = parseWith(
      serviceUpdateRequestSchema,
      request,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: request })
  })

  it('reads the category and the members written in upper case as the lower-case IDs, the ones the database returns', () => {
    const result = parseWith(
      serviceUpdateRequestSchema,
      {
        categoryId: OTHER_CATEGORY_ID.toUpperCase(),
        packageServiceIds: [OTHER_SERVICE_ID.toUpperCase(), THIRD_SERVICE_ID],
      },
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({
      type: 'success',
      data: {
        categoryId: OTHER_CATEGORY_ID,
        packageServiceIds: [OTHER_SERVICE_ID, THIRD_SERVICE_ID],
      },
    })
  })

  it.each([
    'categoryId',
    'description',
    'shortDescription',
    'discountPrice',
    'imageUrl',
    'requiredStaffLevel',
    'maxBookingsPerDay',
  ])('accepts null for %s, which unsets it', (property) => {
    const request = { [property]: null }

    const result = parseWith(
      serviceUpdateRequestSchema,
      request,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: request })
  })

  it.each([
    ['name', 'name:invalid_type'],
    ['duration', 'duration:invalid_type'],
    ['price', 'price:invalid_type'],
    ['taxIncluded', 'taxIncluded:invalid_type'],
    ['pricingStrategy', 'pricingStrategy:invalid_value'],
    ['imageUrls', 'imageUrls:invalid_type'],
    ['requiresConsultation', 'requiresConsultation:invalid_type'],
    ['allowOnlineBooking', 'allowOnlineBooking:invalid_type'],
    ['bookingRequirements', 'bookingRequirements:invalid_type'],
    ['isPackage', 'isPackage:invalid_type'],
    ['packageServiceIds', 'packageServiceIds:invalid_type'],
    ['tags', 'tags:invalid_type'],
    ['sortOrder', 'sortOrder:invalid_type'],
    ['serviceStatus', 'serviceStatus:invalid_value'],
    ['availability', 'availability:invalid_value'],
    ['isActive', 'isActive:invalid_type'],
    ['options', 'options:invalid_type'],
  ])('rejects null for %s, which is never unset', (property, expected) => {
    const rules = rulesBrokenBy(serviceUpdateRequestSchema, {
      [property]: null,
    })

    expect(rules).toEqual([expected])
  })

  it.each(accepted)('accepts %s', (_case, change) => {
    const result = parseWith(
      serviceUpdateRequestSchema,
      change,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: change })
  })

  it.each([
    ...tiedRuleBreaches,
    ['isPackage alone', { isPackage: true }],
    ['members alone', { packageServiceIds: [OTHER_SERVICE_ID] }],
    ['a discount alone', { discountPrice: MAX_INTEGER }],
  ])(
    'leaves %s to the rules that tie properties together, which hold for the service as it will be stored',
    (_case, change) => {
      const result = parseWith(
        serviceUpdateRequestSchema,
        change,
        MADE_UP_HEADLINE,
      )

      expect(result).toEqual({ type: 'success', data: change })
    },
  )

  it.each(violations)(
    'rejects %s, as a create request does',
    (_case, change, expected) => {
      expect(rulesBrokenBy(serviceUpdateRequestSchema, change)).toEqual(
        expected,
      )
    },
  )

  it('rejects an empty request with one error for the request as a whole', () => {
    expect(rulesBrokenBy(serviceUpdateRequestSchema, {})).toEqual([':custom'])
  })

  it('accepts no options alone, which removes them', () => {
    expect(
      parseWith(serviceUpdateRequestSchema, { options: [] }, MADE_UP_HEADLINE),
    ).toEqual({ type: 'success', data: { options: [] } })
  })

  it('reports an unknown property as such, not as an empty request', () => {
    const rules = rulesBrokenBy(serviceUpdateRequestSchema, {
      salonId: SALON_ID,
    })

    expect(rules).toEqual(['salonId:unrecognized_keys'])
  })

  it('reports every broken rule at once', () => {
    const rules = rulesBrokenBy(serviceUpdateRequestSchema, {
      name: '',
      imageUrl: 'cut.jpg',
      isActive: 'no',
      ...withOption({ additionalTime: -1 }),
    })

    expect(rules.toSorted()).toEqual([
      'imageUrl:invalid_format',
      'isActive:invalid_type',
      'name:invalid_format',
      'options.0.additionalTime:too_small',
    ])
  })

  it.each([
    ['text', 'name=Cut'],
    ['a list', [{ name: 'Renamed' }]],
    ['null', null],
    ['nothing', undefined],
  ])('rejects %s in place of the request', (_case, input) => {
    expect(rulesBrokenBy(serviceUpdateRequestSchema, input)).toEqual([
      ':invalid_type',
    ])
  })
})

describe('serviceSearchRequestSchema', () => {
  it('accepts a request without any parameter', () => {
    expect(parseWith(serviceSearchRequestSchema, {}, MADE_UP_HEADLINE)).toEqual(
      {
        type: 'success',
        data: {},
      },
    )
  })

  it.each([
    ['the smallest limit', { limit: 1 }],
    ['the largest limit', { limit: 100 }],
    ['a cursor', { cursor: SERVICE_ID }],
    ['a category', { categoryId: CATEGORY_ID }],
    ['active services only', { isActive: true }],
    ['inactive services only', { isActive: false }],
    [
      'every parameter together',
      {
        limit: 50,
        cursor: SERVICE_ID,
        categoryId: CATEGORY_ID,
        isActive: false,
      },
    ],
  ])('accepts %s and returns the request unchanged', (_case, request) => {
    expect(
      parseWith(serviceSearchRequestSchema, request, MADE_UP_HEADLINE),
    ).toEqual({
      type: 'success',
      data: request,
    })
  })

  it('reads a cursor and a category written in upper case as the lower-case IDs, the ones the database returns', () => {
    expect(
      parseWith(
        serviceSearchRequestSchema,
        {
          cursor: SERVICE_ID.toUpperCase(),
          categoryId: CATEGORY_ID.toUpperCase(),
        },
        MADE_UP_HEADLINE,
      ),
    ).toEqual({
      type: 'success',
      data: { cursor: SERVICE_ID, categoryId: CATEGORY_ID },
    })
  })

  it.each([
    ['a limit of 0', { limit: 0 }, ['limit:too_small']],
    ['a negative limit', { limit: -1 }, ['limit:too_small']],
    ['a limit of 101', { limit: 101 }, ['limit:too_big']],
    ['a fractional limit', { limit: 1.5 }, ['limit:invalid_type']],
    ['a limit that is still text', { limit: '10' }, ['limit:invalid_type']],
    [
      'a cursor that is not an ID',
      { cursor: 'offset:20' },
      ['cursor:invalid_format'],
    ],
    ['an empty cursor', { cursor: '' }, ['cursor:invalid_format']],
    [
      'a category that is not an ID',
      { categoryId: 'cut' },
      ['categoryId:invalid_format'],
    ],
    [
      'isActive that is still text',
      { isActive: 'true' },
      ['isActive:invalid_type'],
    ],
    [
      'the salon, which is given by the path',
      { salonId: SALON_ID },
      ['salonId:unrecognized_keys'],
    ],
    [
      'a filter that the list does not have',
      { serviceStatus: 'active', isPackage: true },
      ['serviceStatus:unrecognized_keys', 'isPackage:unrecognized_keys'],
    ],
    [
      'a parameter that does not exist',
      { page: 2 },
      ['page:unrecognized_keys'],
    ],
  ])('rejects %s', (_case, input, expected) => {
    expect(rulesBrokenBy(serviceSearchRequestSchema, input)).toEqual(expected)
  })
})

describe('serviceBulkUpdateRequestSchema', () => {
  it.each([
    ['one service', [SERVICE_ID]],
    ['100 services', serviceIds(100)],
  ])(
    'accepts changes for %s and returns the request unchanged',
    (_case, ids) => {
      const request = { serviceIds: ids, updates: { price: 7000 } }

      const result = parseWith(
        serviceBulkUpdateRequestSchema,
        request,
        MADE_UP_HEADLINE,
      )

      expect(result).toEqual({ type: 'success', data: request })
    },
  )

  it('accepts every property of an update as the changes', () => {
    const request = {
      serviceIds: [SERVICE_ID, OTHER_SERVICE_ID],
      updates: serviceCreateRequest(),
    }

    const result = parseWith(
      serviceBulkUpdateRequestSchema,
      request,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: request })
  })

  it('reads the services and the IDs among the changes written in upper case as the lower-case IDs, keeping their order', () => {
    const result = parseWith(
      serviceBulkUpdateRequestSchema,
      {
        serviceIds: [OTHER_SERVICE_ID.toUpperCase(), SERVICE_ID],
        updates: {
          categoryId: CATEGORY_ID.toUpperCase(),
          packageServiceIds: [THIRD_SERVICE_ID.toUpperCase()],
        },
      },
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({
      type: 'success',
      data: {
        serviceIds: [OTHER_SERVICE_ID, SERVICE_ID],
        updates: {
          categoryId: CATEGORY_ID,
          packageServiceIds: [THIRD_SERVICE_ID],
        },
      },
    })
  })

  it.each([
    [
      'no service',
      { serviceIds: [], updates: { price: 7000 } },
      ['serviceIds:too_small'],
    ],
    [
      '101 services',
      { serviceIds: serviceIds(101), updates: { price: 7000 } },
      ['serviceIds:too_big'],
    ],
    [
      'a service ID that is not a UUID',
      { serviceIds: [SERVICE_ID, 'latest'], updates: { price: 7000 } },
      ['serviceIds.1:invalid_format'],
    ],
    [
      'the same service twice',
      {
        serviceIds: [SERVICE_ID, OTHER_SERVICE_ID, SERVICE_ID],
        updates: { price: 7000 },
      },
      ['serviceIds.2:custom'],
    ],
    [
      'the same service twice, once in upper and once in lower case',
      {
        serviceIds: [SERVICE_ID.toUpperCase(), SERVICE_ID],
        updates: { price: 7000 },
      },
      ['serviceIds.1:custom'],
    ],
    [
      'one service in place of a list',
      { serviceIds: SERVICE_ID, updates: { price: 7000 } },
      ['serviceIds:invalid_type'],
    ],
    [
      'no services at all',
      { updates: { price: 7000 } },
      ['serviceIds:invalid_type'],
    ],
    ['no changes', { serviceIds: [SERVICE_ID] }, ['updates:invalid_type']],
    [
      'null as the changes',
      { serviceIds: [SERVICE_ID], updates: null },
      ['updates:invalid_type'],
    ],
    [
      'empty changes',
      { serviceIds: [SERVICE_ID], updates: {} },
      ['updates:custom'],
    ],
    [
      'a change that breaks the rule of its property',
      { serviceIds: [SERVICE_ID], updates: { price: -1 } },
      ['updates.price:too_small'],
    ],
    [
      'null for a property that is never unset',
      { serviceIds: [SERVICE_ID], updates: { name: null } },
      ['updates.name:invalid_type'],
    ],
    [
      'an option among the changes that breaks a rule',
      {
        serviceIds: [SERVICE_ID],
        updates: withOption({ maxQuantity: 0 }),
      },
      ['updates.options.0.maxQuantity:too_small'],
    ],
    [
      'the same member twice among the changes',
      {
        serviceIds: [SERVICE_ID],
        updates: {
          packageServiceIds: [OTHER_SERVICE_ID, OTHER_SERVICE_ID.toUpperCase()],
        },
      },
      ['updates.packageServiceIds.1:custom'],
    ],
    [
      'the salon among the changes',
      { serviceIds: [SERVICE_ID], updates: { salonId: SALON_ID } },
      ['updates.salonId:unrecognized_keys'],
    ],
    [
      'a property the request does not have',
      { serviceIds: [SERVICE_ID], updates: { price: 7000 }, salonId: SALON_ID },
      ['salonId:unrecognized_keys'],
    ],
  ])('rejects %s', (_case, input, expected) => {
    expect(rulesBrokenBy(serviceBulkUpdateRequestSchema, input)).toEqual(
      expected,
    )
  })

  it('reports every broken rule at once', () => {
    const rules = rulesBrokenBy(serviceBulkUpdateRequestSchema, {
      serviceIds: [SERVICE_ID, 'latest', SERVICE_ID],
      updates: { price: -1, duration: 1441 },
    })

    expect(rules.toSorted()).toEqual([
      'serviceIds.1:invalid_format',
      'serviceIds.2:custom',
      'updates.duration:too_big',
      'updates.price:too_small',
    ])
  })

  it.each([
    ['text', 'serviceIds=1'],
    ['a list', [{ serviceIds: [SERVICE_ID], updates: { price: 7000 } }]],
    ['null', null],
    ['nothing', undefined],
  ])('rejects %s in place of the request', (_case, input) => {
    expect(rulesBrokenBy(serviceBulkUpdateRequestSchema, input)).toEqual([
      ':invalid_type',
    ])
  })
})
