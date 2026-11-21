import { describe, expect, it } from 'vitest'
import { queryOfKeyword } from './salon-choice'

describe('queryOfKeyword', () => {
  it('should keep a keyword in the query', () => {
    expect(queryOfKeyword('渋谷 駅前').toString()).toBe(
      'keyword=%E6%B8%8B%E8%B0%B7+%E9%A7%85%E5%89%8D',
    )
  })

  it('should leave the query empty without a keyword', () => {
    expect(queryOfKeyword(undefined).toString()).toBe('')
  })
})
