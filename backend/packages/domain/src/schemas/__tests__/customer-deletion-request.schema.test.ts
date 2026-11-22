import { describe, expect, it } from 'vitest'
import { customerDeletionRequestCreateRequestSchema } from '../customer-deletion-request.schema'

describe('customerDeletionRequestCreateRequestSchema', () => {
  const parsed = (input: unknown) =>
    customerDeletionRequestCreateRequestSchema.safeParse(input)

  it('takes a reason as it is written, of 1 to 1,000 characters', () => {
    expect(parsed({ reason: ' 本人から電話で依頼 ' })).toMatchObject({
      success: true,
      data: { reason: ' 本人から電話で依頼 ' },
    })
    expect(parsed({ reason: 'あ'.repeat(1000) }).success).toBe(true)
  })

  it.each<[string, unknown]>([
    ['no reason', {}],
    ['an empty reason', { reason: '' }],
    ['a blank reason', { reason: ' \n\t' }],
    ['a reason of 1,001 characters', { reason: 'あ'.repeat(1001) }],
    ['a reason that is no string', { reason: 1 }],
    ['a property of no request', { reason: '依頼', confirmed: true }],
    ['no object', '依頼'],
  ])('refuses %s', (_, input) => {
    expect(parsed(input).success).toBe(false)
  })
})
