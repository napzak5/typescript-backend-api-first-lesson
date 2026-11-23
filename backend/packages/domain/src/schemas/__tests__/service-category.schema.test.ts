import { serviceCategoryMessages } from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it } from 'vitest'
import {
  brokenRules,
  MADE_UP_HEADLINE,
  SALON_ID,
} from '../../__tests__/fixtures/fixtures'
import {
  CATEGORY_ID,
  OTHER_CATEGORY_ID,
  serviceCategoryCreateRequest,
} from '../../__tests__/fixtures/service-category-fixtures'
import { parseWith } from '../../shared'
import {
  serviceCategoryCreateRequestSchema,
  serviceCategorySearchRequestSchema,
  serviceCategoryUpdateRequestSchema,
} from '../service-category.schema'

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
  const start = 'https://aoyama.example.com/icons/'
  return `${start}${'a'.repeat(length - start.length)}`
}

/**
 * What breaks the rule of a property, in a create request and, when the
 * property is present, in an update request.
 */
const violations: [string, Record<string, unknown>, string[]][] = [
  ['an empty name', { name: '' }, ['name:invalid_format']],
  ['a name of only spaces', { name: '   ' }, ['name:invalid_format']],
  [
    'a name of only full-width spaces',
    { name: '　　' },
    ['name:invalid_format'],
  ],
  ['a name of 101 characters', { name: 'a'.repeat(101) }, ['name:too_big']],
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
    'a parent that is not a UUID',
    { parentId: 'top' },
    ['parentId:invalid_format'],
  ],
  [
    'a parent that is a UUID with a character too many',
    { parentId: `${OTHER_CATEGORY_ID}0` },
    ['parentId:invalid_format'],
  ],
  ['an empty parent', { parentId: '' }, ['parentId:invalid_format']],
  [
    'a category that is not a kind of service',
    { category: 'nails' },
    ['category:invalid_value'],
  ],
  ['a category in capitals', { category: 'CUT' }, ['category:invalid_value']],
  ['null as the category', { category: null }, ['category:invalid_value']],
  [
    'a negative display order',
    { displayOrder: -1 },
    ['displayOrder:too_small'],
  ],
  [
    'a display order that is not a whole number',
    { displayOrder: 1.5 },
    ['displayOrder:invalid_type'],
  ],
  [
    'a display order above the largest integer of the column',
    { displayOrder: MAX_INTEGER + 1 },
    ['displayOrder:too_big'],
  ],
  [
    'a display order that is text',
    { displayOrder: '10' },
    ['displayOrder:invalid_type'],
  ],
  [
    'null as the display order',
    { displayOrder: null },
    ['displayOrder:invalid_type'],
  ],
  [
    'an icon URL that is not a URL',
    { iconUrl: 'icons/cut.svg' },
    ['iconUrl:invalid_format'],
  ],
  [
    'an icon URL that is neither http nor https',
    { iconUrl: 'ftp://aoyama.example.com/icons/cut.svg' },
    ['iconUrl:invalid_format'],
  ],
  ['an empty icon URL', { iconUrl: '' }, ['iconUrl:invalid_format']],
  [
    'an icon URL of 501 characters',
    { iconUrl: urlOfLength(501) },
    ['iconUrl:too_big'],
  ],
  ['a colour by its name', { color: 'red' }, ['color:invalid_format']],
  [
    'a colour of three hexadecimal digits',
    { color: '#FFF' },
    ['color:invalid_format'],
  ],
  [
    'a colour with letters that are not hexadecimal digits',
    { color: '#GGGGGG' },
    ['color:invalid_format'],
  ],
  [
    'a colour without the number sign',
    { color: 'FFFFFF' },
    ['color:invalid_format'],
  ],
  [
    'a colour of eight hexadecimal digits',
    { color: '#FF8800CC' },
    ['color:invalid_format'],
  ],
  [
    'a colour followed by a line break',
    { color: '#FF8800\n' },
    ['color:invalid_format'],
  ],
  ['an empty colour', { color: '' }, ['color:invalid_format']],
  ['isActive as text', { isActive: 'true' }, ['isActive:invalid_type']],
  ['isActive as a number', { isActive: 1 }, ['isActive:invalid_type']],
  ['null as isActive', { isActive: null }, ['isActive:invalid_type']],
  [
    'the salon, which is given by the path',
    { salonId: SALON_ID },
    ['salonId:unrecognized_keys'],
  ],
  [
    'what the server assigns',
    {
      id: CATEGORY_ID,
      createdAt: '2026-11-14T09:00:00.000Z',
      updatedAt: '2026-11-14T09:00:00.000Z',
    },
    [
      'id:unrecognized_keys',
      'createdAt:unrecognized_keys',
      'updatedAt:unrecognized_keys',
    ],
  ],
  [
    'a property that does not exist',
    { sortOrder: 1 },
    ['sortOrder:unrecognized_keys'],
  ],
]

/** Values at the edge of a rule that still satisfy it. */
const accepted: [string, Record<string, unknown>][] = [
  ['a name of one character', { name: 'a' }],
  ['a name of 100 characters', { name: 'a'.repeat(100) }],
  ['a name with spaces around it', { name: '  カット  ' }],
  ['a description of any length', { description: 'a'.repeat(5000) }],
  ['a parent', { parentId: OTHER_CATEGORY_ID }],
  ['a display order of 0', { displayOrder: 0 }],
  ['the largest display order the column holds', { displayOrder: MAX_INTEGER }],
  ['an http icon URL', { iconUrl: 'http://aoyama.example.com/cut.svg' }],
  ['an icon URL of 500 characters', { iconUrl: urlOfLength(500) }],
  ['a colour in capitals', { color: '#FF88AA' }],
  ['a colour in lower case', { color: '#ff88aa' }],
  ['a colour in mixed case', { color: '#Ff88aA' }],
  ['a colour of digits only', { color: '#012345' }],
  ['an inactive category', { isActive: false }],
]

describe('serviceCategoryCreateRequestSchema', () => {
  it('accepts a request that satisfies every rule and returns it unchanged', () => {
    const request = serviceCategoryCreateRequest()

    const result = parseWith(
      serviceCategoryCreateRequestSchema,
      request,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: request })
  })

  it('reads a parent written in upper case as the lower-case ID, the one the database returns', () => {
    const result = parseWith(
      serviceCategoryCreateRequestSchema,
      {
        ...serviceCategoryCreateRequest(),
        parentId: OTHER_CATEGORY_ID.toUpperCase(),
      },
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({
      type: 'success',
      data: { ...serviceCategoryCreateRequest(), parentId: OTHER_CATEGORY_ID },
    })
  })

  it('accepts null for the four properties that may be unset and keeps it', () => {
    const request = {
      ...serviceCategoryCreateRequest(),
      description: null,
      parentId: null,
      iconUrl: null,
      color: null,
    }

    const result = parseWith(
      serviceCategoryCreateRequestSchema,
      request,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: request })
  })

  it.each([
    'cut',
    'color',
    'perm',
    'treatment',
    'spa',
    'styling',
    'extension',
    'other',
  ])('accepts the category %s', (category) => {
    const rules = rulesBrokenBy(serviceCategoryCreateRequestSchema, {
      ...serviceCategoryCreateRequest(),
      category,
    })

    expect(rules).toEqual([])
  })

  it.each(accepted)('accepts %s and keeps it as it is', (_case, change) => {
    const request = { ...serviceCategoryCreateRequest(), ...change }

    const result = parseWith(
      serviceCategoryCreateRequestSchema,
      request,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: request })
  })

  it('counts the characters of a name, not the units of its encoding', () => {
    // 𠮷 (U+20BB7, as in 𠮷野) lies outside the Basic Multilingual Plane.
    const rules = rulesBrokenBy(serviceCategoryCreateRequestSchema, {
      ...serviceCategoryCreateRequest(),
      name: '𠮷'.repeat(100),
    })

    expect(rules).toEqual([])
  })

  it.each(violations)('rejects %s', (_case, change, expected) => {
    const rules = rulesBrokenBy(serviceCategoryCreateRequestSchema, {
      ...serviceCategoryCreateRequest(),
      ...change,
    })

    expect(rules).toEqual(expected)
  })

  it('should say how a colour is written, of a colour by its name', () => {
    // Arrange
    const request = { ...serviceCategoryCreateRequest(), color: 'red' }

    // Act
    const result = parseWith(
      serviceCategoryCreateRequestSchema,
      request,
      MADE_UP_HEADLINE,
    )

    // Assert
    expect(result).toMatchObject({
      type: 'error',
      error: { issues: [{ message: serviceCategoryMessages.colour }] },
    })
  })

  it.each(Object.keys(serviceCategoryCreateRequest()))(
    'rejects a request that leaves %s out',
    (property) => {
      const request: Record<string, unknown> = serviceCategoryCreateRequest()
      const withoutProperty = Object.fromEntries(
        Object.entries(request).filter(([name]) => name !== property),
      )

      const rules = rulesBrokenBy(
        serviceCategoryCreateRequestSchema,
        withoutProperty,
      )

      expect(rules.map((rule) => rule.replace(/:.*$/, ''))).toEqual([property])
    },
  )

  it('rejects a request that leaves the name out as a broken rule of its type', () => {
    const { name: _name, ...withoutName } = serviceCategoryCreateRequest()

    const rules = rulesBrokenBy(serviceCategoryCreateRequestSchema, withoutName)

    expect(rules).toEqual(['name:invalid_type'])
  })

  it('reports every broken rule at once', () => {
    const rules = rulesBrokenBy(serviceCategoryCreateRequestSchema, {
      ...serviceCategoryCreateRequest(),
      name: ' ',
      category: 'nails',
      displayOrder: -1,
      color: 'red',
      salonId: SALON_ID,
    })

    expect(rules.toSorted()).toEqual([
      'category:invalid_value',
      'color:invalid_format',
      'displayOrder:too_small',
      'name:invalid_format',
      'salonId:unrecognized_keys',
    ])
  })

  it.each([
    ['text', 'name=Cut'],
    ['a list', [serviceCategoryCreateRequest()]],
    ['null', null],
    ['nothing', undefined],
  ])('rejects %s in place of the request', (_case, input) => {
    expect(rulesBrokenBy(serviceCategoryCreateRequestSchema, input)).toEqual([
      ':invalid_type',
    ])
  })
})

describe('serviceCategoryUpdateRequestSchema', () => {
  it.each(Object.entries(serviceCategoryCreateRequest()))(
    'accepts a request with %s alone',
    (property, value) => {
      const request = { [property]: value }

      const result = parseWith(
        serviceCategoryUpdateRequestSchema,
        request,
        MADE_UP_HEADLINE,
      )

      expect(result).toEqual({ type: 'success', data: request })
    },
  )

  it('reads a parent written in upper case as the lower-case ID, the one the database returns', () => {
    const result = parseWith(
      serviceCategoryUpdateRequestSchema,
      { parentId: OTHER_CATEGORY_ID.toUpperCase() },
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({
      type: 'success',
      data: { parentId: OTHER_CATEGORY_ID },
    })
  })

  it('accepts every property together and returns the request unchanged', () => {
    const request = {
      ...serviceCategoryCreateRequest(),
      parentId: OTHER_CATEGORY_ID,
    }

    const result = parseWith(
      serviceCategoryUpdateRequestSchema,
      request,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: request })
  })

  it.each(['description', 'parentId', 'iconUrl', 'color'])(
    'accepts null for %s, which unsets it',
    (property) => {
      const request = { [property]: null }

      const result = parseWith(
        serviceCategoryUpdateRequestSchema,
        request,
        MADE_UP_HEADLINE,
      )

      expect(result).toEqual({ type: 'success', data: request })
    },
  )

  it.each([
    ['name', 'name:invalid_type'],
    ['category', 'category:invalid_value'],
    ['displayOrder', 'displayOrder:invalid_type'],
    ['isActive', 'isActive:invalid_type'],
  ])('rejects null for %s, which is never unset', (property, expected) => {
    const rules = rulesBrokenBy(serviceCategoryUpdateRequestSchema, {
      [property]: null,
    })

    expect(rules).toEqual([expected])
  })

  it.each(accepted)('accepts %s', (_case, change) => {
    const result = parseWith(
      serviceCategoryUpdateRequestSchema,
      change,
      MADE_UP_HEADLINE,
    )

    expect(result).toEqual({ type: 'success', data: change })
  })

  it.each(violations)(
    'rejects %s, as a create request does',
    (_case, change, expected) => {
      expect(rulesBrokenBy(serviceCategoryUpdateRequestSchema, change)).toEqual(
        expected,
      )
    },
  )

  it('rejects an empty request with one error for the request as a whole', () => {
    expect(rulesBrokenBy(serviceCategoryUpdateRequestSchema, {})).toEqual([
      ':custom',
    ])
  })

  it('reports an unknown property as such, not as an empty request', () => {
    const rules = rulesBrokenBy(serviceCategoryUpdateRequestSchema, {
      salonId: SALON_ID,
    })

    expect(rules).toEqual(['salonId:unrecognized_keys'])
  })

  it('reports every broken rule at once', () => {
    const rules = rulesBrokenBy(serviceCategoryUpdateRequestSchema, {
      name: '',
      iconUrl: 'cut.svg',
      isActive: 'no',
    })

    expect(rules).toEqual([
      'name:invalid_format',
      'iconUrl:invalid_format',
      'isActive:invalid_type',
    ])
  })

  it.each([
    ['text', 'name=Cut'],
    ['a list', [{ name: 'Renamed' }]],
    ['null', null],
    ['nothing', undefined],
  ])('rejects %s in place of the request', (_case, input) => {
    expect(rulesBrokenBy(serviceCategoryUpdateRequestSchema, input)).toEqual([
      ':invalid_type',
    ])
  })
})

describe('serviceCategorySearchRequestSchema', () => {
  it('accepts a request without any parameter', () => {
    expect(
      parseWith(serviceCategorySearchRequestSchema, {}, MADE_UP_HEADLINE),
    ).toEqual({ type: 'success', data: {} })
  })

  it.each([
    ['the smallest limit', { limit: 1 }],
    ['the largest limit', { limit: 100 }],
    ['a cursor', { cursor: CATEGORY_ID }],
    ['active categories only', { isActive: true }],
    ['inactive categories only', { isActive: false }],
    [
      'every parameter together',
      { limit: 50, cursor: CATEGORY_ID, isActive: false },
    ],
  ])('accepts %s and returns the request unchanged', (_case, request) => {
    expect(
      parseWith(serviceCategorySearchRequestSchema, request, MADE_UP_HEADLINE),
    ).toEqual({ type: 'success', data: request })
  })

  it('reads a cursor written in upper case as the lower-case ID, the one the database returns', () => {
    expect(
      parseWith(
        serviceCategorySearchRequestSchema,
        { cursor: CATEGORY_ID.toUpperCase() },
        MADE_UP_HEADLINE,
      ),
    ).toEqual({ type: 'success', data: { cursor: CATEGORY_ID } })
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
      { parentId: CATEGORY_ID, category: 'cut' },
      ['parentId:unrecognized_keys', 'category:unrecognized_keys'],
    ],
    [
      'a parameter that does not exist',
      { page: 2 },
      ['page:unrecognized_keys'],
    ],
  ])('rejects %s', (_case, input, expected) => {
    expect(rulesBrokenBy(serviceCategorySearchRequestSchema, input)).toEqual(
      expected,
    )
  })
})
