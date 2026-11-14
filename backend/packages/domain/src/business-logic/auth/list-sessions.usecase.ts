import { Result } from '@beauty-salon-backend/utility'
import { SessionReadMapper } from '../../mappers/read/session.mapper'
import type { Actor, ApiSessionResponse } from '../../models/auth'
import type { ApiPaginationMeta } from '../../models/salon'
import { sessionSearchRequestSchema } from '../../schemas/auth.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import type { AuthUseCaseDependencies } from './_shared/dependencies'

const DEFAULT_LIMIT = 20
const MESSAGE = 'Invalid session search'

export type SessionPage = {
  data: ApiSessionResponse[]
  meta: ApiPaginationMeta
}

export class ListSessionsUseCase {
  constructor(private readonly dependencies: AuthUseCaseDependencies) {}

  /**
   * Lists the sessions of the actor that have not ended, newest first, so
   * that a user sees where the account is signed in. The session of the
   * request is marked.
   *
   * The cursor of a page is the ID of its last session. A session that was
   * ended since is gone, and a cursor that names it is refused: the list
   * has to be read from the start again, because nothing says where the
   * page would begin.
   */
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<SessionPage, DomainError>> {
    const request = parseWith(sessionSearchRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }
    const { cursor } = request.data
    const limit = request.data.limit ?? DEFAULT_LIMIT

    const { sessionRepository, clock } = this.dependencies
    const listed = await sessionRepository.listOfUser({
      userId: actor.userId,
      now: clock().toISOString(),
      limit,
      after: cursor ?? null,
    })
    if (listed.type === 'error') {
      return listed
    }
    if (listed.data === null) {
      return Result.error(
        DomainErrors.validation(MESSAGE, [
          {
            field: 'cursor',
            rule: 'not_found',
            message: 'The session this cursor names is not there any more',
          },
        ]),
      )
    }

    const { sessions, total, hasMore } = listed.data
    const lastSessionId = sessions.at(-1)?.id ?? null

    return Result.map(
      SessionReadMapper.toApiSessions(sessions, actor.sessionId),
      (data) => ({
        data,
        meta: {
          total,
          limit,
          hasMore,
          cursor: cursor ?? null,
          nextCursor: hasMore ? lastSessionId : null,
          // Pages are only walked forwards.
          prevCursor: null,
        },
      }),
    )
  }
}
