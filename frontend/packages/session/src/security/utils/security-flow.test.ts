import { FAILED, TOO_MANY_REQUESTS } from '@beauty-salon-frontend/answers'
import type { ModelsSessionResponse } from '@beauty-salon-frontend/api-client'
import { formOf } from '@beauty-salon-frontend/testing/forms'
import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import type { SessionPage } from '../api/security-api'
import { phone, thisDevice, unrecorded } from '../components/examples'
import {
  afterPasswordChange,
  cursorAfter,
  endsWithGoneCursor,
  listingOf,
  readPasswordChange,
  withoutSession,
  withoutSessionIn,
} from './security-flow'

const CURRENT = 'kirei na kami de dekakeru'
const NEW = 'aoi sora to shiroi kumo'
const UNCHANGED = {
  en: 'This is the current password. Enter another password.',
  ja: '現在のパスワードと同じです。別のパスワードを入力してください。',
}
const WRONG = {
  en: 'The current password is not correct. After 5 wrong attempts in a row, you cannot sign in either for 15 minutes.',
  ja: '現在のパスワードが違います。5 回続けて違うと、15 分間、サインインもできなくなります。',
}
const GUESSABLE = {
  en: 'This password is easy to guess and cannot be used. Enter another password.',
  ja: 'このパスワードは推測されやすいため、使えません。別のパスワードを入力してください。',
}
const TOO_SHORT = {
  en: 'The password is too short. Enter 15 characters or more.',
  ja: 'パスワードが短すぎます。15 文字以上で入力してください。',
}
const TOO_MANY = {
  en: 'There are too many requests. Wait a while and try again.',
  ja: 'アクセスが多すぎます。しばらくしてから、もう一度お試しください。',
}
const NOT_SENT = {
  en: 'It could not be sent. Check your connection and try again.',
  ja: '送信できませんでした。通信の状態を確かめて、もう一度お試しください。',
}

describe('readPasswordChange', () => {
  it('should take both passwords as they were typed, spaces and all', () => {
    expect(
      readPasswordChange(
        formOf({ currentPassword: ` ${CURRENT} `, newPassword: ` ${NEW} ` }),
      ),
    ).toEqual({
      type: 'valid',
      value: { currentPassword: ` ${CURRENT} `, newPassword: ` ${NEW} ` },
    })
  })

  it('should take a current password of any length: it was chosen under the rule of its day', () => {
    expect(
      readPasswordChange(formOf({ currentPassword: 'a', newPassword: NEW })),
    ).toEqual({
      type: 'valid',
      value: { currentPassword: 'a', newPassword: NEW },
    })
  })

  it('should say everything that is wrong at once', () => {
    expect(readPasswordChange(formOf({}))).toEqual({
      type: 'invalid',
      errors: {
        currentPassword: {
          en: 'Enter the current password.',
          ja: '現在のパスワードを入力してください。',
        },
        newPassword: {
          en: 'Enter a password.',
          ja: 'パスワードを入力してください。',
        },
      },
    })
  })

  it('should say the rule at the new password before it compares the two', () => {
    expect(
      readPasswordChange(
        formOf({ currentPassword: 'short', newPassword: 'short' }),
      ),
    ).toEqual({
      type: 'invalid',
      errors: {
        currentPassword: undefined,
        newPassword: TOO_SHORT,
      },
    })
  })

  it.each([
    ['the same characters', CURRENT, CURRENT],
    [
      'the same characters, typed in another of their forms: the API compares them composed',
      `${CURRENT} が`,
      `${CURRENT} が`,
    ],
  ])(
    'should say that the new password is the current one for %s',
    (_case, currentPassword, newPassword) => {
      expect(
        readPasswordChange(formOf({ currentPassword, newPassword })),
      ).toEqual({
        type: 'invalid',
        errors: { currentPassword: undefined, newPassword: UNCHANGED },
      })
    },
  )

  it('should take a new password that differs from the current one by a space', () => {
    expect(
      readPasswordChange(
        formOf({ currentPassword: CURRENT, newPassword: `${CURRENT} ` }),
      ).type,
    ).toBe('valid')
  })
})

describe('afterPasswordChange', () => {
  it.each<[{ field: string; rule: string }, Record<string, LocalizedText>]>([
    [
      { field: 'currentPassword', rule: 'incorrect' },
      { currentPassword: WRONG },
    ],
    [{ field: 'newPassword', rule: 'unchanged' }, { newPassword: UNCHANGED }],
    [{ field: 'newPassword', rule: 'blocklisted' }, { newPassword: GUESSABLE }],
    [{ field: 'newPassword', rule: 'too_small' }, { newPassword: TOO_SHORT }],
  ])('should say at its control what the API refused: %o', (value, errors) => {
    expect(afterPasswordChange({ type: 'invalid', values: [value] })).toEqual({
      message: undefined,
      errors,
    })
  })

  it('should say at both controls what the API refused at both', () => {
    expect(
      afterPasswordChange({
        type: 'invalid',
        values: [
          { field: 'currentPassword', rule: 'incorrect' },
          { field: 'newPassword', rule: 'blocklisted' },
        ],
      }).errors,
    ).toEqual({
      currentPassword: WRONG,
      newPassword: GUESSABLE,
    })
  })

  it.each([
    ['names no value', []],
    [
      'names a value the form does not have',
      [{ field: 'body', rule: 'invalid_type' }],
    ],
  ])(
    'should say about the attempt what to do when the API %s',
    (_case, values) => {
      expect(afterPasswordChange({ type: 'invalid', values })).toEqual({
        message: {
          en: 'Check what you entered and try again.',
          ja: '入力した内容を確かめて、もう一度お試しください。',
        },
        errors: {},
      })
    },
  )

  it.each([
    [TOO_MANY_REQUESTS, TOO_MANY],
    [FAILED, NOT_SENT],
  ])(
    'should say about the attempt why nothing came of it: %o',
    (outcome, message) => {
      expect(afterPasswordChange(outcome)).toEqual({ message, errors: {} })
    },
  )
})

const GONE: SessionPage = { type: 'cursorGone' }

const page = (
  sessions: ModelsSessionResponse[],
  total: number | null,
  nextCursor: string | null,
): SessionPage => ({ type: 'found', items: sessions, total, nextCursor })

describe('the pages of the sessions', () => {
  it('should put the pages together, with the count of the last', () => {
    expect(
      listingOf([
        page([thisDevice, unrecorded], 4, unrecorded.id),
        page([phone], 3, phone.id),
      ]),
    ).toEqual({
      type: 'listed',
      items: [thisDevice, unrecorded, phone],
      total: 3,
      rest: 'more',
    })
  })

  it('should end where the last page says there is nothing more', () => {
    expect(listingOf([page([thisDevice], 1, null)])).toMatchObject({
      type: 'listed',
      rest: 'none',
    })
  })

  it.each([
    ['could not be read', FAILED],
    ['began after a session that had ended', GONE],
  ])(
    'should keep what was read and say that the rest is missing when the next page %s',
    (_case, last) => {
      expect(listingOf([page([thisDevice], 2, thisDevice.id), last])).toEqual({
        type: 'listed',
        items: [thisDevice],
        total: 2,
        rest: 'unread',
      })
    },
  )

  it('should say why nothing is there when the first page was not read', () => {
    expect(listingOf([{ type: 'tooManyRequests' }])).toEqual({
      type: 'unread',
      reason: { type: 'tooManyRequests' },
    })
    expect(listingOf([])).toEqual({
      type: 'unread',
      reason: { type: 'failed' },
    })
  })

  it('should say that nothing could be read when the first page began after a session that had ended', () => {
    expect(listingOf([GONE])).toEqual({
      type: 'unread',
      reason: { type: 'failed' },
    })
  })

  it('should begin the next page after the last session of a page, and nowhere after a page that was not read', () => {
    expect(cursorAfter(page([thisDevice], 2, thisDevice.id))).toBe(
      thisDevice.id,
    )
    expect(cursorAfter(page([thisDevice], 1, null))).toBeUndefined()
    expect(cursorAfter(GONE)).toBeUndefined()
  })

  it('should tell a page that began after a session that had ended', () => {
    expect(
      endsWithGoneCursor([page([thisDevice], 2, thisDevice.id), GONE]),
    ).toBe(true)
    expect(
      endsWithGoneCursor([page([thisDevice], 2, thisDevice.id), FAILED]),
    ).toBe(false)
    expect(endsWithGoneCursor([])).toBe(false)
  })

  it('should take a session that was ended out of its page, and out of the count of every page, and leave where the next page begins', () => {
    const pages = withoutSession(
      [
        page([thisDevice, unrecorded], 3, unrecorded.id),
        page([phone], 3, null),
      ],
      unrecorded.id,
    )

    expect(pages).toEqual([
      page([thisDevice], 2, unrecorded.id),
      page([phone], 2, null),
    ])
    expect(listingOf(pages)).toEqual({
      type: 'listed',
      items: [thisDevice, phone],
      total: 2,
      rest: 'none',
    })
  })

  it('should leave pages that no longer show the session as they are: they were read again', () => {
    const pages = [page([thisDevice], 2, thisDevice.id), page([phone], 2, null)]

    expect(withoutSession(pages, unrecorded.id)).toEqual(pages)
  })

  it('should take a session that was ended out of what was read, and leave nothing as nothing', () => {
    // Arrange
    const read = {
      pages: [page([thisDevice, phone], 2, null)],
      pageParams: [undefined],
    }

    // Act, Assert
    expect(withoutSessionIn(read, phone.id)).toEqual({
      pages: [page([thisDevice], 1, null)],
      pageParams: [undefined],
    })
    expect(withoutSessionIn(undefined, phone.id)).toBeUndefined()
  })

  it('should leave a count the API did not give', () => {
    expect(
      withoutSession([page([thisDevice, phone], null, null)], phone.id),
    ).toEqual([page([thisDevice], null, null)])
  })
})
