import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type {
  ApiSessionResponse,
  DbSession,
  SessionId,
} from '../../models/auth'
import { type DomainError, DomainErrors, parseWith } from '../../shared'
import { timestampSchema } from './columns'

/**
 * A row of `sessions` → API response. The columns that go out are named one
 * by one, so that the hashes of the tokens never reach a response.
 */

const convertedColumnsSchema = z.object({
  expiresAt: timestampSchema,
  refreshExpiresAt: timestampSchema,
  lastActivityAt: timestampSchema,
  createdAt: timestampSchema,
})

/** `current`: whether the session is the one of the request that asks. */
const toApiSession = (
  session: DbSession,
  current: boolean,
): Result<ApiSessionResponse, DomainError> => {
  const { id, userId, ipAddress, userAgent } = session

  return Result.mapError(
    Result.map(
      parseWith(convertedColumnsSchema, session, 'Invalid stored session'),
      (converted) => ({
        id,
        userId,
        ipAddress,
        userAgent,
        ...converted,
        current,
      }),
    ),
    // The request was fine; the stored row is not.
    (error) =>
      DomainErrors.database(
        `Stored session ${session.id} does not match the API model`,
        error,
      ),
  )
}

export const SessionReadMapper = {
  /** The sessions as their owner sees them; `currentSessionId` is the one that asks. */
  toApiSessions(
    sessions: DbSession[],
    currentSessionId: SessionId,
  ): Result<ApiSessionResponse[], DomainError> {
    const apiSessions: ApiSessionResponse[] = []
    for (const session of sessions) {
      const mapped = toApiSession(session, session.id === currentSessionId)
      if (mapped.type === 'error') {
        return mapped
      }
      apiSessions.push(mapped.data)
    }
    return Result.success(apiSessions)
  },
}
