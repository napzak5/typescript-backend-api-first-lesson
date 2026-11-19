import { describe, expect, it } from 'vitest'
import { kenta, misaki, yui } from './components/examples'
import { staffNamed, timeSlotOf, UNSET } from './preferences-format'

describe('timeSlotOf', () => {
  it('should write a time slot from the time it begins at to the time it ends at', () => {
    expect(timeSlotOf({ startTime: '09:30', endTime: '12:00' })).toBe(
      '09:30〜12:00',
    )
  })
})

describe('staffNamed', () => {
  it('should name the members in the order of their IDs, each with their salon', () => {
    expect(staffNamed([yui.id, misaki.id], [misaki, kenta, yui])).toEqual([
      '鈴木 結衣（Hair Studio Osaka）',
      '田中 美咲（Beauty Salon Tokyo）',
    ])
  })

  it('should leave out a member who is not among the staff that can be named', () => {
    expect(
      staffNamed(
        ['0f6d3b8a-7e21-4c95-b4a0-6d9e2c5f1a73', kenta.id],
        [misaki, kenta],
      ),
    ).toEqual(['佐藤 健太（Beauty Salon Tokyo）'])
  })

  it('should name nobody for no ID', () => {
    expect(staffNamed([], [misaki])).toEqual([])
  })
})

describe('UNSET', () => {
  it('should say that nothing was asked for', () => {
    expect(UNSET).toBe('指定なし')
  })
})
