import { describe, expect, it } from 'vitest'
import { planSeed } from '../seed-plan'

describe('planSeed', () => {
  it.each([
    {
      hasData: false,
      reset: false,
      onlyIfEmpty: false,
      plan: 'insert',
    },
    {
      hasData: false,
      reset: false,
      onlyIfEmpty: true,
      plan: 'insert',
    },
    {
      hasData: false,
      reset: true,
      onlyIfEmpty: false,
      plan: 'reset-and-insert',
    },
    {
      hasData: false,
      reset: true,
      onlyIfEmpty: true,
      plan: 'reset-and-insert',
    },
    {
      hasData: true,
      reset: false,
      onlyIfEmpty: false,
      plan: 'refuse',
    },
    {
      hasData: true,
      reset: false,
      onlyIfEmpty: true,
      plan: 'skip',
    },
    {
      hasData: true,
      reset: true,
      onlyIfEmpty: false,
      plan: 'reset-and-insert',
    },
    {
      hasData: true,
      reset: true,
      onlyIfEmpty: true,
      plan: 'skip',
    },
  ])(
    'should plan $plan when hasData is $hasData, reset is $reset and onlyIfEmpty is $onlyIfEmpty',
    ({ plan, ...request }) => {
      expect(planSeed(request)).toBe(plan)
    },
  )
})
