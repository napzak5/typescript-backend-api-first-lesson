import { describe, expect, it } from 'vitest'
import { uuidSchema } from '../shared'

const LOWER = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0a1b'

describe('uuidSchema', () => {
  it.each<[string, string]>([
    ['lower case', LOWER],
    ['upper case', LOWER.toUpperCase()],
    ['mixed case', '0193A5b8-7C2e-7d4F-8a1B-3c5D7e9f0A1b'],
  ])('reads a UUID written in %s as the lower-case UUID', (_case, id) => {
    expect(uuidSchema.safeParse(id)).toEqual({ success: true, data: LOWER })
  })

  it.each<[string, unknown, string]>([
    ['a word', 'latest', 'invalid_format'],
    ['an empty text', '', 'invalid_format'],
    ['a UUID without hyphens', LOWER.replaceAll('-', ''), 'invalid_format'],
    ['a UUID in braces', `{${LOWER}}`, 'invalid_format'],
    ['a UUID with spaces around it', ` ${LOWER} `, 'invalid_format'],
    ['a number', 42, 'invalid_type'],
    ['null', null, 'invalid_type'],
  ])('rejects %s', (_case, id, code) => {
    const result = uuidSchema.safeParse(id)

    expect(result.success).toBe(false)
    expect(result.error?.issues.map((issue) => issue.code)).toEqual([code])
  })
})
