import type { ModelsSessionResponse } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { phone, thisDevice, unrecorded } from './components/examples'
import type { SessionPage, Unsent } from './security-api'
import {
  afterPasswordChange,
  afterUnsent,
  cursorAfter,
  endsWithGoneCursor,
  listingOf,
  type More,
  moreOf,
  readPasswordChange,
  unreadMessageOf,
  withoutSession,
} from './security-flow'

const formOf = (values: Record<string, string>): FormData => {
  const form = new FormData()
  for (const [name, value] of Object.entries(values)) {
    form.append(name, value)
  }

  return form
}

const CURRENT = 'kirei na kami de dekakeru'
const NEW = 'aoi sora to shiroi kumo'
const UNCHANGED =
  '現在のパスワードと同じです。別のパスワードを入力してください。'
const WRONG =
  '現在のパスワードが違います。5 回続けて違うと、15 分間、サインインもできなくなります。'
const TOO_MANY =
  'アクセスが多すぎます。しばらくしてから、もう一度お試しください。'
const NOT_SENT =
  '送信できませんでした。通信の状態を確かめて、もう一度お試しください。'

const TOO_MANY_REQUESTS: Unsent = { type: 'tooManyRequests' }
const FAILED: Unsent = { type: 'failed' }

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
        currentPassword: '現在のパスワードを入力してください。',
        newPassword: 'パスワードを入力してください。',
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
        newPassword: 'パスワードが短すぎます。15 文字以上で入力してください。',
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
  it.each([
    [
      { field: 'currentPassword', rule: 'incorrect' },
      { currentPassword: WRONG },
    ],
    [{ field: 'newPassword', rule: 'unchanged' }, { newPassword: UNCHANGED }],
    [
      { field: 'newPassword', rule: 'blocklisted' },
      {
        newPassword:
          'このパスワードは推測されやすいため、使えません。別のパスワードを入力してください。',
      },
    ],
    [
      { field: 'newPassword', rule: 'too_small' },
      {
        newPassword: 'パスワードが短すぎます。15 文字以上で入力してください。',
      },
    ],
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
      newPassword:
        'このパスワードは推測されやすいため、使えません。別のパスワードを入力してください。',
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
        message: '入力した内容を確かめて、もう一度お試しください。',
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

describe('afterUnsent', () => {
  it('should say why nothing came of a request', () => {
    expect(afterUnsent({ type: 'tooManyRequests' })).toBe(TOO_MANY)
    expect(afterUnsent({ type: 'failed' })).toBe(NOT_SENT)
  })
})

describe('unreadMessageOf', () => {
  it('should name what could not be read, or say that there were too many requests', () => {
    expect(unreadMessageOf('アカウント', { type: 'failed' })).toBe(
      'アカウントを読み込めませんでした。通信の状態を確かめて、もう一度お試しください。',
    )
    expect(unreadMessageOf('アカウント', { type: 'tooManyRequests' })).toBe(
      TOO_MANY,
    )
  })
})

const GONE: SessionPage = { type: 'cursorGone' }

const page = (
  sessions: ModelsSessionResponse[],
  total: number | null,
  nextCursor: string | null,
): SessionPage => ({ type: 'found', sessions, total, nextCursor })

describe('the pages of the sessions', () => {
  it('should put the pages together, with the count of the last', () => {
    expect(
      listingOf([
        page([thisDevice, unrecorded], 4, unrecorded.id),
        page([phone], 3, phone.id),
      ]),
    ).toEqual({
      type: 'listed',
      sessions: [thisDevice, unrecorded, phone],
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
        sessions: [thisDevice],
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
      sessions: [thisDevice, phone],
      total: 2,
      rest: 'none',
    })
  })

  it('should leave pages that no longer show the session as they are: they were read again', () => {
    const pages = [page([thisDevice], 2, thisDevice.id), page([phone], 2, null)]

    expect(withoutSession(pages, unrecorded.id)).toEqual(pages)
  })

  it('should leave a count the API did not give', () => {
    expect(
      withoutSession([page([thisDevice, phone], null, null)], phone.id),
    ).toEqual([page([thisDevice], null, null)])
  })
})

type Rest = Parameters<typeof moreOf>[0]
type Fetching = Parameters<typeof moreOf>[1]

const MORE: [Rest, Fetching, More][] = [
  ['none', { nextPage: false, again: false }, 'none'],
  ['more', { nextPage: false, again: false }, 'available'],
  ['more', { nextPage: true, again: false }, 'loading'],
  ['unread', { nextPage: false, again: false }, 'failed'],
  ['unread', { nextPage: false, again: true }, 'loading'],
]

describe('moreOf', () => {
  it.each(MORE)('should make of %s, while %o, %s', (rest, fetching, more) => {
    expect(moreOf(rest, fetching)).toBe(more)
  })
})
