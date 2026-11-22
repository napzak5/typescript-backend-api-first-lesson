import {
  answering,
  asked,
  empty,
  page,
  problem,
  record,
  sent,
  UNREAD,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { consentForm } from '../attachments/components/examples'
import {
  forTheCustomer,
  SHARE_LINKS_OF_THE_FILE,
  TOKEN,
} from './components/examples'
import {
  issueShareLink,
  readShareLink,
  readShareLinkPage,
  revokeShareLink,
  shareLinkKeyOf,
  shareLinksKeyOf,
} from './share-links-api'

/*
 * What the API answers to the share links is met with the real API
 * (`share-links.integration.test.tsx`). Here are the answers a test cannot
 * bring about there, and what is asked.
 */

type Answer = () => Response | Promise<Response>

afterEach(() => {
  vi.unstubAllGlobals()
})

const REQUEST = {
  expiresAt: '2026-11-28T01:00:00.000Z',
  maxDownloads: 3,
  password: 'umi no mieru heya',
}

describe('shareLinksKeyOf and shareLinkKeyOf', () => {
  it('should list the links below the file, and read a link by its ID, in small letters', () => {
    expect(shareLinksKeyOf(consentForm.id.toUpperCase())).toEqual([
      'share-links',
      consentForm.id,
    ])
    expect(shareLinkKeyOf(forTheCustomer.id.toUpperCase())).toEqual([
      'share-link',
      forTheCustomer.id,
    ])
  })
})

describe('readShareLinkPage', () => {
  it('should ask for a page of twenty links of the file after the cursor', async () => {
    // Arrange
    const fetched = answering(() => page(SHARE_LINKS_OF_THE_FILE, 'next', 23))

    // Act
    const read = await readShareLinkPage(consentForm.id, 'cursor')

    // Assert
    expect(read).toEqual({
      type: 'found',
      items: SHARE_LINKS_OF_THE_FILE,
      total: 23,
      nextCursor: 'next',
    })
    expect(asked(fetched)).toEqual([
      `GET /attachments/${consentForm.id}/share-links?cursor=cursor&limit=20`,
    ])
  })

  it.each<[string, Answer, string]>([
    ['a role that shares no file', () => problem(403), 'forbidden'],
    ['a file removed meanwhile', () => problem(404), 'notFound'],
    ['a cursor of a link revoked meanwhile', () => problem(400), 'failed'],
    ...UNREAD,
  ])('should read no page after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readShareLinkPage(consentForm.id, undefined)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('readShareLink', () => {
  it('should ask for the link by its ID', async () => {
    // Arrange
    const fetched = answering(() => record(200, forTheCustomer))

    // Act
    const read = await readShareLink(forTheCustomer.id)

    // Assert
    expect(read).toEqual({ type: 'found', shareLink: forTheCustomer })
    expect(asked(fetched)).toEqual([
      `GET /attachments/share-links/${forTheCustomer.id}`,
    ])
  })

  it.each<[string, Answer, string]>([
    ['a link that is none or was revoked', () => problem(404), 'notFound'],
    ['an ID that is none', () => problem(400), 'notFound'],
    ['a link of a file of another salon', () => problem(403), 'forbidden'],
    ...UNREAD,
  ])('should read no link after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readShareLink(forTheCustomer.id)

    // Assert
    expect(read).toEqual({ type })
  })
})

describe('issueShareLink', () => {
  it('should send the end, the limit and the password, and keep the token the API gives once', async () => {
    // Arrange
    const fetched = answering(() =>
      record(201, { shareLink: forTheCustomer, token: TOKEN }),
    )

    // Act
    const issued = await issueShareLink(consentForm.id, REQUEST)

    // Assert
    expect(issued).toEqual({
      type: 'issued',
      shareLink: forTheCustomer,
      token: TOKEN,
    })
    expect(asked(fetched)).toEqual([
      `POST /attachments/${consentForm.id}/share-links`,
    ])
    expect(await sent(fetched)).toEqual([REQUEST])
  })

  it('should name the values the API refused', async () => {
    // Arrange
    answering(() => problem(400, [{ field: 'password', rule: 'blocklisted' }]))

    // Act
    const issued = await issueShareLink(consentForm.id, REQUEST)

    // Assert
    expect(issued).toEqual({
      type: 'invalid',
      values: [{ field: 'password', rule: 'blocklisted' }],
    })
  })

  it.each<[string, Answer, string]>([
    ['a file removed meanwhile', () => problem(404), 'notFound'],
    ['a file whose upload was not finished', () => problem(409), 'notUploaded'],
    ['a role that shares no file', () => problem(403), 'forbidden'],
    ['a body too large', () => problem(413), 'failed'],
    ['a body of another kind', () => problem(415), 'failed'],
    ...UNREAD,
  ])('should issue no link after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const issued = await issueShareLink(consentForm.id, REQUEST)

    // Assert
    expect(issued).toEqual({ type })
  })
})

describe('revokeShareLink', () => {
  it('should ask to delete the link', async () => {
    // Arrange
    const fetched = answering(() => empty(204))

    // Act
    const revoked = await revokeShareLink(forTheCustomer.id)

    // Assert
    expect(revoked).toEqual({ type: 'revoked' })
    expect(asked(fetched)).toEqual([
      `DELETE /attachments/share-links/${forTheCustomer.id}`,
    ])
    expect(await sent(fetched)).toEqual([])
  })

  it.each<[string, Answer, string]>([
    ['a link revoked meanwhile', () => problem(404), 'notFound'],
    ['an ID that is none', () => problem(400), 'notFound'],
    ['a role that shares no file', () => problem(403), 'forbidden'],
    ...UNREAD,
  ])('should revoke nothing after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const revoked = await revokeShareLink(forTheCustomer.id)

    // Assert
    expect(revoked).toEqual({ type })
  })
})
