import { Result } from '@beauty-salon-backend/utility'
import { authMessages } from '@beauty-salon-shared/i18n/messages/api'
import { SessionReadMapper } from '../../mappers/read/session.mapper'
import { SessionWriteMapper } from '../../mappers/write/session.mapper'
import type { Actor, ApiSessionResponse } from '../../models/auth'
import type { ApiPage } from '../../models/page'
import { sessionSearchRequestSchema } from '../../schemas/auth.schema'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import type { AuthUseCaseDependencies } from './_shared/dependencies'

const MESSAGE = authMessages.invalidSessionSearch

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
  ): Promise<Result<ApiPage<ApiSessionResponse>, DomainError>> {
    const request = parseWith(sessionSearchRequestSchema, input, MESSAGE)
    if (request.type === 'error') {
      return request
    }

    const { sessionRepository, clock } = this.dependencies
    const criteria = SessionWriteMapper.fromSearchRequest(
      request.data,
      actor.userId,
      clock().toISOString(),
    )
    const listed = await sessionRepository.listOfUser(criteria)
    if (listed.type === 'error') {
      return listed
    }
    if (listed.data === null) {
      return Result.error(
        DomainErrors.validation(MESSAGE, [
          {
            field: 'cursor',
            rule: 'not_found',
            message: authMessages.sessionOfCursorGone,
          },
        ]),
      )
    }

    return SessionReadMapper.toApiSessionPage(
      listed.data,
      criteria,
      actor.sessionId,
    )
  }
}
