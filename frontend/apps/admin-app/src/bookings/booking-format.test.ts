import type { ModelsBookingStatusType } from '@beauty-salon-frontend/api-client'
import type { BadgeProps } from '@beauty-salon-frontend/ui'
import { describe, expect, it } from 'vitest'
import { hoursOf, statusNameOf, statusToneOf } from './booking-format'

type StatusCase = [ModelsBookingStatusType, string, BadgeProps['tone']]

const STATUSES: StatusCase[] = [
  ['draft', '下書き', 'neutral'],
  ['pending', '確定待ち', 'warning'],
  ['confirmed', '確定', 'success'],
  ['in_progress', '施術中', 'info'],
  ['completed', '完了', 'neutral'],
  ['cancelled', 'キャンセル', 'neutral'],
  ['no_show', '無断キャンセル', 'danger'],
]

describe('statusNameOf and statusToneOf', () => {
  it.each(STATUSES)('should name the state %s', (status, name, tone) => {
    expect(statusNameOf(status)).toBe(name)
    expect(statusToneOf(status)).toBe(tone)
  })
})

describe('hoursOf', () => {
  it('should say from when until when on the clock of the salon', () => {
    expect(
      hoursOf(
        {
          startTime: '2026-11-20T01:00:00.000Z',
          endTime: '2026-11-20T02:30:00.000Z',
        },
        'Asia/Tokyo',
      ),
    ).toBe('10:00〜11:30')
  })
})
