import { Result } from '@beauty-salon-backend/utility'
import { z } from 'zod'
import type { IssuedSessionTokens } from '../../business-logic/auth/_shared/session-policy'
import type {
  ApiAuthLoginResponse,
  ApiSessionResponse,
  DbSession,
  DbUser,
  SessionId,
} from '../../models/auth'
import type { ApiPage, Paging } from '../../models/page'
import type { SessionList } from '../../repositories/session.repository'
import { type DomainError, parseStored } from '../../shared'
import { timestampSchema } from './columns'
import { toApiPage } from './page'
import { UserReadMapper } from './user.mapper'

/**
 * A row of `sessions` → API response. The columns that go out are named one
 * by one, so that the hashes of the tokens never reach a response.
 */

const convertedColumnsSchema = z.object({
  expiresAt: timestampSchema,
  refreshExpiresAt: timestampSchema,
  lastActivityAt: timestampSchema,
  createdAt: timestampSchema,
}) satisfies z.ZodType<
  Pick<
    ApiSessionResponse,
    'expiresAt' | 'refreshExpiresAt' | 'lastActivityAt' | 'createdAt'
  >
>

/** `current`: whether the session is the one of the request that asks. */
const toApiSession = (
  session: DbSession,
  current: boolean,
): Result<ApiSessionResponse, DomainError> => {
  const { id, userId, ipAddress, userAgent } = session

  return Result.map(
    parseStored(
      convertedColumnsSchema,
      session,
      `Stored session ${session.id} does not match the API model`,
    ),
    (converted) => ({
      id,
      userId,
      ipAddress,
      userAgent,
      ...converted,
      current,
    }),
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

  /** The sessions a list found as a page of it; `currentSessionId` is the one that asks. */
  toApiSessionPage(
    { sessions, total, hasMore }: SessionList,
    paging: Paging<SessionId>,
    currentSessionId: SessionId,
  ): Result<ApiPage<ApiSessionResponse>, DomainError> {
    return Result.map(
      SessionReadMapper.toApiSessions(sessions, currentSessionId),
      (data) => toApiPage(data, { total, hasMore }, paging),
    )
  },

  /**
   * What a login and a refresh answer with: the tokens of the session as
   * they were issued, which is the only time they are shown, and the
   * account they are for. What is stored of the tokens is left out.
   */
  toApiLogin(
    { accessToken, refreshToken, expiresIn }: IssuedSessionTokens,
    user: DbUser,
  ): Result<ApiAuthLoginResponse, DomainError> {
    return Result.map(UserReadMapper.toApiUser(user), (apiUser) => ({
      accessToken,
      refreshToken,
      token: 'Bearer',
      expiresIn,
      user: apiUser,
    }))
  },
}
