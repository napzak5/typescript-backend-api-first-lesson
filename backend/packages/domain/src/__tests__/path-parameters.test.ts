import { describe, expect, it } from 'vitest'
import { parseSalonIdOfPath } from '../models/salon'
import { parseCategoryId } from '../models/service-category'
import type { DomainError } from '../shared'
import { brokenRules, SALON_ID } from './fixtures'
import { CATEGORY_ID } from './service-category-fixtures'

/** The broken rules of a failed result, as `field:rule`; empty for a success. */
const rulesOf = (result: { type: string; error?: DomainError }): string[] =>
  result.error === undefined ? [] : brokenRules(result.error)

/** Text in a path that is not a UUID. */
const notUuids: [string, string][] = [
  ['a word', 'latest'],
  ['a number', '42'],
  ['the empty string', ''],
  ['a UUID with a character too many', `${SALON_ID}0`],
  ['a UUID with a character too few', SALON_ID.slice(0, -1)],
  ['a UUID with a space in front', ` ${SALON_ID}`],
  ['a UUID followed by a line break', `${SALON_ID}\n`],
  ['a UUID without its hyphens', SALON_ID.replaceAll('-', '')],
  ['a UUID in braces', `{${SALON_ID}}`],
  [
    'a UUID with a letter that is not a hexadecimal digit',
    `g${SALON_ID.slice(1)}`,
  ],
]

/** What a path never carries, but an unchecked caller could pass. */
const notText: [string, unknown][] = [
  ['nothing', undefined],
  ['null', null],
  ['a number', 42],
  ['a list of IDs', [SALON_ID]],
]

describe('parseSalonIdOfPath', () => {
  it('returns the ID of a salon as it is', () => {
    expect(parseSalonIdOfPath(SALON_ID)).toEqual({
      type: 'success',
      data: SALON_ID,
    })
  })

  it.each(notUuids)(
    'reports %s under salonId, not under id',
    (_case, salonId) => {
      expect(rulesOf(parseSalonIdOfPath(salonId))).toEqual([
        'salonId:invalid_format',
      ])
    },
  )

  it.each(notText)('reports %s under salonId', (_case, salonId) => {
    expect(rulesOf(parseSalonIdOfPath(salonId))).toEqual([
      'salonId:invalid_type',
    ])
  })
})

describe('parseCategoryId', () => {
  it('returns the ID of a category as it is', () => {
    expect(parseCategoryId(CATEGORY_ID)).toEqual({
      type: 'success',
      data: CATEGORY_ID,
    })
  })

  it.each(notUuids)('reports %s under id', (_case, id) => {
    expect(rulesOf(parseCategoryId(id))).toEqual(['id:invalid_format'])
  })

  it.each(notText)('reports %s under id', (_case, id) => {
    expect(rulesOf(parseCategoryId(id))).toEqual(['id:invalid_type'])
  })
})
