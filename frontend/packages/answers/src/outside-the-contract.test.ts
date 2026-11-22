import { describe, expect, it } from 'vitest'
import { outsideTheContract } from './outside-the-contract'

describe('outsideTheContract', () => {
  it('should make of an answer the contract does not name a failure, like no answer at all', () => {
    expect(outsideTheContract()).toEqual({ type: 'failed' })
  })
})
