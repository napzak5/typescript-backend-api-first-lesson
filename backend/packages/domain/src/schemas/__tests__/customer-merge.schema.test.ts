import { describe, expect, it } from 'vitest'
import { CUSTOMER_ID, USER_ID } from '../../__tests__/fixtures/auth-fixtures'
import {
  customerMergeRequest,
  OTHER_CUSTOMER_ID,
} from '../../__tests__/fixtures/customer-fixtures'
import { customerMergeRequestSchema } from '../customer-merge.schema'

describe('customerMergeRequestSchema', () => {
  it('takes two customers and a resolution, the IDs in lower case', () => {
    const parsed = customerMergeRequestSchema.safeParse(
      customerMergeRequest({
        secondaryCustomerId: OTHER_CUSTOMER_ID.toUpperCase(),
      }),
    )

    expect(parsed.success && parsed.data).toEqual(customerMergeRequest())
  })

  const refused: [string, Record<string, unknown>, string][] = [
    [
      'the same customer twice',
      { secondaryCustomerId: CUSTOMER_ID },
      'secondaryCustomerId:custom',
    ],
    [
      'the same customer twice, once in upper case',
      { secondaryCustomerId: CUSTOMER_ID.toUpperCase() },
      'secondaryCustomerId:custom',
    ],
    [
      'a primary that is no ID',
      { primaryCustomerId: 'first' },
      'primaryCustomerId:invalid_format',
    ],
    [
      'a secondary that is no ID',
      { secondaryCustomerId: 42 },
      'secondaryCustomerId:invalid_type',
    ],
    [
      'an unknown resolution',
      { conflictResolution: 'keep_both' },
      'conflictResolution:invalid_value',
    ],
    [
      'no resolution',
      { conflictResolution: undefined },
      'conflictResolution:invalid_value',
    ],
    ['a property of no request', { mergedBy: USER_ID }, ':unrecognized_keys'],
  ]

  it.each(refused)('refuses %s', (_, overrides, rule) => {
    const parsed = customerMergeRequestSchema.safeParse(
      customerMergeRequest(overrides),
    )

    expect(parsed.success).toBe(false)
    expect(
      parsed.error?.issues.map(({ path, code }) => `${path.join('.')}:${code}`),
    ).toEqual([rule])
  })
})
