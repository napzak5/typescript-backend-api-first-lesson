import type { ModelsTwoFactorStatusType } from '@beauty-salon-frontend/api-client'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import { phone } from '../components/examples'
import {
  momentOf,
  passwordChangedOf,
  sessionNameOf,
  signOutNameOf,
  type TwoFactorState,
  twoFactorStateOf,
} from './security-format'

describe('momentOf', () => {
  it.each<[string, LocalizedText]>([
    [
      'Asia/Tokyo',
      { en: 'November 20, 2026 at 09:05', ja: '2026年11月20日 9:05' },
    ],
    [
      'America/New_York',
      { en: 'November 19, 2026 at 19:05', ja: '2026年11月19日 19:05' },
    ],
  ])(
    'should say a moment in the time zone of whoever reads: %s',
    (timeZone, moment) => {
      expect(momentOf('2026-11-20T00:05:00.000Z', timeZone)).toEqual(moment)
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
    ).toEqual({ en: 'October 2, 2026 at 18:30', ja: '2026年10月2日 18:30' })
    expect(
      passwordChangedOf({ lastPasswordChange: null }, 'Asia/Tokyo'),
    ).toEqual({
      en: 'Not changed since the account was created',
      ja: 'アカウントを作ってから、変更していません',
    })
  })
})

const TWO_FACTOR_STATES: [
  ModelsTwoFactorStatusType,
  TwoFactorState['label'],
  TwoFactorState['tone'],
][] = [
  ['enabled', { en: 'On', ja: '有効' }, 'success'],
  ['pending', { en: 'Set-up not finished', ja: '設定の途中' }, 'warning'],
  ['disabled', { en: 'Not set up', ja: '未設定' }, 'neutral'],
]

describe('twoFactorStateOf', () => {
  it.each(TWO_FACTOR_STATES)(
    'should say a second factor that is %s as %j, in the tone %s',
    (status, label, tone) => {
      expect(twoFactorStateOf(status)).toMatchObject({ label, tone })
    },
  )

  it('should tell the three states apart in what it says of them, in every language', () => {
    const descriptions = TWO_FACTOR_STATES.map(
      ([status]) => twoFactorStateOf(status).description,
    )

    expect(new Set(descriptions.map(({ en }) => en)).size).toBe(3)
    expect(new Set(descriptions.map(({ ja }) => ja)).size).toBe(3)
  })
})

describe('the words of a session', () => {
  it('should name a session after the moment its device signed in', () => {
    expect(sessionNameOf(phone, 'Asia/Tokyo')).toEqual({
      en: 'Device signed in on November 13, 2026 at 20:00',
      ja: '2026年11月13日 20:00 にサインインした端末',
    })
  })

  it('should name the button that signs a session out after the session', () => {
    expect(signOutNameOf(phone, 'Asia/Tokyo')).toEqual({
      en: 'Sign out the device signed in on November 13, 2026 at 20:00',
      ja: '2026年11月13日 20:00 にサインインした端末をサインアウトさせる',
    })
  })
})
