import { Result } from '@beauty-salon-backend/utility'
import { describe, expect, it, vi } from 'vitest'
import {
  CreateShareLinkUseCase,
  DeleteShareLinkUseCase,
  GetSharedFileUseCase,
  GetShareLinkUseCase,
  IssueSharedFileDownloadUrlUseCase,
  ListShareLinksUseCase,
} from '../business-logic/share-link'
import type { DbAttachment } from '../models/attachment'
import type { Actor } from '../models/auth'
import type { DbShareLink } from '../models/share-link'
import type {
  SharedAttachment,
  ShareLinkList,
} from '../repositories/share-link.repository'
import { type DomainError, DomainErrors } from '../shared'
import {
  ATTACHMENT_ID,
  DOWNLOAD_URL,
  dbAttachment,
} from './attachment-fixtures'
import { actors, NOW, USER_ID } from './auth-fixtures'
import { brokenRules, SALON_ID } from './fixtures'
import {
  apiShareLink,
  dbShareLink,
  OTHER_SHARE_LINK_ID,
  SHARE_LINK_ID,
  SHARE_PASSWORD,
  SHARE_PASSWORD_HASH,
  sharedAttachment,
  shareLinkDependencies,
  TOKEN,
  TOKEN_HASH,
} from './share-link-fixtures'

const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

const forbidden = Result.error(DomainErrors.forbidden())
const noAttachment = Result.error(
  DomainErrors.notFound('Attachment', ATTACHMENT_ID),
)
const noShareLink = Result.error(
  DomainErrors.notFound('Share link', SHARE_LINK_ID),
)
const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const storageDown = Result.error(
  DomainErrors.storage('The storage is down', null),
)

/** Those who manage the share links of the salon of the fixtures. */
const managers: [string, Actor][] = [
  ['an administrator', actors.admin],
  ['the owner of the salon', actors.ofSalon('owner')],
  ['a manager of the salon', actors.ofSalon('manager')],
]
/** Those who manage no share link. */
const others: [string, Actor][] = [
  ['a staff member of the salon', actors.ofSalon('staff')],
  ['a customer', actors.customer],
  ['a customer without a profile', actors.customerWithoutProfile],
  ['a user of no scope', actors.withoutScope],
]

const everySalon = { type: 'everySalon' }
const ofTheSalon = { type: 'salon', salonId: SALON_ID }

const noAttachmentFound = {
  findById: vi.fn(async () => Result.success<DbAttachment | null>(null)),
}

describe('CreateShareLinkUseCase', () => {
  const request = (overrides: Record<string, unknown> = {}) => ({
    expiresAt: '2026-11-21T09:00:00.000Z',
    maxDownloads: null,
    password: null,
    ...overrides,
  })
  const create = (
    dependencies = shareLinkDependencies(),
    actor: Actor = actors.admin,
    id: unknown = ATTACHMENT_ID,
    input: unknown = request(),
  ) => new CreateShareLinkUseCase(dependencies).execute(actor, id, input)

  it.each(managers)(
    'creates a link for %s and answers its token, of which the hash is written',
    async (_who, actor) => {
      const dependencies = shareLinkDependencies()

      const result = await create(dependencies, actor)

      expect(result).toStrictEqual({
        type: 'success',
        data: { shareLink: apiShareLink(), token: TOKEN },
      })
      // Created by the actor at `NOW` of the fixtures.
      expect(
        dependencies.shareLinkRepository.create,
      ).toHaveBeenCalledExactlyOnceWith({
        attachmentId: ATTACHMENT_ID,
        tokenHash: TOKEN_HASH,
        passwordHash: null,
        expiresAt: '2026-11-21T09:00:00.000Z',
        maxDownloads: null,
        createdBy: USER_ID,
        createdAt: '2026-11-14T09:00:00.000Z',
        updatedAt: '2026-11-14T09:00:00.000Z',
      })
      expect(dependencies.passwordHasher.hash).not.toHaveBeenCalled()
    },
  )

  it('writes the hash of the password, the limit of downloads and the end in UTC, and answers neither the password nor its hash', async () => {
    const dependencies = shareLinkDependencies({
      shareLinks: {
        create: vi.fn(async () =>
          Result.success(
            dbShareLink({ passwordHash: SHARE_PASSWORD_HASH, maxDownloads: 3 }),
          ),
        ),
      },
    })

    const result = await create(
      dependencies,
      actors.admin,
      ATTACHMENT_ID,
      request({
        expiresAt: '2026-11-21T09:00:00Z',
        maxDownloads: 3,
        password: SHARE_PASSWORD,
      }),
    )

    expect(result).toStrictEqual({
      type: 'success',
      data: {
        shareLink: apiShareLink({ hasPassword: true, maxDownloads: 3 }),
        token: TOKEN,
      },
    })
    expect(
      dependencies.shareLinkRepository.create,
    ).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        passwordHash: SHARE_PASSWORD_HASH,
        maxDownloads: 3,
        expiresAt: '2026-11-21T09:00:00.000Z',
      }),
    )
    expect(JSON.stringify(result)).not.toContain(SHARE_PASSWORD)
  })

  it('hashes the password in the one form it is compared in', async () => {
    const dependencies = shareLinkDependencies()

    await create(
      dependencies,
      actors.admin,
      ATTACHMENT_ID,
      // "é" as two code points.
      request({ password: 'café au lait' }),
    )

    expect(dependencies.passwordHasher.hash).toHaveBeenCalledExactlyOnceWith(
      'café au lait',
    )
  })

  it.each<[string, Actor, unknown]>([
    ['an administrator', actors.admin, everySalon],
    ['the owner of the salon', actors.ofSalon('owner'), ofTheSalon],
    ['a manager of the salon', actors.ofSalon('manager'), ofTheSalon],
  ])(
    'looks for the attachment within what %s reaches',
    async (_who, actor, reach) => {
      const dependencies = shareLinkDependencies()

      await create(dependencies, actor)

      expect(
        dependencies.attachmentRepository.findById,
      ).toHaveBeenCalledExactlyOnceWith(reach, ATTACHMENT_ID)
    },
  )

  it.each(others)('refuses %s, and looks at nothing', async (_who, actor) => {
    const dependencies = shareLinkDependencies()

    expect(await create(dependencies, actor)).toEqual(forbidden)
    expect(dependencies.attachmentRepository.findById).not.toHaveBeenCalled()
    expect(dependencies.shareLinkRepository.create).not.toHaveBeenCalled()
  })

  it('looks at who asks, then at the ID, then at the request, then for the attachment', async () => {
    const dependencies = shareLinkDependencies({
      attachments: noAttachmentFound,
    })

    expect(
      await create(dependencies, actors.ofSalon('staff'), 'no-id', {}),
    ).toEqual(forbidden)
    expect(
      rulesOf(await create(dependencies, actors.admin, 'no-id', {})),
    ).toEqual(['attachmentId:invalid_format'])
    expect(
      rulesOf(
        await create(
          dependencies,
          actors.admin,
          ATTACHMENT_ID,
          request({ expiresAt: '2026-11-14T09:00:00.000Z' }),
        ),
      ),
    ).toEqual(['expiresAt:too_small'])
    expect(dependencies.attachmentRepository.findById).not.toHaveBeenCalled()
    expect(await create(dependencies)).toEqual(noAttachment)
  })

  it.each([
    ['a millisecond from now', '2026-11-14T09:00:00.001Z'],
    ['30 days from now', '2026-12-14T09:00:00.000Z'],
    ['30 days from now, written with an offset', '2026-12-14T09:00:00Z'],
  ])('takes an end %s', async (_case, expiresAt) => {
    const result = await create(
      shareLinkDependencies(),
      actors.admin,
      ATTACHMENT_ID,
      request({ expiresAt }),
    )

    expect(result.type).toBe('success')
  })

  it.each([
    ['now', '2026-11-14T09:00:00.000Z', 'expiresAt:too_small'],
    ['a millisecond ago', '2026-11-14T08:59:59.999Z', 'expiresAt:too_small'],
    ['a year ago', '2025-11-14T09:00:00.000Z', 'expiresAt:too_small'],
    [
      'a millisecond more than 30 days from now',
      '2026-12-14T09:00:00.001Z',
      'expiresAt:too_big',
    ],
    ['a year from now', '2027-11-14T09:00:00.000Z', 'expiresAt:too_big'],
  ])(
    'refuses an end %s, and writes nothing',
    async (_case, expiresAt, rule) => {
      const dependencies = shareLinkDependencies()

      const result = await create(
        dependencies,
        actors.admin,
        ATTACHMENT_ID,
        request({ expiresAt }),
      )

      expect(rulesOf(result)).toEqual([rule])
      expect(dependencies.shareLinkRepository.create).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['digits in their order', '12345678'],
    ['digits downwards', '87654321'],
    ['the word itself', 'password'],
    ['the word itself, dressed up', 'Passw0rd!'],
    ['the word itself and a count', 'password123'],
    ['a stretch of a keyboard row', 'qwertyui'],
    ['one character repeated', 'aaaaaaaa'],
    ['a unit repeated', 'abc1abc1abc1'],
  ])(
    'refuses a password that is too easy to guess: %s',
    async (_case, password) => {
      const dependencies = shareLinkDependencies()

      const result = await create(
        dependencies,
        actors.admin,
        ATTACHMENT_ID,
        request({ password }),
      )

      expect(rulesOf(result)).toEqual(['password:blocklisted'])
      expect(dependencies.passwordHasher.hash).not.toHaveBeenCalled()
      expect(dependencies.shareLinkRepository.create).not.toHaveBeenCalled()
    },
  )

  it('says of a refused password why it is, without repeating it', async () => {
    const result = await create(
      shareLinkDependencies(),
      actors.admin,
      ATTACHMENT_ID,
      request({ password: 'Passw0rd!' }),
    )

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        issues: [
          {
            field: 'password',
            rule: 'blocklisted',
            message: expect.stringContaining('too easy to guess'),
          },
        ],
      },
    })
    expect(JSON.stringify(result)).not.toContain('Passw0rd!')
  })

  it.each([
    ['of 8 characters', 'tram-42x'],
    ['of 128 characters', `violet tram ${'x7 '.repeat(38)}42`],
    ['of 8 characters outside the basic plane', '𠮷野家で髪を切る'.slice(0, 9)],
    ['that holds the word itself among others', 'password of the salon'],
    ['in Japanese', 'むらさきの路面電車'],
  ])('takes a password %s', async (_case, password) => {
    expect([...password].length).toBeGreaterThanOrEqual(8)
    expect([...password].length).toBeLessThanOrEqual(128)

    const result = await create(
      shareLinkDependencies(),
      actors.admin,
      ATTACHMENT_ID,
      request({ password }),
    )

    expect(result.type).toBe('success')
  })

  it.each<[string, unknown, string[]]>([
    [
      'no end',
      { maxDownloads: null, password: null },
      ['expiresAt:invalid_type'],
    ],
    [
      'an end that is null',
      request({ expiresAt: null }),
      ['expiresAt:invalid_type'],
    ],
    [
      'an end that is a date',
      request({ expiresAt: '2026-11-21' }),
      ['expiresAt:invalid_format'],
    ],
    [
      'an end in another time zone',
      request({ expiresAt: '2026-11-21T18:00:00+09:00' }),
      ['expiresAt:invalid_format'],
    ],
    [
      'no limit of downloads',
      { expiresAt: '2026-11-21T09:00:00.000Z', password: null },
      ['maxDownloads:invalid_type'],
    ],
    [
      'a limit of no download',
      request({ maxDownloads: 0 }),
      ['maxDownloads:too_small'],
    ],
    [
      'a limit below zero',
      request({ maxDownloads: -1 }),
      ['maxDownloads:too_small'],
    ],
    [
      'a limit that is no whole number',
      request({ maxDownloads: 1.5 }),
      ['maxDownloads:invalid_type'],
    ],
    [
      'a limit no column holds',
      request({ maxDownloads: 2_147_483_648 }),
      ['maxDownloads:too_big'],
    ],
    [
      'no password',
      { expiresAt: '2026-11-21T09:00:00.000Z', maxDownloads: null },
      ['password:invalid_type'],
    ],
    [
      'a password of 7 characters',
      request({ password: 'tram-42' }),
      ['password:too_small'],
    ],
    ['an empty password', request({ password: '' }), ['password:too_small']],
    [
      'a password of 129 characters',
      request({ password: `v${'x7 '.repeat(42)}42` }),
      ['password:too_big'],
    ],
    [
      'the addresses the link was once limited to',
      request({ allowedEmails: null }),
      ['allowedEmails:unrecognized_keys'],
    ],
    [
      'a token of its own',
      request({ token: 'chosen' }),
      ['token:unrecognized_keys'],
    ],
    ['a text', 'share', [':invalid_type']],
  ])('refuses %s', async (_case, input, rules) => {
    const dependencies = shareLinkDependencies()

    const result = await create(
      dependencies,
      actors.admin,
      ATTACHMENT_ID,
      input,
    )

    expect(rulesOf(result)).toEqual(rules)
    expect(dependencies.shareLinkRepository.create).not.toHaveBeenCalled()
  })

  it('reports an end and a password that are both refused together', async () => {
    const result = await create(
      shareLinkDependencies(),
      actors.admin,
      ATTACHMENT_ID,
      request({ expiresAt: '2027-11-14T09:00:00.000Z', password: '12345678' }),
    )

    expect(rulesOf(result)).toEqual([
      'expiresAt:too_big',
      'password:blocklisted',
    ])
  })

  it('answers an attachment that is not there as not found, and writes nothing', async () => {
    const dependencies = shareLinkDependencies({
      attachments: noAttachmentFound,
    })

    expect(
      await create(
        dependencies,
        actors.admin,
        ATTACHMENT_ID,
        request({ password: SHARE_PASSWORD }),
      ),
    ).toEqual(noAttachment)
    expect(dependencies.passwordHasher.hash).not.toHaveBeenCalled()
    expect(dependencies.shareLinkRepository.create).not.toHaveBeenCalled()
  })

  it('refuses an attachment that is not uploaded, and writes nothing', async () => {
    const dependencies = shareLinkDependencies({
      attachments: {
        findById: vi.fn(async () =>
          Result.success<DbAttachment | null>(dbAttachment()),
        ),
      },
    })

    expect(await create(dependencies)).toEqual(
      Result.error(
        DomainErrors.conflict('The attachment has not been uploaded'),
      ),
    )
    expect(dependencies.shareLinkRepository.create).not.toHaveBeenCalled()
  })

  it('writes nothing when the password could not be hashed', async () => {
    const dependencies = shareLinkDependencies({
      hasher: { hash: vi.fn(async () => databaseDown) },
    })

    expect(
      await create(
        dependencies,
        actors.admin,
        ATTACHMENT_ID,
        request({ password: SHARE_PASSWORD }),
      ),
    ).toEqual(databaseDown)
    expect(dependencies.shareLinkRepository.create).not.toHaveBeenCalled()
  })

  it.each([
    [
      'the attachment could not be looked for',
      { attachments: { findById: vi.fn(async () => databaseDown) } },
    ],
    [
      'the link could not be written',
      { shareLinks: { create: vi.fn(async () => databaseDown) } },
    ],
  ])('passes on that %s, and answers no token', async (_case, parts) => {
    const result = await create(shareLinkDependencies(parts))

    expect(result).toEqual(databaseDown)
    expect(JSON.stringify(result)).not.toContain(TOKEN)
  })

  it('answers no token for a written row that the API cannot present', async () => {
    const result = await create(
      shareLinkDependencies({
        shareLinks: {
          create: vi.fn(async () =>
            Result.success(dbShareLink({ expiresAt: 'no time' })),
          ),
        },
      }),
    )

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'database',
        message: `Stored share link ${SHARE_LINK_ID} does not match the API model`,
      },
    })
  })
})

describe('ListShareLinksUseCase', () => {
  const list = (
    dependencies = shareLinkDependencies(),
    actor: Actor = actors.admin,
    id: unknown = ATTACHMENT_ID,
    query: Result<unknown, DomainError> = Result.success({}),
  ) => new ListShareLinksUseCase(dependencies).execute(actor, id, query)

  it.each(managers)(
    'lists 20 links of the attachment for %s, from the first',
    async (_who, actor) => {
      const dependencies = shareLinkDependencies()

      const result = await list(dependencies, actor)

      expect(result).toStrictEqual({
        type: 'success',
        data: {
          data: [apiShareLink()],
          meta: {
            total: 1,
            limit: 20,
            hasMore: false,
            cursor: null,
            nextCursor: null,
            prevCursor: null,
          },
        },
      })
      expect(
        dependencies.shareLinkRepository.list,
      ).toHaveBeenCalledExactlyOnceWith({
        attachmentId: ATTACHMENT_ID,
        limit: 20,
        after: null,
      })
    },
  )

  it('lists the page the query asks for, names the next one by its last link, and says of each link whether it has a password', async () => {
    const dependencies = shareLinkDependencies({
      shareLinks: {
        list: vi.fn(async () =>
          Result.success<ShareLinkList | null>({
            shareLinks: [
              dbShareLink({ id: OTHER_SHARE_LINK_ID }),
              dbShareLink({
                passwordHash: SHARE_PASSWORD_HASH,
                maxDownloads: 3,
                downloadCount: 3,
              }),
            ],
            total: 5,
            hasMore: true,
          }),
        ),
      },
    })

    const result = await list(
      dependencies,
      actors.ofSalon('owner'),
      ATTACHMENT_ID,
      Result.success({ limit: 2, cursor: OTHER_SHARE_LINK_ID }),
    )

    expect(result).toStrictEqual({
      type: 'success',
      data: {
        data: [
          apiShareLink({ id: OTHER_SHARE_LINK_ID }),
          apiShareLink({
            hasPassword: true,
            maxDownloads: 3,
            downloadCount: 3,
          }),
        ],
        meta: {
          total: 5,
          limit: 2,
          hasMore: true,
          cursor: OTHER_SHARE_LINK_ID,
          nextCursor: SHARE_LINK_ID,
          prevCursor: null,
        },
      },
    })
    expect(
      dependencies.shareLinkRepository.list,
    ).toHaveBeenCalledExactlyOnceWith({
      attachmentId: ATTACHMENT_ID,
      limit: 2,
      after: OTHER_SHARE_LINK_ID,
    })
    expect(
      dependencies.attachmentRepository.findById,
    ).toHaveBeenCalledExactlyOnceWith(ofTheSalon, ATTACHMENT_ID)
  })

  it('names no next page for an attachment without links', async () => {
    const result = await list(
      shareLinkDependencies({
        shareLinks: {
          list: vi.fn(async () =>
            Result.success<ShareLinkList | null>({
              shareLinks: [],
              total: 0,
              hasMore: false,
            }),
          ),
        },
      }),
    )

    expect(result).toMatchObject({
      type: 'success',
      data: { data: [], meta: { total: 0, nextCursor: null } },
    })
  })

  it('refuses a cursor that names no link of the attachment', async () => {
    const result = await list(
      shareLinkDependencies({
        shareLinks: {
          list: vi.fn(async () => Result.success<ShareLinkList | null>(null)),
        },
      }),
      actors.admin,
      ATTACHMENT_ID,
      Result.success({ cursor: OTHER_SHARE_LINK_ID }),
    )

    expect(rulesOf(result)).toEqual(['cursor:not_found'])
  })

  it.each<[string, unknown, string[]]>([
    ['a limit of zero', { limit: 0 }, ['limit:too_small']],
    ['a limit over 100', { limit: 101 }, ['limit:too_big']],
    ['a limit that is a text', { limit: '20' }, ['limit:invalid_type']],
    ['a cursor that is no ID', { cursor: 'first' }, ['cursor:invalid_format']],
    [
      'a filter the list has not',
      { salonId: SALON_ID },
      ['salonId:unrecognized_keys'],
    ],
  ])('refuses %s, and lists nothing', async (_case, query, rules) => {
    const dependencies = shareLinkDependencies()

    const result = await list(
      dependencies,
      actors.admin,
      ATTACHMENT_ID,
      Result.success(query),
    )

    expect(rulesOf(result)).toEqual(rules)
    expect(dependencies.shareLinkRepository.list).not.toHaveBeenCalled()
  })

  it('looks at who asks, then at the ID, then at the query, then for the attachment', async () => {
    const undecoded = Result.error(
      DomainErrors.validation('Invalid share link search', [
        { field: 'limit', rule: 'invalid_type', message: 'Must be a number' },
      ]),
    )
    const dependencies = shareLinkDependencies({
      attachments: noAttachmentFound,
    })

    expect(
      await list(dependencies, actors.ofSalon('staff'), 'no-id', undecoded),
    ).toEqual(forbidden)
    expect(
      rulesOf(await list(dependencies, actors.admin, 'no-id', undecoded)),
    ).toEqual(['attachmentId:invalid_format'])
    expect(
      await list(dependencies, actors.admin, ATTACHMENT_ID, undecoded),
    ).toEqual(undecoded)
    expect(dependencies.attachmentRepository.findById).not.toHaveBeenCalled()
    expect(await list(dependencies)).toEqual(noAttachment)
    expect(dependencies.shareLinkRepository.list).not.toHaveBeenCalled()
  })

  it.each(others)('refuses %s', async (_who, actor) => {
    const dependencies = shareLinkDependencies()

    expect(await list(dependencies, actor)).toEqual(forbidden)
    expect(dependencies.shareLinkRepository.list).not.toHaveBeenCalled()
  })

  it.each([
    [
      'the attachment could not be looked for',
      { attachments: { findById: vi.fn(async () => databaseDown) } },
    ],
    [
      'the links could not be listed',
      { shareLinks: { list: vi.fn(async () => databaseDown) } },
    ],
  ])('passes on that %s', async (_case, parts) => {
    expect(await list(shareLinkDependencies(parts))).toEqual(databaseDown)
  })

  it('reports a listed row that the API cannot present', async () => {
    const result = await list(
      shareLinkDependencies({
        shareLinks: {
          list: vi.fn(async () =>
            Result.success<ShareLinkList | null>({
              shareLinks: [dbShareLink({ createdAt: 'no time' })],
              total: 1,
              hasMore: false,
            }),
          ),
        },
      }),
    )

    expect(result).toMatchObject({ type: 'error', error: { type: 'database' } })
  })
})

describe('GetShareLinkUseCase', () => {
  const get = (
    dependencies = shareLinkDependencies(),
    actor: Actor = actors.admin,
    id: unknown = SHARE_LINK_ID,
  ) => new GetShareLinkUseCase(dependencies).execute(actor, id)

  it.each<[string, Actor, unknown]>([
    ['an administrator', actors.admin, everySalon],
    ['the owner of the salon', actors.ofSalon('owner'), ofTheSalon],
    ['a manager of the salon', actors.ofSalon('manager'), ofTheSalon],
  ])(
    'answers the link to %s, looked for within what they reach',
    async (_who, actor, reach) => {
      const dependencies = shareLinkDependencies()

      const result = await get(dependencies, actor)

      expect(result).toStrictEqual({ type: 'success', data: apiShareLink() })
      expect(
        dependencies.shareLinkRepository.findById,
      ).toHaveBeenCalledExactlyOnceWith(reach, SHARE_LINK_ID)
    },
  )

  it('answers a link that has run out and issued every download it may, with neither hash', async () => {
    const result = await get(
      shareLinkDependencies({
        shareLinks: {
          findById: vi.fn(async () =>
            Result.success<DbShareLink | null>(
              dbShareLink({
                passwordHash: SHARE_PASSWORD_HASH,
                expiresAt: '2026-11-14 17:00:00+09',
                maxDownloads: 2,
                downloadCount: 2,
                failedAttempts: 5,
                lockedUntil: '2026-11-14 18:10:00+09',
              }),
            ),
          ),
        },
      }),
    )

    expect(result).toStrictEqual({
      type: 'success',
      data: apiShareLink({
        hasPassword: true,
        expiresAt: '2026-11-14T08:00:00.000Z',
        maxDownloads: 2,
        downloadCount: 2,
      }),
    })
  })

  it('answers a link that is not there as not found', async () => {
    const result = await get(
      shareLinkDependencies({
        shareLinks: {
          findById: vi.fn(async () => Result.success<DbShareLink | null>(null)),
        },
      }),
    )

    expect(result).toEqual(noShareLink)
  })

  it.each(others)('refuses %s, whatever the ID is', async (_who, actor) => {
    const dependencies = shareLinkDependencies()

    expect(await get(dependencies, actor, 'no-id')).toEqual(forbidden)
    expect(dependencies.shareLinkRepository.findById).not.toHaveBeenCalled()
  })

  it('refuses an ID that is none', async () => {
    const dependencies = shareLinkDependencies()

    expect(rulesOf(await get(dependencies, actors.admin, 'no-id'))).toEqual([
      'shareLinkId:invalid_format',
    ])
    expect(dependencies.shareLinkRepository.findById).not.toHaveBeenCalled()
  })

  it('passes on that the link could not be looked for', async () => {
    const result = await get(
      shareLinkDependencies({
        shareLinks: { findById: vi.fn(async () => databaseDown) },
      }),
    )

    expect(result).toEqual(databaseDown)
  })
})

describe('DeleteShareLinkUseCase', () => {
  const revoke = (
    dependencies = shareLinkDependencies(),
    actor: Actor = actors.admin,
    id: unknown = SHARE_LINK_ID,
  ) => new DeleteShareLinkUseCase(dependencies).execute(actor, id)

  it.each<[string, Actor, unknown]>([
    ['an administrator', actors.admin, everySalon],
    ['the owner of the salon', actors.ofSalon('owner'), ofTheSalon],
    ['a manager of the salon', actors.ofSalon('manager'), ofTheSalon],
  ])(
    'removes the link for %s, within what they reach',
    async (_who, actor, reach) => {
      const dependencies = shareLinkDependencies()

      expect(await revoke(dependencies, actor)).toStrictEqual({
        type: 'success',
        data: null,
      })
      expect(
        dependencies.shareLinkRepository.remove,
      ).toHaveBeenCalledExactlyOnceWith(reach, SHARE_LINK_ID)
    },
  )

  it('answers a link that is gone as not found', async () => {
    const result = await revoke(
      shareLinkDependencies({
        shareLinks: { remove: vi.fn(async () => Result.success(false)) },
      }),
    )

    expect(result).toEqual(noShareLink)
  })

  it.each(others)('refuses %s, whatever the ID is', async (_who, actor) => {
    const dependencies = shareLinkDependencies()

    expect(await revoke(dependencies, actor, 'no-id')).toEqual(forbidden)
    expect(dependencies.shareLinkRepository.remove).not.toHaveBeenCalled()
  })

  it('refuses an ID that is none', async () => {
    const dependencies = shareLinkDependencies()

    expect(rulesOf(await revoke(dependencies, actors.admin, 'no-id'))).toEqual([
      'shareLinkId:invalid_format',
    ])
    expect(dependencies.shareLinkRepository.remove).not.toHaveBeenCalled()
  })

  it('passes on that the link could not be removed', async () => {
    const result = await revoke(
      shareLinkDependencies({
        shareLinks: { remove: vi.fn(async () => databaseDown) },
      }),
    )

    expect(result).toEqual(databaseDown)
  })
})

/** The answer for a token that opens nothing. */
const nothingShared = Result.error(
  DomainErrors.notFound('Share link', 'of the token'),
)
const passwordRequired = Result.error(DomainErrors.passwordRequired())

/** A repository whose link has the password of the fixtures, and what else is given. */
const protectedLink = (overrides: Partial<DbShareLink> = {}) => ({
  findWorking: vi.fn(async () =>
    Result.success<SharedAttachment | null>({
      shareLink: dbShareLink({
        passwordHash: SHARE_PASSWORD_HASH,
        ...overrides,
      }),
      attachment: sharedAttachment(),
    }),
  ),
})
const noLink = {
  findWorking: vi.fn(async () => Result.success<SharedAttachment | null>(null)),
}

describe('GetSharedFileUseCase', () => {
  const open = (
    dependencies = shareLinkDependencies(),
    input: unknown = { token: TOKEN, password: null },
  ) => new GetSharedFileUseCase(dependencies).execute(input)
  const withPassword = (password: string | null) => ({ token: TOKEN, password })

  it('tells whoever presents the token of a link what its file is, and counts no download', async () => {
    const dependencies = shareLinkDependencies()

    const result = await open(dependencies)

    expect(result).toStrictEqual({
      type: 'success',
      data: { filename: '施術前.png', contentType: 'image/png', size: 64 },
    })
    expect(
      dependencies.shareLinkRepository.findWorking,
    ).toHaveBeenCalledExactlyOnceWith(TOKEN_HASH, NOW)
    expect(
      dependencies.shareLinkRepository.countDownload,
    ).not.toHaveBeenCalled()
    expect(dependencies.passwordHasher.verify).not.toHaveBeenCalled()
  })

  it('answers a token that opens nothing as not found, without repeating it, and checks no password', async () => {
    const dependencies = shareLinkDependencies({ shareLinks: noLink })

    const result = await open(dependencies, {
      token: 'a-token-nobody-issued',
      password: SHARE_PASSWORD,
    })

    expect(result).toEqual(nothingShared)
    expect(JSON.stringify(result)).not.toContain('a-token-nobody-issued')
    expect(dependencies.passwordHasher.verify).not.toHaveBeenCalled()
    expect(
      dependencies.shareLinkRepository.recordWrongPassword,
    ).not.toHaveBeenCalled()
  })

  it('asks a link without a password for none, and does not look at one that is sent', async () => {
    const dependencies = shareLinkDependencies()

    const result = await open(dependencies, withPassword('anything at all'))

    expect(result.type).toBe('success')
    expect(dependencies.passwordHasher.verify).not.toHaveBeenCalled()
    expect(
      dependencies.shareLinkRepository.recordWrongPassword,
    ).not.toHaveBeenCalled()
  })

  it('opens a protected link for its password, and writes nothing when no wrong one came before', async () => {
    const dependencies = shareLinkDependencies({ shareLinks: protectedLink() })

    const result = await open(dependencies, withPassword(SHARE_PASSWORD))

    expect(result.type).toBe('success')
    expect(dependencies.passwordHasher.verify).toHaveBeenCalledExactlyOnceWith(
      SHARE_PASSWORD,
      SHARE_PASSWORD_HASH,
    )
    expect(
      dependencies.shareLinkRepository.recordRightPassword,
    ).not.toHaveBeenCalled()
    expect(
      dependencies.shareLinkRepository.recordWrongPassword,
    ).not.toHaveBeenCalled()
  })

  it('compares the password in the one form it was hashed in', async () => {
    const dependencies = shareLinkDependencies({
      shareLinks: protectedLink({ passwordHash: 'hashed:café au lait' }),
    })

    const result = await open(dependencies, withPassword('café au lait'))

    expect(result.type).toBe('success')
  })

  it('refuses a protected link without a password, and counts no guess', async () => {
    const dependencies = shareLinkDependencies({ shareLinks: protectedLink() })

    expect(await open(dependencies)).toEqual(passwordRequired)
    expect(dependencies.passwordHasher.verify).not.toHaveBeenCalled()
    expect(
      dependencies.shareLinkRepository.recordWrongPassword,
    ).not.toHaveBeenCalled()
  })

  it('refuses a wrong password and counts it: the fifth locks the link for 15 minutes from now', async () => {
    const dependencies = shareLinkDependencies({ shareLinks: protectedLink() })

    const result = await open(dependencies, withPassword('violet tram 43'))

    expect(result).toEqual(passwordRequired)
    expect(
      dependencies.shareLinkRepository.recordWrongPassword,
    ).toHaveBeenCalledExactlyOnceWith(SHARE_LINK_ID, {
      threshold: 5,
      lockedUntil: '2026-11-14T09:15:00.000Z',
    })
    expect(
      dependencies.shareLinkRepository.recordRightPassword,
    ).not.toHaveBeenCalled()
  })

  it.each([
    ['its password', SHARE_PASSWORD],
    ['a wrong password', 'violet tram 43'],
  ])(
    'refuses a locked link %s after it hashed it, and counts nothing',
    async (_case, password) => {
      const dependencies = shareLinkDependencies({
        shareLinks: protectedLink({
          failedAttempts: 5,
          // A millisecond after `NOW` of the fixtures.
          lockedUntil: '2026-11-14 18:00:00.001+09',
        }),
      })

      const result = await open(dependencies, withPassword(password))

      expect(result).toEqual(passwordRequired)
      expect(dependencies.passwordHasher.verify).toHaveBeenCalledTimes(1)
      expect(
        dependencies.shareLinkRepository.recordWrongPassword,
      ).not.toHaveBeenCalled()
      expect(
        dependencies.shareLinkRepository.recordRightPassword,
      ).not.toHaveBeenCalled()
    },
  )

  it.each([
    [
      'whose lock has run out',
      { failedAttempts: 5, lockedUntil: '2026-11-14 18:00:00+09' },
    ],
    ['that took wrong passwords and was not locked', { failedAttempts: 2 }],
  ])(
    'opens a link %s for its password, and forgets the wrong ones',
    async (_case, state) => {
      const dependencies = shareLinkDependencies({
        shareLinks: protectedLink(state),
      })

      const result = await open(dependencies, withPassword(SHARE_PASSWORD))

      expect(result.type).toBe('success')
      expect(
        dependencies.shareLinkRepository.recordRightPassword,
      ).toHaveBeenCalledExactlyOnceWith(SHARE_LINK_ID)
    },
  )

  it('counts a wrong password on a link whose lock has run out, which locks it again', async () => {
    const dependencies = shareLinkDependencies({
      shareLinks: protectedLink({
        failedAttempts: 5,
        lockedUntil: '2026-11-14 18:00:00+09',
      }),
    })

    const result = await open(dependencies, withPassword('violet tram 43'))

    expect(result).toEqual(passwordRequired)
    expect(
      dependencies.shareLinkRepository.recordWrongPassword,
    ).toHaveBeenCalledTimes(1)
  })

  it.each<[string, unknown, string[]]>([
    ['no token', { password: null }, ['token:invalid_type']],
    ['an empty token', { token: '', password: null }, ['token:too_small']],
    [
      'a token of 256 characters',
      { token: 't'.repeat(256), password: null },
      ['token:too_big'],
    ],
    ['no password, not even null', { token: TOKEN }, ['password:invalid_type']],
    [
      'an empty password',
      { token: TOKEN, password: '' },
      ['password:too_small'],
    ],
    [
      'a password of 129 characters',
      { token: TOKEN, password: 'p'.repeat(129) },
      ['password:too_big'],
    ],
    [
      'a flag of the download',
      { token: TOKEN, password: null, inline: true },
      ['inline:unrecognized_keys'],
    ],
    ['a text', TOKEN, [':invalid_type']],
  ])('refuses %s, and looks for no link', async (_case, input, rules) => {
    const dependencies = shareLinkDependencies()

    expect(rulesOf(await open(dependencies, input))).toEqual(rules)
    expect(dependencies.shareLinkRepository.findWorking).not.toHaveBeenCalled()
  })

  it('takes a presented password of one character, which is only ever wrong', async () => {
    const dependencies = shareLinkDependencies({ shareLinks: protectedLink() })

    expect(await open(dependencies, withPassword('x'))).toEqual(
      passwordRequired,
    )
  })

  it.each([
    [
      'the link could not be looked for',
      { shareLinks: { findWorking: vi.fn(async () => databaseDown) } },
      SHARE_PASSWORD,
    ],
    [
      'the password could not be compared',
      {
        shareLinks: protectedLink(),
        hasher: { verify: vi.fn(async () => databaseDown) },
      },
      SHARE_PASSWORD,
    ],
    [
      'the wrong password could not be counted',
      {
        shareLinks: {
          ...protectedLink(),
          recordWrongPassword: vi.fn(async () => databaseDown),
        },
      },
      'violet tram 43',
    ],
    [
      'the wrong passwords could not be forgotten',
      {
        shareLinks: {
          ...protectedLink({ failedAttempts: 1 }),
          recordRightPassword: vi.fn(async () => databaseDown),
        },
      },
      SHARE_PASSWORD,
    ],
  ])('passes on that %s', async (_case, parts, password) => {
    expect(
      await open(shareLinkDependencies(parts), withPassword(password)),
    ).toEqual(databaseDown)
  })
})

describe('IssueSharedFileDownloadUrlUseCase', () => {
  const request = (overrides: Record<string, unknown> = {}) => ({
    token: TOKEN,
    password: null,
    inline: false,
    ...overrides,
  })
  const issue = (
    dependencies = shareLinkDependencies(),
    input: unknown = request(),
  ) => new IssueSharedFileDownloadUrlUseCase(dependencies).execute(input)

  it('issues a URL that saves the file under its name for five minutes from now, and counts one download of the link', async () => {
    const dependencies = shareLinkDependencies()

    const result = await issue(dependencies)

    // `NOW` of the fixtures and five minutes.
    expect(result).toStrictEqual({
      type: 'success',
      data: {
        downloadUrl: DOWNLOAD_URL,
        expiresAt: '2026-11-14T09:05:00.000Z',
      },
    })
    expect(
      dependencies.shareLinkRepository.findWorking,
    ).toHaveBeenCalledExactlyOnceWith(TOKEN_HASH, NOW)
    expect(
      dependencies.fileStorage.issueDownload,
    ).toHaveBeenCalledExactlyOnceWith(
      {
        key: `attachments/${ATTACHMENT_ID}`,
        contentType: 'image/png',
        contentDisposition: `attachment; filename="___.png"; filename*=UTF-8''%E6%96%BD%E8%A1%93%E5%89%8D.png`,
      },
      new Date('2026-11-14T09:05:00.000Z'),
    )
    expect(
      dependencies.shareLinkRepository.countDownload,
    ).toHaveBeenCalledExactlyOnceWith(SHARE_LINK_ID, NOW)
  })

  it('issues a URL that shows the file in the browser when the request says so', async () => {
    const dependencies = shareLinkDependencies()

    await issue(dependencies, request({ inline: true }))

    expect(dependencies.fileStorage.issueDownload).toHaveBeenCalledWith(
      expect.objectContaining({
        contentDisposition: expect.stringMatching(/^inline; /),
      }),
      expect.any(Date),
    )
  })

  it.each([
    [
      'two and a half minutes from now',
      '2026-11-14 18:02:30+09',
      '2026-11-14T09:02:30.000Z',
    ],
    [
      'five minutes from now',
      '2026-11-14 18:05:00+09',
      '2026-11-14T09:05:00.000Z',
    ],
    [
      'a millisecond after that',
      '2026-11-14 18:05:00.001+09',
      '2026-11-14T09:05:00.000Z',
    ],
  ])(
    'issues a URL that works no longer than the link, which ends %s',
    async (_case, linkEnds, urlEnds) => {
      const dependencies = shareLinkDependencies({
        shareLinks: {
          findWorking: vi.fn(async () =>
            Result.success<SharedAttachment | null>({
              shareLink: dbShareLink({ expiresAt: linkEnds }),
              attachment: sharedAttachment(),
            }),
          ),
        },
      })

      const result = await issue(dependencies)

      expect(result).toMatchObject({ data: { expiresAt: urlEnds } })
      expect(dependencies.fileStorage.issueDownload).toHaveBeenCalledWith(
        expect.anything(),
        new Date(urlEnds),
      )
    },
  )

  it('signs the URL before it counts the download', async () => {
    const calls: string[] = []
    const dependencies = shareLinkDependencies({
      storage: {
        issueDownload: vi.fn(async () => {
          calls.push('sign')
          return Result.success(DOWNLOAD_URL)
        }),
      },
      shareLinks: {
        countDownload: vi.fn(async () => {
          calls.push('count')
          return Result.success(true)
        }),
      },
    })

    await issue(dependencies)

    expect(calls).toEqual(['sign', 'count'])
  })

  it('counts no download when the URL could not be signed', async () => {
    const dependencies = shareLinkDependencies({
      storage: { issueDownload: vi.fn(async () => storageDown) },
    })

    expect(await issue(dependencies)).toEqual(storageDown)
    expect(
      dependencies.shareLinkRepository.countDownload,
    ).not.toHaveBeenCalled()
  })

  it('answers no URL when the link works no more by the time the download is counted', async () => {
    const result = await issue(
      shareLinkDependencies({
        shareLinks: { countDownload: vi.fn(async () => Result.success(false)) },
      }),
    )

    expect(result).toEqual(nothingShared)
    expect(JSON.stringify(result)).not.toContain(DOWNLOAD_URL)
  })

  it('opens a protected link for its password, and signs and counts nothing for a wrong one', async () => {
    const dependencies = shareLinkDependencies({ shareLinks: protectedLink() })

    expect(
      (await issue(dependencies, request({ password: SHARE_PASSWORD }))).type,
    ).toBe('success')
    expect(
      dependencies.shareLinkRepository.countDownload,
    ).toHaveBeenCalledTimes(1)

    expect(
      await issue(dependencies, request({ password: 'violet tram 43' })),
    ).toEqual(passwordRequired)
    expect(await issue(dependencies)).toEqual(passwordRequired)
    expect(dependencies.fileStorage.issueDownload).toHaveBeenCalledTimes(1)
    expect(
      dependencies.shareLinkRepository.countDownload,
    ).toHaveBeenCalledTimes(1)
  })

  it('signs and counts nothing for a token that opens nothing', async () => {
    const dependencies = shareLinkDependencies({ shareLinks: noLink })

    expect(await issue(dependencies)).toEqual(nothingShared)
    expect(dependencies.fileStorage.issueDownload).not.toHaveBeenCalled()
    expect(
      dependencies.shareLinkRepository.countDownload,
    ).not.toHaveBeenCalled()
  })

  it.each<[string, unknown, string[]]>([
    [
      'no word on how the file is shown',
      { token: TOKEN, password: null },
      ['inline:invalid_type'],
    ],
    [
      'a word on it that is a text',
      request({ inline: 'true' }),
      ['inline:invalid_type'],
    ],
    ['no token', { password: null, inline: false }, ['token:invalid_type']],
    [
      'no password, not even null',
      { token: TOKEN, inline: false },
      ['password:invalid_type'],
    ],
    [
      'a name for the download',
      request({ filename: 'a.html' }),
      ['filename:unrecognized_keys'],
    ],
  ])('refuses %s, and looks for no link', async (_case, input, rules) => {
    const dependencies = shareLinkDependencies()

    expect(rulesOf(await issue(dependencies, input))).toEqual(rules)
    expect(dependencies.shareLinkRepository.findWorking).not.toHaveBeenCalled()
  })

  it('passes on that the download could not be counted, and answers no URL', async () => {
    const result = await issue(
      shareLinkDependencies({
        shareLinks: { countDownload: vi.fn(async () => databaseDown) },
      }),
    )

    expect(result).toEqual(databaseDown)
  })
})
