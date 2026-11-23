import { Result } from '@beauty-salon-backend/utility'
import {
  attachmentMessages,
  entityMessages,
  ruleMessages,
} from '@beauty-salon-shared/i18n/messages/api'
import { describe, expect, it, vi } from 'vitest'
import {
  ATTACHMENT_ID,
  apiAttachment,
  apiUploadedAttachment,
  attachmentDependencies,
  bytesOf,
  DOWNLOAD_URL,
  dbAttachment,
  OTHER_ATTACHMENT_ID,
  PNG,
  UPLOAD_URL,
  UPLOADED,
} from '../../../__tests__/fixtures/attachment-fixtures'
import { actors, USER_ID } from '../../../__tests__/fixtures/auth-fixtures'
import {
  brokenRules,
  MADE_UP_MESSAGE,
  OTHER_SALON_ID,
  SALON_ID,
} from '../../../__tests__/fixtures/fixtures'
import type { DbAttachment } from '../../../models/attachment'
import type { Actor } from '../../../models/auth'
import type {
  AttachmentList,
  AttachmentPurge,
  IAttachmentRepository,
} from '../../../repositories/attachment.repository'
import type { StoredFile } from '../../../services/file-storage'
import { type DomainError, DomainErrors } from '../../../shared'
import {
  CompleteAttachmentUseCase,
  DeleteAttachmentUseCase,
  GetAttachmentUseCase,
  IssueAttachmentDownloadUrlUseCase,
  IssueAttachmentUploadUrlUseCase,
  ListAttachmentsUseCase,
  PurgeAttachmentsUseCase,
} from '..'

const OTHER_USER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f7a03'
const KEY = `attachments/${ATTACHMENT_ID}`

const rulesOf = (result: Result<unknown, DomainError>): string[] =>
  result.type === 'error' ? brokenRules(result.error) : []

const forbidden = Result.error(DomainErrors.forbidden())
const gone = Result.error(
  DomainErrors.notFound(entityMessages.attachment, ATTACHMENT_ID),
)
const databaseDown = Result.error(
  DomainErrors.database('Connection lost', null),
)
const storageDown = Result.error(
  DomainErrors.storage('The storage is down', null),
)

/** Those who reach the attachments of the salon of the fixtures. */
const members: [string, Actor][] = [
  ['an administrator', actors.admin],
  ['the owner of the salon', actors.ofSalon('owner')],
  ['a manager of the salon', actors.ofSalon('manager')],
  ['a staff member of the salon', actors.ofSalon('staff')],
]
/** Those who reach no attachment. */
const outsiders: [string, Actor][] = [
  ['a customer', actors.customer],
  ['a customer without a profile', actors.customerWithoutProfile],
  ['a user of no scope', actors.withoutScope],
]

const everySalon = { type: 'everySalon' }
const ofTheSalon = { type: 'salon', salonId: SALON_ID }

describe('IssueAttachmentUploadUrlUseCase', () => {
  const announcement = (overrides: Record<string, unknown> = {}) => ({
    filename: '施術前.png',
    contentType: 'image/png',
    size: 64,
    salonId: SALON_ID,
    ...overrides,
  })
  const issue = (
    dependencies = attachmentDependencies(),
    actor: Actor = actors.admin,
    input: unknown = announcement(),
  ) => new IssueAttachmentUploadUrlUseCase(dependencies).execute(actor, input)

  it.each(members)(
    'writes a pending attachment for %s and issues a URL for its key, its type and its size, until the attachment says it works',
    async (_who, actor) => {
      const dependencies = attachmentDependencies()

      const result = await issue(dependencies, actor)

      expect(result).toStrictEqual({
        type: 'success',
        data: {
          attachment: apiAttachment(),
          uploadUrl: UPLOAD_URL,
          uploadHeaders: { 'Content-Type': 'image/png', 'If-None-Match': '*' },
        },
      })
      expect(
        dependencies.attachmentRepository.create,
      ).toHaveBeenCalledExactlyOnceWith(
        {
          filename: '施術前.png',
          contentType: 'image/png',
          size: 64,
          salonId: SALON_ID,
          uploadedBy: USER_ID,
        },
        15,
      )
      expect(
        dependencies.fileStorage.issueUpload,
      ).toHaveBeenCalledExactlyOnceWith(
        { key: KEY, contentType: 'image/png', size: 64 },
        new Date('2026-11-18T02:15:00.654Z'),
      )
      expect(
        dependencies.salonRepository.exists,
      ).toHaveBeenCalledExactlyOnceWith(SALON_ID)
    },
  )

  it('writes an attachment of no salon for an administrator, and asks for no salon', async () => {
    const dependencies = attachmentDependencies({
      attachments: {
        create: vi.fn(async () =>
          Result.success(dbAttachment({ salonId: null })),
        ),
      },
    })

    const result = await issue(
      dependencies,
      actors.admin,
      announcement({ salonId: null }),
    )

    expect(result).toMatchObject({
      type: 'success',
      data: { attachment: { salonId: null } },
    })
    expect(dependencies.attachmentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ salonId: null }),
      15,
    )
    expect(dependencies.salonRepository.exists).not.toHaveBeenCalled()
  })

  it.each(outsiders)(
    'refuses %s before the request is looked at',
    async (_who, actor) => {
      const dependencies = attachmentDependencies()

      expect(await issue(dependencies, actor)).toEqual(forbidden)
      expect(await issue(dependencies, actor, { filename: '' })).toEqual(
        forbidden,
      )
      expect(dependencies.salonRepository.exists).not.toHaveBeenCalled()
      expect(dependencies.attachmentRepository.create).not.toHaveBeenCalled()
      expect(dependencies.fileStorage.issueUpload).not.toHaveBeenCalled()
    },
  )

  it.each<['owner' | 'manager' | 'staff']>([['owner'], ['manager'], ['staff']])(
    'refuses the %s of a salon a file of another salon and one of no salon, without asking whether the salon exists',
    async (role) => {
      const dependencies = attachmentDependencies()
      const actor = actors.ofSalon(role)

      expect(
        await issue(
          dependencies,
          actor,
          announcement({ salonId: OTHER_SALON_ID }),
        ),
      ).toEqual(forbidden)
      expect(
        await issue(dependencies, actor, announcement({ salonId: null })),
      ).toEqual(forbidden)
      expect(dependencies.salonRepository.exists).not.toHaveBeenCalled()
      expect(dependencies.attachmentRepository.create).not.toHaveBeenCalled()
    },
  )

  it('refuses a request that is not valid, and writes nothing', async () => {
    const dependencies = attachmentDependencies()

    const result = await issue(
      dependencies,
      actors.admin,
      announcement({ filename: 'a/b.png', size: 0, key: 'k' }),
    )

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        message: attachmentMessages.invalidAttachment,
      },
    })
    expect(rulesOf(result)).toEqual([
      'filename:custom',
      'size:too_small',
      'key:unrecognized_keys',
    ])
    expect(dependencies.salonRepository.exists).not.toHaveBeenCalled()
    expect(dependencies.attachmentRepository.create).not.toHaveBeenCalled()
  })

  it('refuses a salon that does not exist as an error of the request', async () => {
    const dependencies = attachmentDependencies({
      salons: { exists: vi.fn(async () => Result.success(false)) },
    })

    const result = await issue(dependencies)

    expect(result).toEqual(
      Result.error(
        DomainErrors.validation(attachmentMessages.invalidAttachment, [
          { field: 'salonId', rule: 'not_found', message: ruleMessages.aSalon },
        ]),
      ),
    )
    expect(dependencies.attachmentRepository.create).not.toHaveBeenCalled()
  })

  it('passes on that the salon could not be looked up, and writes nothing', async () => {
    const dependencies = attachmentDependencies({
      salons: { exists: vi.fn(async () => databaseDown) },
    })

    expect(await issue(dependencies)).toEqual(databaseDown)
    expect(dependencies.attachmentRepository.create).not.toHaveBeenCalled()
  })

  it('passes on that the attachment could not be written, and issues no URL', async () => {
    const dependencies = attachmentDependencies({
      attachments: { create: vi.fn(async () => databaseDown) },
    })

    expect(await issue(dependencies)).toEqual(databaseDown)
    expect(dependencies.fileStorage.issueUpload).not.toHaveBeenCalled()
  })

  it('passes on that the URL could not be issued', async () => {
    const dependencies = attachmentDependencies({
      storage: { issueUpload: vi.fn(async () => storageDown) },
    })

    expect(await issue(dependencies)).toEqual(storageDown)
  })

  it('issues no URL for a written row that the API cannot present', async () => {
    const dependencies = attachmentDependencies({
      attachments: {
        create: vi.fn(async () =>
          Result.success(dbAttachment({ uploadExpiresAt: 'in a while' })),
        ),
      },
    })

    expect(await issue(dependencies)).toMatchObject({
      type: 'error',
      error: { type: 'database' },
    })
    expect(dependencies.fileStorage.issueUpload).not.toHaveBeenCalled()
  })
})

describe('CompleteAttachmentUseCase', () => {
  const complete = (
    dependencies = attachmentDependencies(),
    actor: Actor = actors.admin,
    id: unknown = ATTACHMENT_ID,
  ) => new CompleteAttachmentUseCase(dependencies).execute(actor, id)

  /** Dependencies whose calls that write or remove are noted in their order. */
  const noting = (stored: StoredFile | null) => {
    const calls: string[] = []
    const dependencies = attachmentDependencies({
      attachments: {
        markUploaded: vi.fn(async () => {
          calls.push('markUploaded')
          return Result.success<DbAttachment | null>(dbAttachment(UPLOADED))
        }),
        markDeleted: vi.fn(async () => {
          calls.push('markDeleted')
          return Result.success(true)
        }),
      },
      storage: {
        inspect: vi.fn(async () => Result.success<StoredFile | null>(stored)),
        remove: vi.fn(async () => {
          calls.push('remove')
          return Result.success(null)
        }),
      },
    })
    return { calls, dependencies }
  }

  it.each(members)(
    'marks the attachment uploaded for %s when the file that was announced is stored',
    async (_who, actor) => {
      const dependencies = attachmentDependencies()

      const result = await complete(dependencies, actor)

      expect(result).toStrictEqual({
        type: 'success',
        data: apiUploadedAttachment(),
      })
      expect(dependencies.fileStorage.inspect).toHaveBeenCalledExactlyOnceWith(
        KEY,
        12,
      )
      expect(
        dependencies.attachmentRepository.markUploaded,
      ).toHaveBeenCalledExactlyOnceWith(ATTACHMENT_ID)
      expect(dependencies.fileStorage.remove).not.toHaveBeenCalled()
      expect(
        dependencies.attachmentRepository.markDeleted,
      ).not.toHaveBeenCalled()
    },
  )

  it('looks for the attachment within what the actor reaches', async () => {
    const dependencies = attachmentDependencies()

    await complete(dependencies, actors.admin)
    await complete(dependencies, actors.ofSalon('staff'))

    expect(dependencies.attachmentRepository.findById).toHaveBeenNthCalledWith(
      1,
      everySalon,
      ATTACHMENT_ID,
    )
    expect(dependencies.attachmentRepository.findById).toHaveBeenNthCalledWith(
      2,
      ofTheSalon,
      ATTACHMENT_ID,
    )
  })

  it('answers an attachment that is uploaded already as it is, and looks at nothing', async () => {
    const dependencies = attachmentDependencies({
      attachments: {
        findById: vi.fn(async () =>
          Result.success<DbAttachment | null>(dbAttachment(UPLOADED)),
        ),
      },
    })

    expect(await complete(dependencies)).toStrictEqual({
      type: 'success',
      data: apiUploadedAttachment(),
    })
    expect(dependencies.fileStorage.inspect).not.toHaveBeenCalled()
    expect(
      dependencies.attachmentRepository.markUploaded,
    ).not.toHaveBeenCalled()
  })

  it('refuses while nothing is stored, and leaves the attachment as it is', async () => {
    const { calls, dependencies } = noting(null)

    expect(await complete(dependencies)).toEqual(
      Result.error(
        DomainErrors.conflict('No file has been uploaded for the attachment'),
      ),
    )
    expect(calls).toEqual([])
  })

  it.each([
    ['a byte longer', 65],
    ['a byte shorter', 63],
    ['empty', 0],
  ])(
    'refuses a stored file that is %s than announced: deletes the attachment, then removes the file',
    async (_case, size) => {
      const { calls, dependencies } = noting({ size, head: bytesOf(PNG, 12) })

      expect(await complete(dependencies)).toEqual(
        Result.error(
          DomainErrors.conflict('The uploaded file is not of 64 bytes'),
        ),
      )
      expect(calls).toEqual(['markDeleted', 'remove'])
      expect(
        dependencies.attachmentRepository.markDeleted,
      ).toHaveBeenCalledExactlyOnceWith(ATTACHMENT_ID)
      expect(dependencies.fileStorage.remove).toHaveBeenCalledExactlyOnceWith(
        KEY,
      )
    },
  )

  it.each([
    ['an HTML document', [...Buffer.from('<!doctype html>')]],
    ['a JPEG image', [0xff, 0xd8, 0xff, 0xe0]],
    ['nothing known', []],
  ])(
    'refuses a stored file of the size announced that begins as %s: deletes the attachment, then removes the file',
    async (_case, begin) => {
      const { calls, dependencies } = noting({
        size: 64,
        head: bytesOf(begin, 12),
      })

      expect(await complete(dependencies)).toEqual(
        Result.error(
          DomainErrors.conflict(
            'The uploaded file is not a file of the type image/png',
          ),
        ),
      )
      expect(calls).toEqual(['markDeleted', 'remove'])
    },
  )

  it('says of a file that is wrong in size and in kind that its size is', async () => {
    const { dependencies } = noting({ size: 3, head: bytesOf([], 3) })

    expect(await complete(dependencies)).toEqual(
      Result.error(
        DomainErrors.conflict('The uploaded file is not of 64 bytes'),
      ),
    )
  })

  it('removes no file when the refused attachment could not be deleted', async () => {
    const dependencies = attachmentDependencies({
      attachments: { markDeleted: vi.fn(async () => databaseDown) },
      storage: {
        inspect: vi.fn(async () =>
          Result.success<StoredFile | null>({ size: 1, head: bytesOf(PNG, 1) }),
        ),
      },
    })

    expect(await complete(dependencies)).toEqual(databaseDown)
    expect(dependencies.fileStorage.remove).not.toHaveBeenCalled()
  })

  it('passes on that the refused file could not be removed, after the attachment is deleted', async () => {
    const dependencies = attachmentDependencies({
      storage: {
        inspect: vi.fn(async () =>
          Result.success<StoredFile | null>({ size: 1, head: bytesOf(PNG, 1) }),
        ),
        remove: vi.fn(async () => storageDown),
      },
    })

    expect(await complete(dependencies)).toEqual(storageDown)
    expect(dependencies.attachmentRepository.markDeleted).toHaveBeenCalledOnce()
  })

  it('passes on that the file could not be looked at, and changes nothing', async () => {
    const dependencies = attachmentDependencies({
      storage: { inspect: vi.fn(async () => storageDown) },
    })

    expect(await complete(dependencies)).toEqual(storageDown)
    expect(
      dependencies.attachmentRepository.markUploaded,
    ).not.toHaveBeenCalled()
    expect(dependencies.attachmentRepository.markDeleted).not.toHaveBeenCalled()
    expect(dependencies.fileStorage.remove).not.toHaveBeenCalled()
  })

  it('answers an attachment that is not there as not found, and looks at no file', async () => {
    const dependencies = attachmentDependencies({
      attachments: {
        findById: vi.fn(async () => Result.success<DbAttachment | null>(null)),
      },
    })

    expect(await complete(dependencies)).toEqual(gone)
    expect(dependencies.fileStorage.inspect).not.toHaveBeenCalled()
  })

  it('answers an attachment that went while its file was looked at as not found', async () => {
    const dependencies = attachmentDependencies({
      attachments: {
        markUploaded: vi.fn(async () =>
          Result.success<DbAttachment | null>(null),
        ),
      },
    })

    expect(await complete(dependencies)).toEqual(gone)
  })

  it.each([
    ['looked for', { findById: vi.fn(async () => databaseDown) }],
    ['marked', { markUploaded: vi.fn(async () => databaseDown) }],
  ])(
    'passes on that the attachment could not be %s',
    async (_case, attachments) => {
      expect(await complete(attachmentDependencies({ attachments }))).toEqual(
        databaseDown,
      )
    },
  )

  it.each(outsiders)('refuses %s, whatever the ID is', async (_who, actor) => {
    const dependencies = attachmentDependencies()

    expect(await complete(dependencies, actor)).toEqual(forbidden)
    expect(await complete(dependencies, actor, 'no-id')).toEqual(forbidden)
    expect(dependencies.attachmentRepository.findById).not.toHaveBeenCalled()
  })

  it('refuses an ID that is none', async () => {
    const dependencies = attachmentDependencies()

    const result = await complete(dependencies, actors.admin, 'latest')

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        message: attachmentMessages.invalidAttachmentId,
      },
    })
    expect(rulesOf(result)).toEqual(['attachmentId:invalid_format'])
    expect(dependencies.attachmentRepository.findById).not.toHaveBeenCalled()
  })
})

describe('GetAttachmentUseCase', () => {
  const get = (
    dependencies = attachmentDependencies(),
    actor: Actor = actors.admin,
    id: unknown = ATTACHMENT_ID,
  ) => new GetAttachmentUseCase(dependencies).execute(actor, id)

  it.each(members)(
    'answers the attachment for %s, a pending one too',
    async (_who, actor) => {
      expect(await get(attachmentDependencies(), actor)).toStrictEqual({
        type: 'success',
        data: apiAttachment(),
      })
    },
  )

  it('looks for the attachment within what the actor reaches, and asks nothing of the storage', async () => {
    const dependencies = attachmentDependencies()

    await get(dependencies, actors.ofSalon('manager'))

    expect(
      dependencies.attachmentRepository.findById,
    ).toHaveBeenCalledExactlyOnceWith(ofTheSalon, ATTACHMENT_ID)
    expect(dependencies.fileStorage.inspect).not.toHaveBeenCalled()
    expect(dependencies.fileStorage.issueDownload).not.toHaveBeenCalled()
  })

  it('answers an attachment that is not there as not found', async () => {
    const dependencies = attachmentDependencies({
      attachments: {
        findById: vi.fn(async () => Result.success<DbAttachment | null>(null)),
      },
    })

    expect(await get(dependencies)).toEqual(gone)
  })

  it('passes on that the attachment could not be looked for', async () => {
    const dependencies = attachmentDependencies({
      attachments: { findById: vi.fn(async () => databaseDown) },
    })

    expect(await get(dependencies)).toEqual(databaseDown)
  })

  it.each(outsiders)('refuses %s, whatever the ID is', async (_who, actor) => {
    const dependencies = attachmentDependencies()

    expect(await get(dependencies, actor)).toEqual(forbidden)
    expect(await get(dependencies, actor, 'no-id')).toEqual(forbidden)
    expect(dependencies.attachmentRepository.findById).not.toHaveBeenCalled()
  })

  it('refuses an ID that is none', async () => {
    const result = await get(attachmentDependencies(), actors.admin, 1)

    expect(rulesOf(result)).toEqual(['attachmentId:invalid_type'])
  })
})

describe('ListAttachmentsUseCase', () => {
  const list = (
    dependencies = attachmentDependencies(),
    actor: Actor = actors.admin,
    query: Result<unknown, DomainError> = Result.success({}),
  ) => new ListAttachmentsUseCase(dependencies).execute(actor, query)

  const listing = (found: AttachmentList | null) =>
    attachmentDependencies({
      attachments: {
        list: vi.fn(async () => Result.success<AttachmentList | null>(found)),
      },
    })

  it('lists 20 attachments of every salon and of none for an administrator, from the first', async () => {
    const dependencies = attachmentDependencies()

    const result = await list(dependencies)

    expect(result).toStrictEqual({
      type: 'success',
      data: {
        data: [apiUploadedAttachment()],
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
      dependencies.attachmentRepository.list,
    ).toHaveBeenCalledExactlyOnceWith({
      reach: everySalon,
      limit: 20,
      after: null,
      salonId: null,
    })
  })

  it.each<['owner' | 'manager' | 'staff']>([['owner'], ['manager'], ['staff']])(
    'lists those of their salon for the %s of a salon, named or not',
    async (role) => {
      const dependencies = attachmentDependencies()

      await list(dependencies, actors.ofSalon(role))
      await list(
        dependencies,
        actors.ofSalon(role),
        Result.success({ salonId: SALON_ID }),
      )

      expect(dependencies.attachmentRepository.list).toHaveBeenNthCalledWith(
        1,
        {
          reach: ofTheSalon,
          limit: 20,
          after: null,
          salonId: null,
        },
      )
      expect(dependencies.attachmentRepository.list).toHaveBeenNthCalledWith(
        2,
        {
          reach: ofTheSalon,
          limit: 20,
          after: null,
          salonId: SALON_ID,
        },
      )
    },
  )

  it('refuses a member of a salon who names another salon, and lists nothing', async () => {
    const dependencies = attachmentDependencies()

    expect(
      await list(
        dependencies,
        actors.ofSalon('owner'),
        Result.success({ salonId: OTHER_SALON_ID }),
      ),
    ).toEqual(forbidden)
    expect(dependencies.attachmentRepository.list).not.toHaveBeenCalled()
  })

  it('lists the page the query asks for: its limit, after its cursor, of its salon', async () => {
    const dependencies = listing({
      attachments: [
        dbAttachment({ ...UPLOADED, id: OTHER_ATTACHMENT_ID }),
        dbAttachment(UPLOADED),
      ],
      total: 7,
      hasMore: true,
    })

    const result = await list(
      dependencies,
      actors.admin,
      Result.success({
        limit: 2,
        cursor: OTHER_ATTACHMENT_ID,
        salonId: OTHER_SALON_ID,
      }),
    )

    expect(result).toMatchObject({
      type: 'success',
      data: {
        data: [{ id: OTHER_ATTACHMENT_ID }, { id: ATTACHMENT_ID }],
        meta: {
          total: 7,
          limit: 2,
          hasMore: true,
          cursor: OTHER_ATTACHMENT_ID,
          // The last attachment of the page.
          nextCursor: ATTACHMENT_ID,
          prevCursor: null,
        },
      },
    })
    expect(
      dependencies.attachmentRepository.list,
    ).toHaveBeenCalledExactlyOnceWith({
      reach: everySalon,
      limit: 2,
      after: OTHER_ATTACHMENT_ID,
      salonId: OTHER_SALON_ID,
    })
  })

  it('names no next page for the last one, and none for an empty list', async () => {
    const last = await list(
      listing({
        attachments: [dbAttachment(UPLOADED)],
        total: 3,
        hasMore: false,
      }),
    )
    const empty = await list(
      listing({ attachments: [], total: 0, hasMore: false }),
    )

    expect(last).toMatchObject({
      data: { meta: { total: 3, hasMore: false, nextCursor: null } },
    })
    expect(empty).toMatchObject({
      data: { data: [], meta: { total: 0, hasMore: false, nextCursor: null } },
    })
  })

  it('refuses a cursor that names no attachment of the list', async () => {
    const result = await list(
      listing(null),
      actors.admin,
      Result.success({ cursor: ATTACHMENT_ID }),
    )

    expect(result).toEqual(
      Result.error(
        DomainErrors.validation(attachmentMessages.invalidAttachmentSearch, [
          {
            field: 'cursor',
            rule: 'not_found',
            message: attachmentMessages.anAttachmentOfList,
          },
        ]),
      ),
    )
  })

  it.each<[string, unknown, string[]]>([
    ['a limit of zero', { limit: 0 }, ['limit:too_small']],
    ['a limit of 101', { limit: 101 }, ['limit:too_big']],
    ['a cursor that is no ID', { cursor: 'last' }, ['cursor:invalid_format']],
    [
      'a parameter of no list',
      { status: 'pending' },
      ['status:unrecognized_keys'],
    ],
  ])('refuses %s, and lists nothing', async (_case, query, rules) => {
    const dependencies = attachmentDependencies()

    const result = await list(dependencies, actors.admin, Result.success(query))

    expect(result).toMatchObject({
      type: 'error',
      error: {
        type: 'validation',
        message: attachmentMessages.invalidAttachmentSearch,
      },
    })
    expect(rulesOf(result)).toEqual(rules)
    expect(dependencies.attachmentRepository.list).not.toHaveBeenCalled()
  })

  it('passes on that the query could not be decoded, to who reaches attachments', async () => {
    const undecoded = Result.error(
      DomainErrors.validation(attachmentMessages.invalidAttachmentSearch, [
        { field: 'limit', rule: 'invalid_format', message: MADE_UP_MESSAGE },
      ]),
    )
    const dependencies = attachmentDependencies()

    expect(await list(dependencies, actors.admin, undecoded)).toEqual(undecoded)
    expect(await list(dependencies, actors.customer, undecoded)).toEqual(
      forbidden,
    )
    expect(dependencies.attachmentRepository.list).not.toHaveBeenCalled()
  })

  it.each(outsiders)('refuses %s', async (_who, actor) => {
    const dependencies = attachmentDependencies()

    expect(await list(dependencies, actor)).toEqual(forbidden)
    expect(
      await list(dependencies, actor, Result.success({ limit: 0 })),
    ).toEqual(forbidden)
    expect(dependencies.attachmentRepository.list).not.toHaveBeenCalled()
  })

  it('passes on that the attachments could not be listed', async () => {
    const dependencies = attachmentDependencies({
      attachments: { list: vi.fn(async () => databaseDown) },
    })

    expect(await list(dependencies)).toEqual(databaseDown)
  })

  it('reports a listed row that the API cannot present', async () => {
    const result = await list(
      listing({
        attachments: [dbAttachment({ ...UPLOADED, uploadedAt: 'yesterday' })],
        total: 1,
        hasMore: false,
      }),
    )

    expect(result).toMatchObject({ type: 'error', error: { type: 'database' } })
  })
})

describe('IssueAttachmentDownloadUrlUseCase', () => {
  const uploaded = {
    findById: vi.fn(async () =>
      Result.success<DbAttachment | null>(dbAttachment(UPLOADED)),
    ),
  }
  const issue = (
    dependencies = attachmentDependencies({ attachments: uploaded }),
    actor: Actor = actors.admin,
    id: unknown = ATTACHMENT_ID,
    query: Result<unknown, DomainError> = Result.success({}),
  ) =>
    new IssueAttachmentDownloadUrlUseCase(dependencies).execute(
      actor,
      id,
      query,
    )

  it.each(members)(
    'issues a URL for %s that saves the file under its name, as the kind it is of, for five minutes from now',
    async (_who, actor) => {
      const dependencies = attachmentDependencies({ attachments: uploaded })

      const result = await issue(dependencies, actor)

      // `NOW` of the fixtures and five minutes.
      expect(result).toStrictEqual({
        type: 'success',
        data: {
          downloadUrl: DOWNLOAD_URL,
          expiresAt: '2026-11-14T09:05:00.000Z',
        },
      })
      expect(
        dependencies.fileStorage.issueDownload,
      ).toHaveBeenCalledExactlyOnceWith(
        {
          key: KEY,
          contentType: 'image/png',
          contentDisposition: `attachment; filename="___.png"; filename*=UTF-8''%E6%96%BD%E8%A1%93%E5%89%8D.png`,
        },
        new Date('2026-11-14T09:05:00.000Z'),
      )
    },
  )

  it.each([
    ['shown in the browser', { inline: true }, 'inline'],
    ['saved', { inline: false }, 'attachment'],
  ])(
    'issues a URL by which the file is %s when the query says so',
    async (_case, query, kind) => {
      const dependencies = attachmentDependencies({ attachments: uploaded })

      await issue(
        dependencies,
        actors.admin,
        ATTACHMENT_ID,
        Result.success(query),
      )

      expect(dependencies.fileStorage.issueDownload).toHaveBeenCalledWith(
        expect.objectContaining({
          contentDisposition: expect.stringMatching(new RegExp(`^${kind}; `)),
        }),
        expect.any(Date),
      )
    },
  )

  it('refuses an attachment that is not uploaded, and issues nothing', async () => {
    const dependencies = attachmentDependencies()

    expect(await issue(dependencies)).toEqual(
      Result.error(
        DomainErrors.conflict('The attachment has not been uploaded'),
      ),
    )
    expect(dependencies.fileStorage.issueDownload).not.toHaveBeenCalled()
  })

  it('answers an attachment that is not there as not found', async () => {
    const dependencies = attachmentDependencies({
      attachments: {
        findById: vi.fn(async () => Result.success<DbAttachment | null>(null)),
      },
    })

    expect(await issue(dependencies)).toEqual(gone)
    expect(dependencies.fileStorage.issueDownload).not.toHaveBeenCalled()
  })

  it('looks at who asks, then at the ID, then at the query, then for the attachment', async () => {
    const undecoded = Result.error(
      DomainErrors.validation(attachmentMessages.invalidAttachmentDownload, [
        {
          field: 'inline',
          rule: 'invalid_value',
          message: MADE_UP_MESSAGE,
        },
      ]),
    )
    const dependencies = attachmentDependencies({
      attachments: {
        findById: vi.fn(async () => Result.success<DbAttachment | null>(null)),
      },
    })

    expect(
      await issue(dependencies, actors.customer, 'no-id', undecoded),
    ).toEqual(forbidden)
    expect(
      rulesOf(await issue(dependencies, actors.admin, 'no-id', undecoded)),
    ).toEqual(['attachmentId:invalid_format'])
    expect(
      await issue(dependencies, actors.admin, ATTACHMENT_ID, undecoded),
    ).toEqual(undecoded)
    expect(dependencies.attachmentRepository.findById).not.toHaveBeenCalled()
    expect(
      rulesOf(
        await issue(
          dependencies,
          actors.admin,
          ATTACHMENT_ID,
          Result.success({ filename: 'a.html' }),
        ),
      ),
    ).toEqual(['filename:unrecognized_keys'])
    expect(dependencies.attachmentRepository.findById).not.toHaveBeenCalled()
    expect(await issue(dependencies)).toEqual(gone)
  })

  it.each([
    [
      'the attachment could not be looked for',
      { attachments: { findById: vi.fn(async () => databaseDown) } },
      databaseDown,
    ],
    [
      'the URL could not be issued',
      {
        attachments: uploaded,
        storage: { issueDownload: vi.fn(async () => storageDown) },
      },
      storageDown,
    ],
  ])('passes on that %s', async (_case, parts, failure) => {
    expect(await issue(attachmentDependencies(parts))).toEqual(failure)
  })

  it.each(outsiders)('refuses %s', async (_who, actor) => {
    const dependencies = attachmentDependencies({ attachments: uploaded })

    expect(await issue(dependencies, actor)).toEqual(forbidden)
    expect(dependencies.fileStorage.issueDownload).not.toHaveBeenCalled()
  })
})

describe('DeleteAttachmentUseCase', () => {
  const remove = (
    dependencies = attachmentDependencies(),
    actor: Actor = actors.admin,
    id: unknown = ATTACHMENT_ID,
  ) => new DeleteAttachmentUseCase(dependencies).execute(actor, id)

  /** Dependencies of an attachment someone else uploaded, whose calls are noted in their order. */
  const noting = (attachments: Partial<IAttachmentRepository> = {}) => {
    const calls: string[] = []
    const dependencies = attachmentDependencies({
      attachments: {
        findById: vi.fn(async () =>
          Result.success<DbAttachment | null>(
            dbAttachment({ ...UPLOADED, uploadedBy: OTHER_USER_ID }),
          ),
        ),
        markDeleted: vi.fn(async () => {
          calls.push('markDeleted')
          return Result.success(true)
        }),
        ...attachments,
      },
      storage: {
        remove: vi.fn(async () => {
          calls.push('remove')
          return Result.success(null)
        }),
      },
    })
    return { calls, dependencies }
  }

  it.each(members.slice(0, 3))(
    'removes the file for %s, then deletes the attachment, though someone else uploaded it',
    async (_who, actor) => {
      const { calls, dependencies } = noting()

      expect(await remove(dependencies, actor)).toStrictEqual({
        type: 'success',
        data: null,
      })
      expect(calls).toEqual(['remove', 'markDeleted'])
      expect(dependencies.fileStorage.remove).toHaveBeenCalledExactlyOnceWith(
        KEY,
      )
      expect(
        dependencies.attachmentRepository.markDeleted,
      ).toHaveBeenCalledExactlyOnceWith(ATTACHMENT_ID)
    },
  )

  it('refuses a staff member what someone else uploaded, and removes nothing', async () => {
    const { calls, dependencies } = noting()

    expect(await remove(dependencies, actors.ofSalon('staff'))).toEqual(
      forbidden,
    )
    expect(calls).toEqual([])
  })

  it('lets a staff member delete what they uploaded themselves, a pending upload too', async () => {
    const dependencies = attachmentDependencies()

    expect(await remove(dependencies, actors.ofSalon('staff'))).toStrictEqual({
      type: 'success',
      data: null,
    })
    expect(dependencies.fileStorage.remove).toHaveBeenCalledExactlyOnceWith(KEY)
  })

  it('looks for the attachment within what the actor reaches', async () => {
    const dependencies = attachmentDependencies()

    await remove(dependencies, actors.ofSalon('owner'))

    expect(
      dependencies.attachmentRepository.findById,
    ).toHaveBeenCalledExactlyOnceWith(ofTheSalon, ATTACHMENT_ID)
  })

  it('deletes nothing when the file could not be removed', async () => {
    const dependencies = attachmentDependencies({
      storage: { remove: vi.fn(async () => storageDown) },
    })

    expect(await remove(dependencies)).toEqual(storageDown)
    expect(dependencies.attachmentRepository.markDeleted).not.toHaveBeenCalled()
  })

  it('answers an attachment that was deleted while its file was removed as not found', async () => {
    const { dependencies } = noting({
      markDeleted: vi.fn(async () => Result.success(false)),
    })

    expect(await remove(dependencies)).toEqual(gone)
  })

  it('answers an attachment that is not there as not found, and removes no file', async () => {
    const { calls, dependencies } = noting({
      findById: vi.fn(async () => Result.success<DbAttachment | null>(null)),
    })

    expect(await remove(dependencies)).toEqual(gone)
    expect(calls).toEqual([])
  })

  it.each([
    ['looked for', { findById: vi.fn(async () => databaseDown) }],
    ['deleted', { markDeleted: vi.fn(async () => databaseDown) }],
  ])(
    'passes on that the attachment could not be %s',
    async (_case, attachments) => {
      expect(await remove(attachmentDependencies({ attachments }))).toEqual(
        databaseDown,
      )
    },
  )

  it.each(outsiders)('refuses %s, whatever the ID is', async (_who, actor) => {
    const dependencies = attachmentDependencies()

    expect(await remove(dependencies, actor)).toEqual(forbidden)
    expect(await remove(dependencies, actor, 'no-id')).toEqual(forbidden)
    expect(dependencies.attachmentRepository.findById).not.toHaveBeenCalled()
    expect(dependencies.fileStorage.remove).not.toHaveBeenCalled()
  })

  it('refuses an ID that is none', async () => {
    const dependencies = attachmentDependencies()

    const result = await remove(dependencies, actors.admin, 'latest')

    expect(rulesOf(result)).toEqual(['attachmentId:invalid_format'])
    expect(dependencies.fileStorage.remove).not.toHaveBeenCalled()
  })
})

describe('PurgeAttachmentsUseCase', () => {
  const purge = (
    dependencies = attachmentDependencies(),
    actor: Actor = actors.admin,
  ) => new PurgeAttachmentsUseCase(dependencies).execute(actor)

  const THIRD_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f7a04'

  /** Dependencies in which the IDs given are to be purged, each with the outcome given. */
  const purging = (
    outcomes: [string, Result<AttachmentPurge, DomainError>][],
  ) =>
    attachmentDependencies({
      attachments: {
        purgeable: vi.fn(async () =>
          Result.success(outcomes.map(([id]) => id)),
        ),
        purge: vi.fn(
          async (id: string) =>
            outcomes.find(([purged]) => purged === id)?.[1] ?? databaseDown,
        ),
      },
    })

  it('asks for what is over with the 24 hours a pending upload is kept, purges one attachment after the other, and counts what it purged', async () => {
    const dependencies = purging([
      [ATTACHMENT_ID, Result.success({ type: 'purged' })],
      [OTHER_ATTACHMENT_ID, Result.success({ type: 'kept' })],
      [THIRD_ID, Result.success({ type: 'purged' })],
    ])

    expect(await purge(dependencies)).toStrictEqual({
      type: 'success',
      data: { purgedCount: 2 },
    })
    expect(
      dependencies.attachmentRepository.purgeable,
    ).toHaveBeenCalledExactlyOnceWith(24)
    expect(
      vi
        .mocked(dependencies.attachmentRepository.purge)
        .mock.calls.map(([id, hours]) => [id, hours]),
    ).toEqual([
      [ATTACHMENT_ID, 24],
      [OTHER_ATTACHMENT_ID, 24],
      [THIRD_ID, 24],
    ])
  })

  it('removes the file of the attachment the repository holds, by its key', async () => {
    const dependencies = attachmentDependencies({
      attachments: {
        purgeable: vi.fn(async () => Result.success([ATTACHMENT_ID])),
        purge: vi.fn<IAttachmentRepository['purge']>(
          async (_id, _hours, removeFile) =>
            Result.map(
              await removeFile(dbAttachment({ id: OTHER_ATTACHMENT_ID })),
              (): AttachmentPurge => ({ type: 'purged' }),
            ),
        ),
      },
    })

    expect(await purge(dependencies)).toMatchObject({
      data: { purgedCount: 1 },
    })
    expect(dependencies.fileStorage.remove).toHaveBeenCalledExactlyOnceWith(
      `attachments/${OTHER_ATTACHMENT_ID}`,
    )
  })

  it('passes on that a file could not be removed, as the repository answers it', async () => {
    const dependencies = attachmentDependencies({
      attachments: {
        purgeable: vi.fn(async () => Result.success([ATTACHMENT_ID])),
        purge: vi.fn<IAttachmentRepository['purge']>(
          async (_id, _hours, removeFile) =>
            Result.map(
              await removeFile(dbAttachment()),
              (): AttachmentPurge => ({ type: 'purged' }),
            ),
        ),
      },
      storage: { remove: vi.fn(async () => storageDown) },
    })

    expect(await purge(dependencies)).toEqual(storageDown)
  })

  it('stops at the first attachment that could not be purged', async () => {
    const dependencies = purging([
      [ATTACHMENT_ID, Result.success({ type: 'purged' })],
      [OTHER_ATTACHMENT_ID, storageDown],
      [THIRD_ID, Result.success({ type: 'purged' })],
    ])

    expect(await purge(dependencies)).toEqual(storageDown)
    expect(dependencies.attachmentRepository.purge).toHaveBeenCalledTimes(2)
  })

  it('answers a count of zero when nothing is over', async () => {
    const dependencies = attachmentDependencies()

    expect(await purge(dependencies)).toStrictEqual({
      type: 'success',
      data: { purgedCount: 0 },
    })
    expect(dependencies.attachmentRepository.purge).not.toHaveBeenCalled()
    expect(dependencies.fileStorage.remove).not.toHaveBeenCalled()
  })

  it('passes on that what is over could not be looked for', async () => {
    const dependencies = attachmentDependencies({
      attachments: { purgeable: vi.fn(async () => databaseDown) },
    })

    expect(await purge(dependencies)).toEqual(databaseDown)
  })

  it.each<[string, Actor]>([
    ['the owner of a salon', actors.ofSalon('owner')],
    ['a manager of a salon', actors.ofSalon('manager')],
    ['a staff member of a salon', actors.ofSalon('staff')],
    ...outsiders,
  ])('refuses %s, and looks for nothing', async (_who, actor) => {
    const dependencies = attachmentDependencies()

    expect(await purge(dependencies, actor)).toEqual(forbidden)
    expect(dependencies.attachmentRepository.purgeable).not.toHaveBeenCalled()
  })
})
