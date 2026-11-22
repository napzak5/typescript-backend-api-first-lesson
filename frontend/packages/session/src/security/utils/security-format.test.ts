import type { ModelsTwoFactorStatusType } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { phone, unrecorded } from '../components/examples'
import {
  addressOf,
  browserOf,
  momentOf,
  passwordChangedOf,
  sessionNameOf,
  type TwoFactorState,
  twoFactorStateOf,
} from './security-format'

describe('momentOf', () => {
  it.each([
    ['Asia/Tokyo', '2026年11月20日 9:05'],
    ['America/New_York', '2026年11月19日 19:05'],
  ])(
    'should say a moment in the time zone of whoever reads: %s',
    (timeZone, moment) => {
      expect(momentOf('2026-11-20T00:05:00.000Z', timeZone)).toBe(moment)
    },
  )
})

describe('passwordChangedOf', () => {
  it('should say when the password was changed, or that it never was', () => {
    expect(
      passwordChangedOf(
        { lastPasswordChange: '2026-10-02T09:30:00.000Z' },
        'Asia/Tokyo',
      ),
    ).toBe('2026年10月2日 18:30')
    expect(passwordChangedOf({ lastPasswordChange: null }, 'Asia/Tokyo')).toBe(
      'アカウントを作ってから、変更していません',
    )
  })
})

const TWO_FACTOR_STATES: [
  ModelsTwoFactorStatusType,
  TwoFactorState['label'],
  TwoFactorState['tone'],
][] = [
  ['enabled', '有効', 'success'],
  ['pending', '設定の途中', 'warning'],
  ['disabled', '未設定', 'neutral'],
]

describe('twoFactorStateOf', () => {
  it.each(TWO_FACTOR_STATES)(
    'should say a second factor that is %s as 「%s」, in the tone %s',
    (status, label, tone) => {
      expect(twoFactorStateOf(status)).toMatchObject({ label, tone })
    },
  )

  it('should tell the three states apart in what it says of them', () => {
    const descriptions = TWO_FACTOR_STATES.map(
      ([status]) => twoFactorStateOf(status).description,
    )

    expect(new Set(descriptions).size).toBe(3)
  })
})

describe('the words of a session', () => {
  it('should name a session after the moment its device signed in', () => {
    expect(sessionNameOf(phone, 'Asia/Tokyo')).toBe(
      '2026年11月13日 20:00 にサインインした端末',
    )
  })

  it('should say the browser and the address as the API kept them, or that it kept none', () => {
    expect(browserOf(phone)).toBe(phone.userAgent)
    expect(addressOf(phone)).toBe('198.51.100.7')
    expect(browserOf(unrecorded)).toBe('記録されていません')
    expect(addressOf(unrecorded)).toBe('記録されていません')
  })
})
