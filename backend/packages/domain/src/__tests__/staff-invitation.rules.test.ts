import { describe, expect, it } from 'vitest'
import {
  EMAIL_VERIFICATION,
  latestEndToMailAgain,
  type MailedTokenKind,
  mailedTokenEnd,
  mayMailAgain,
  PASSWORD_RESET,
  STAFF_INVITATION,
} from '../business-logic/auth/_shared/mailed-token'
import { staffInvitationMail } from '../business-logic/auth/_shared/mails'
import {
  mayGiveRole,
  mayInviteStaff,
} from '../business-logic/staff-invitation/_shared/authorization'
import type { Actor } from '../models/auth'
import { parseSalonIdOfPath } from '../models/salon'
import type { SalonRole } from '../models/staff-invitation'
import {
  actors,
  DAY,
  dataOf,
  NOW,
  PUBLIC_APP_URL,
  secondsFromNow,
} from './auth-fixtures'
import { OTHER_SALON_ID, SALON_ID } from './fixtures'
import { INVITED_EMAIL, SALON_NAME } from './staff-invitation-fixtures'

const salonId = dataOf(parseSalonIdOfPath(SALON_ID))

describe('mayInviteStaff', () => {
  it.each<[string, Actor]>([
    ['an administrator', actors.admin],
    ['the owner of the salon', actors.ofSalon('owner')],
  ])('lets %s invite', (_who, actor) => {
    expect(mayInviteStaff(actor, salonId)).toBe(true)
  })

  it.each<[string, Actor]>([
    ['a manager of the salon', actors.ofSalon('manager')],
    ['a staff member of the salon', actors.ofSalon('staff')],
    ['the owner of another salon', actors.ofSalon('owner', OTHER_SALON_ID)],
    ['a manager of another salon', actors.ofSalon('manager', OTHER_SALON_ID)],
    ['a customer', actors.customer],
    ['a customer without a profile', actors.customerWithoutProfile],
    ['a user without a scope', actors.withoutScope],
  ])('does not let %s invite', (_who, actor) => {
    expect(mayInviteStaff(actor, salonId)).toBe(false)
  })
})

describe('mayGiveRole', () => {
  it.each<SalonRole>(['owner', 'manager', 'staff'])(
    'lets an administrator give the role %s',
    (role) => {
      expect(mayGiveRole(actors.admin, role)).toBe(true)
    },
  )

  it.each<SalonRole>(['manager', 'staff'])(
    'lets the owner of a salon give the role %s',
    (role) => {
      expect(mayGiveRole(actors.ofSalon('owner'), role)).toBe(true)
    },
  )

  it('does not let the owner of a salon make another owner', () => {
    expect(mayGiveRole(actors.ofSalon('owner'), 'owner')).toBe(false)
  })
})

describe('STAFF_INVITATION', () => {
  it('works for seven days', () => {
    expect(mailedTokenEnd(STAFF_INVITATION, NOW).toISOString()).toBe(
      secondsFromNow(7 * DAY),
    )
  })
})

describe('latestEndToMailAgain', () => {
  it.each<[string, MailedTokenKind, number]>([
    ['an invitation', STAFF_INVITATION, 7 * DAY],
    ['an email verification', EMAIL_VERIFICATION, DAY],
    ['a password reset', PASSWORD_RESET, 30 * 60],
  ])(
    'is the end of %s that was mailed 60 seconds ago',
    (_kind, kind, lifetime) => {
      expect(latestEndToMailAgain(kind, NOW).toISOString()).toBe(
        secondsFromNow(lifetime - 60),
      )
    },
  )

  it.each<[string, number, boolean]>([
    ['61 seconds ago', -61, true],
    ['exactly 60 seconds ago', -60, true],
    ['59 seconds ago', -59, false],
    ['at this moment', 0, false],
  ])(
    'agrees with mayMailAgain about a token mailed %s',
    (_when, mailedAt, expected) => {
      const end = secondsFromNow(mailedAt + 7 * DAY)

      expect(mayMailAgain(STAFF_INVITATION, end, NOW)).toBe(expected)
      expect(
        Date.parse(end) <=
          latestEndToMailAgain(STAFF_INVITATION, NOW).getTime(),
      ).toBe(expected)
    },
  )
})

describe('staffInvitationMail', () => {
  const mail = staffInvitationMail(
    INVITED_EMAIL,
    SALON_NAME,
    PUBLIC_APP_URL,
    'mailed-token',
  )

  it('goes to the address it is given, under a subject that is the same for every salon', () => {
    expect(mail.to).toBe(INVITED_EMAIL)
    expect(mail.subject).toBe('スタッフアカウントへの招待')
  })

  it('names the salon in the first line of the text', () => {
    expect(mail.text.split('\n')[0]).toBe(
      `${SALON_NAME} から、スタッフアカウントへの招待が届いています。`,
    )
  })

  it('links to the page of the web application, with the token in the fragment, on a line of its own', () => {
    expect(mail.text.split('\n')).toContain(
      `${PUBLIC_APP_URL}/accept-staff-invitation#token=mailed-token`,
    )
  })

  it('tells that the link works for seven days and once', () => {
    expect(mail.text).toContain('このリンクは 7 日間有効で、1 回だけ使えます。')
  })

  it('tells what to do with a mail nobody expected', () => {
    expect(mail.text).toContain(
      'リンクを開かなければ、アカウントは作成されません。',
    )
  })

  it('keeps the name of a salon out of the subject, whatever the name is', () => {
    const named = staffInvitationMail(
      INVITED_EMAIL,
      'Salon\r\nBcc: someone@example.com',
      PUBLIC_APP_URL,
      'mailed-token',
    )

    expect(named.subject).toBe('スタッフアカウントへの招待')
    expect(named.to).toBe(INVITED_EMAIL)
  })
})
