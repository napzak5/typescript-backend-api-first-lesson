import { describe, expect, it } from 'vitest'
import { conditionsIn, conditionsOf, narrows, queryOf } from './salon-search'

const formOf = (values: Record<string, string>): FormData => {
  const form = new FormData()
  for (const [name, value] of Object.entries(values)) {
    form.set(name, value)
  }

  return form
}

describe('conditionsIn', () => {
  it('should read every condition from the query of an address', () => {
    expect(
      conditionsIn(
        new URLSearchParams(
          'keyword=カラー&prefecture=東京都&city=渋谷区&minRating=4.5',
        ),
      ),
    ).toEqual({
      keyword: 'カラー',
      prefecture: '東京都',
      city: '渋谷区',
      minRating: 4.5,
    })
  })

  it('should have no condition for an address without a query', () => {
    expect(conditionsIn(new URLSearchParams(''))).toEqual({})
  })

  it('should take the spaces around a text away, and a text of spaces for none', () => {
    expect(
      conditionsIn(new URLSearchParams('keyword=%20カット%20%20&city=%20%20')),
    ).toEqual({ keyword: 'カット' })
  })

  it.each([
    ['keyword', 100],
    ['prefecture', 50],
    ['city', 100],
  ])(
    'should keep a %s of %i characters, and drop a longer one',
    (name, longest) => {
      expect(
        conditionsIn(new URLSearchParams({ [name]: 'あ'.repeat(longest) })),
      ).toEqual({ [name]: 'あ'.repeat(longest) })
      expect(
        conditionsIn(new URLSearchParams({ [name]: 'あ'.repeat(longest + 1) })),
      ).toEqual({})
    },
  )

  it.each([
    ['3', 3],
    ['3.5', 3.5],
    ['4', 4],
    ['4.5', 4.5],
  ])('should read the rating %s, which is on offer', (written, rating) => {
    expect(conditionsIn(new URLSearchParams({ minRating: written }))).toEqual({
      minRating: rating,
    })
  })

  it.each(['5', '2', '4.50', '4,5', 'high', '', ' 4'])(
    'should drop the rating %j, which is not on offer as it is written',
    (written) => {
      expect(conditionsIn(new URLSearchParams({ minRating: written }))).toEqual(
        {},
      )
    },
  )

  it('should read the first value of a condition that is written twice, and no parameter that is no condition', () => {
    expect(
      conditionsIn(
        new URLSearchParams(
          'keyword=one&keyword=two&limit=100&isActive=false&cursor=x',
        ),
      ),
    ).toEqual({ keyword: 'one' })
  })
})

describe('conditionsOf', () => {
  it('should read the conditions a visitor filled in, by the same rules as those of an address', () => {
    expect(
      conditionsOf(
        formOf({
          keyword: ' ヘッドスパ ',
          prefecture: '',
          city: '浪速区',
          minRating: '3.5',
        }),
      ),
    ).toEqual({ keyword: 'ヘッドスパ', city: '浪速区', minRating: 3.5 })
  })

  it('should have no condition for a form nothing was filled into', () => {
    expect(
      conditionsOf(
        formOf({ keyword: '', prefecture: '', city: '', minRating: '' }),
      ),
    ).toEqual({})
  })

  it('should take a file for no text', () => {
    const form = new FormData()
    form.set('keyword', new File(['cut'], 'keyword.txt'))

    expect(conditionsOf(form)).toEqual({})
  })
})

describe('queryOf', () => {
  it('should write the conditions in one order, whatever order they were given in', () => {
    expect(
      queryOf({
        minRating: 4,
        city: '渋谷区',
        keyword: 'cut & color',
        prefecture: '東京都',
      }).toString(),
    ).toBe(
      new URLSearchParams([
        ['keyword', 'cut & color'],
        ['prefecture', '東京都'],
        ['city', '渋谷区'],
        ['minRating', '4'],
      ]).toString(),
    )
  })

  it('should write nothing for no condition', () => {
    expect(queryOf({}).toString()).toBe('')
  })

  it('should be read back as the same conditions', () => {
    const conditions = { keyword: '50% off?', minRating: 3.5 }

    expect(conditionsIn(queryOf(conditions))).toEqual(conditions)
  })
})

describe('narrows', () => {
  it.each([
    [{ keyword: 'cut' }],
    [{ prefecture: '東京都' }],
    [{ city: '渋谷区' }],
    [{ minRating: 3 }],
  ])('should say that %j narrows the search', (conditions) => {
    expect(narrows(conditions)).toBe(true)
  })

  it('should say that no condition narrows nothing', () => {
    expect(narrows({})).toBe(false)
  })
})
