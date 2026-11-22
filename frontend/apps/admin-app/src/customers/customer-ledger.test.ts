import { describe, expect, it } from 'vitest'
import {
  type CustomerConditions,
  customerConditionsIn,
  customerListParamsOf,
  customerQueryOf,
  isNarrowed,
  readCustomerConditions,
  tagsIn,
  tagsTextOf,
} from './customer-ledger'

const formOf = (values: Record<string, string>): FormData => {
  const form = new FormData()
  for (const [name, value] of Object.entries(values)) {
    form.append(name, value)
  }

  return form
}

const EMPTY_FORM = {
  search: '',
  tags: '',
  from: '',
  to: '',
  customerStatus: '',
  membershipTier: '',
}

describe('tagsIn', () => {
  it.each<[string, string, string[]]>([
    [
      'commas of either width',
      'VIP、常連,カラー，紹介',
      ['VIP', '常連', 'カラー', '紹介'],
    ],
    ['spaces around a tag', '  VIP 、 常連 ', ['VIP', '常連']],
    ['nothing between two commas', 'VIP、、常連,', ['VIP', '常連']],
    ['a tag written twice', 'VIP、常連、VIP', ['VIP', '常連']],
    ['a tag with a space inside', 'ヘア カラー', ['ヘア カラー']],
    ['nothing', '', []],
  ])('should read the tags of %s', (_case, text, tags) => {
    // Act, Assert
    expect(tagsIn(text)).toEqual(tags)
  })

  it('should write tags the way they are read', () => {
    // Act, Assert
    expect(tagsIn(tagsTextOf(['VIP', '常連']))).toEqual(['VIP', '常連'])
  })
})

describe('customerConditionsIn', () => {
  it('should read every condition of an address', () => {
    // Arrange
    const query = new URLSearchParams(
      'search=山田&tags=VIP&tags=常連&from=2026-11-01&to=2026-11-20&customerStatus=vip&membershipTier=gold',
    )

    // Act, Assert
    expect(customerConditionsIn(query)).toEqual({
      search: '山田',
      tags: ['VIP', '常連'],
      from: '2026-11-01',
      to: '2026-11-20',
      customerStatus: 'vip',
      membershipTier: 'gold',
    })
  })

  it.each<[string, string, CustomerConditions]>([
    ['no query', '', { tags: [] }],
    ['a keyword of spaces', 'search=%20%20', { tags: [] }],
    ['a keyword too long', `search=${'あ'.repeat(101)}`, { tags: [] }],
    ['empty and repeated tags', 'tags=&tags=VIP&tags=VIP', { tags: ['VIP'] }],
    ['a day that is none', 'from=2026-02-30&to=x', { tags: [] }],
    [
      'an end before the start',
      'from=2026-11-20&to=2026-11-01',
      { tags: [], from: '2026-11-20' },
    ],
    ['an end alone', 'to=2026-11-20', { tags: [], to: '2026-11-20' }],
    [
      'a state and a rank that are none',
      'customerStatus=gone&membershipTier=diamond',
      { tags: [] },
    ],
  ])(
    'should leave out what the API does not take: %s',
    (_case, query, conditions) => {
      // Act, Assert
      expect(customerConditionsIn(new URLSearchParams(query))).toEqual(
        conditions,
      )
    },
  )
})

describe('readCustomerConditions', () => {
  it('should read what was filled in', () => {
    // Act
    const read = readCustomerConditions(
      formOf({
        search: ' 090-1234 ',
        tags: 'VIP、常連',
        from: '2026-11-01',
        to: '2026-11-01',
        customerStatus: 'inactive',
        membershipTier: 'silver',
      }),
    )

    // Assert
    expect(read).toEqual({
      type: 'valid',
      value: {
        search: '090-1234',
        tags: ['VIP', '常連'],
        from: '2026-11-01',
        to: '2026-11-01',
        customerStatus: 'inactive',
        membershipTier: 'silver',
      },
    })
  })

  it('should narrow nothing when nothing was filled in', () => {
    // Act, Assert
    expect(readCustomerConditions(formOf(EMPTY_FORM))).toEqual({
      type: 'valid',
      value: { tags: [] },
    })
  })

  it.each<[string, Record<string, string>, Record<string, string>]>([
    [
      'an end before the start',
      { from: '2026-11-20', to: '2026-11-19' },
      { to: '終わりの日は、始まりの日と同じか、その後にしてください。' },
    ],
    [
      'days that are none',
      { from: '2026-02-30', to: '20261120' },
      { from: '日付を入力してください。', to: '日付を入力してください。' },
    ],
    [
      'a keyword too long',
      { search: 'a'.repeat(101) },
      { search: 'キーワードは 100 文字以内で入力してください。' },
    ],
  ])('should say what is wrong with %s', (_case, values, errors) => {
    // Act, Assert
    expect(
      readCustomerConditions(formOf({ ...EMPTY_FORM, ...values })),
    ).toEqual({
      type: 'invalid',
      errors,
    })
  })
})

describe('customerQueryOf', () => {
  it('should write the same conditions as the same address, in one order', () => {
    // Act
    const query = customerQueryOf({
      membershipTier: 'gold',
      customerStatus: 'vip',
      to: '2026-11-20',
      from: '2026-11-01',
      tags: ['VIP', '常連'],
      search: '山田',
    })

    // Assert
    expect(query.toString()).toBe(
      new URLSearchParams(
        'search=山田&tags=VIP&tags=常連&from=2026-11-01&to=2026-11-20&customerStatus=vip&membershipTier=gold',
      ).toString(),
    )
    expect(customerConditionsIn(query)).toEqual({
      search: '山田',
      tags: ['VIP', '常連'],
      from: '2026-11-01',
      to: '2026-11-20',
      customerStatus: 'vip',
      membershipTier: 'gold',
    })
  })

  it.each<[string, CustomerConditions, boolean]>([
    ['no condition', { tags: [] }, false],
    ['a tag', { tags: ['VIP'] }, true],
    ['a rank', { tags: [], membershipTier: 'regular' }, true],
  ])(
    'should tell whether %s narrows the ledger',
    (_case, conditions, narrowed) => {
      // Act, Assert
      expect(isNarrowed(conditions)).toBe(narrowed)
    },
  )
})

describe('customerListParamsOf', () => {
  it('should ask for the days of the salon as the moments they begin and end', () => {
    // Act
    const params = customerListParamsOf(
      {
        search: '山田',
        tags: ['VIP'],
        from: '2026-11-01',
        to: '2026-11-20',
        customerStatus: 'active',
        membershipTier: 'gold',
      },
      'Asia/Tokyo',
    )

    // Assert
    expect(params).toEqual({
      search: '山田',
      tags: ['VIP'],
      registeredFrom: '2026-10-31T15:00:00.000Z',
      registeredTo: '2026-11-20T14:59:59.999Z',
      customerStatus: 'active',
      membershipTier: 'gold',
    })
  })

  it('should ask for nothing that does not narrow', () => {
    // Act, Assert
    expect(customerListParamsOf({ tags: [] }, 'Asia/Tokyo')).toEqual({})
  })

  it('should ask for the nearest moments the API takes, at the ends of what it takes', () => {
    // Act
    const params = customerListParamsOf(
      { tags: [], from: '1900-01-01', to: '2999-12-31' },
      'America/New_York',
    )

    // Assert
    expect(params).toEqual({
      registeredFrom: '1900-01-01T05:00:00.000Z',
      registeredTo: '2999-12-31T23:59:59.999Z',
    })
  })

  it('should not ask for a moment before the first the API takes', () => {
    // Act
    const params = customerListParamsOf(
      { tags: [], from: '1900-01-01' },
      'Asia/Tokyo',
    )

    // Assert
    expect(params).toEqual({ registeredFrom: '1900-01-01T00:00:00.000Z' })
  })
})
