import { describe, expect, it } from 'vitest'
import { ShareLinkReadMapper } from '../mappers/read/share-link.mapper'
import { ShareLinkWriteMapper } from '../mappers/write/share-link.mapper'
import { attachmentIdSchema } from '../models/attachment'
import { shareLinkIdSchema } from '../models/share-link'
import { ATTACHMENT_ID } from './attachment-fixtures'
import {
  apiShareLink,
  dbShareLink,
  OTHER_SHARE_LINK_ID,
  SHARE_LINK_ID,
  SHARE_PASSWORD,
  TOKEN,
} from './share-link-fixtures'

describe('ShareLinkReadMapper.toApiShareLinkPage', () => {
  it('answers with the links of the list and where the list goes on', () => {
    const result = ShareLinkReadMapper.toApiShareLinkPage(
      {
        shareLinks: [dbShareLink(), dbShareLink({ id: OTHER_SHARE_LINK_ID })],
        total: 3,
        hasMore: true,
      },
      { limit: 2, after: null },
    )

    expect(result).toMatchObject({
      type: 'success',
      data: {
        data: [{ id: SHARE_LINK_ID }, { id: OTHER_SHARE_LINK_ID }],
        meta: {
          total: 3,
          limit: 2,
          hasMore: true,
          cursor: null,
          nextCursor: OTHER_SHARE_LINK_ID,
          prevCursor: null,
        },
      },
    })
  })

  it('fails as a whole when one stored link is invalid', () => {
    const result = ShareLinkReadMapper.toApiShareLinkPage(
      {
        shareLinks: [dbShareLink({ updatedAt: 'recently' })],
        total: 1,
        hasMore: false,
      },
      { limit: 20, after: null },
    )

    expect(result).toMatchObject({ type: 'error', error: { type: 'database' } })
  })
})

describe('ShareLinkReadMapper.toApiShareLinkCreate', () => {
  it('answers a new link as the API shows it, with its token', () => {
    expect(
      ShareLinkReadMapper.toApiShareLinkCreate(dbShareLink(), TOKEN),
    ).toStrictEqual({
      type: 'success',
      data: { shareLink: apiShareLink(), token: TOKEN },
    })
  })

  it('reports a stored link that is not valid as a database error, without the token', () => {
    const result = ShareLinkReadMapper.toApiShareLinkCreate(
      dbShareLink({ expiresAt: 'soon' }),
      TOKEN,
    )

    expect(result).toMatchObject({ type: 'error', error: { type: 'database' } })
    expect(JSON.stringify(result)).not.toContain(TOKEN)
  })
})

describe('ShareLinkWriteMapper.fromCreateRequest', () => {
  it('takes when the link ends, how often it downloads and its password, as the request states them', () => {
    expect(
      ShareLinkWriteMapper.fromCreateRequest({
        expiresAt: '2026-11-21T09:00:00.000Z',
        maxDownloads: 5,
        password: SHARE_PASSWORD,
      }),
    ).toStrictEqual({
      expiresAt: '2026-11-21T09:00:00.000Z',
      maxDownloads: 5,
      password: SHARE_PASSWORD,
    })
  })

  it('keeps a link without a limit and without a password as that', () => {
    expect(
      ShareLinkWriteMapper.fromCreateRequest({
        expiresAt: '2026-11-21T09:00:00.000Z',
        maxDownloads: null,
        password: null,
      }),
    ).toStrictEqual({
      expiresAt: '2026-11-21T09:00:00.000Z',
      maxDownloads: null,
      password: null,
    })
  })
})

describe('ShareLinkWriteMapper.fromSearchRequest', () => {
  const attachmentId = attachmentIdSchema.parse(ATTACHMENT_ID)

  it('asks for the first 20 links of the attachment when the request names nothing', () => {
    expect(
      ShareLinkWriteMapper.fromSearchRequest({}, attachmentId),
    ).toStrictEqual({ attachmentId: ATTACHMENT_ID, limit: 20, after: null })
  })

  it('takes the place the request names', () => {
    expect(
      ShareLinkWriteMapper.fromSearchRequest(
        { limit: 1, cursor: shareLinkIdSchema.parse(SHARE_LINK_ID) },
        attachmentId,
      ),
    ).toStrictEqual({
      attachmentId: ATTACHMENT_ID,
      limit: 1,
      after: SHARE_LINK_ID,
    })
  })
})

describe('what ShareLinkWriteMapper makes of what a viewer presents', () => {
  it('takes the token and the password of a viewer who asks what the file is', () => {
    expect(
      ShareLinkWriteMapper.fromSharedFileGetRequest({
        token: TOKEN,
        password: SHARE_PASSWORD,
      }),
    ).toStrictEqual({ token: TOKEN, password: SHARE_PASSWORD })
  })

  it('keeps a viewer without a password as that', () => {
    expect(
      ShareLinkWriteMapper.fromSharedFileGetRequest({
        token: TOKEN,
        password: null,
      }),
    ).toStrictEqual({ token: TOKEN, password: null })
  })

  it.each([true, false])(
    'takes the token, the password and inline=%s of a viewer who downloads the file',
    (inline) => {
      expect(
        ShareLinkWriteMapper.fromSharedFileDownloadUrlRequest({
          token: TOKEN,
          password: null,
          inline,
        }),
      ).toStrictEqual({ token: TOKEN, password: null, inline })
    },
  )
})
