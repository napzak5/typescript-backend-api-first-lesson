import type { ModelsBookingStatusType } from '@beauty-salon-frontend/api-client'
import type { BadgeTone } from '@beauty-salon-frontend/ui'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import { hoursOf, statusNameOf, statusToneOf } from './booking-format'

type StatusCase = [ModelsBookingStatusType, LocalizedText, BadgeTone]

const STATUSES: StatusCase[] = [
  ['draft', { en: 'Draft', ja: '下書き' }, 'neutral'],
  ['pending', { en: 'Awaiting confirmation', ja: '確定待ち' }, 'warning'],
  ['confirmed', { en: 'Confirmed', ja: '確定' }, 'success'],
  ['in_progress', { en: 'In progress', ja: '施術中' }, 'info'],
  ['completed', { en: 'Completed', ja: '完了' }, 'neutral'],
  ['cancelled', { en: 'Cancelled', ja: 'キャンセル' }, 'neutral'],
  ['no_show', { en: 'No-show', ja: '無断キャンセル' }, 'danger'],
]

describe('statusNameOf and statusToneOf', () => {
  it.each(STATUSES)('should name the state %s', (status, name, tone) => {
    expect(statusNameOf(status)).toEqual(name)
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
    ).toEqual({ en: '10:00–11:30', ja: '10:00〜11:30' })
  })
})
