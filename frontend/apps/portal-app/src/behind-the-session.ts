import type { ModelsProblemDetails } from '@beauty-salon-frontend/api-client'
import { match, P } from 'ts-pattern'
import type { Unread } from './salons/salons-api'

/*
 * What the functions share that call the API for the screens behind the
 * guard of the session: the screens of a customer who is signed in.
 */

/** A value the API does not take: the property, and the rule it broke. */
export type RefusedValue = { field: string; rule: string }

/** Why nothing came of a request to write, besides what the request itself may be refused for. */
export type Unsent =
  | { type: 'tooManyRequests' }
  /** No answer, or one that says nothing a person could act on */
  | { type: 'failed' }

type Problem<Status extends number> = {
  status: Status
  data: ModelsProblemDetails
}

export const FAILED: { type: 'failed' } = { type: 'failed' }

export const TOO_MANY_REQUESTS: { type: 'tooManyRequests' } = {
  type: 'tooManyRequests',
}

/**
 * The answers that say nothing about what was asked for, and no answer at
 * all. 401 and 403 are among them: the screens stand behind the guard of
 * the session, which shows the sign-in screen when the session has ended,
 * and an account of another role never gets to them. A module matches them
 * with a pattern of its own (`UNANSWERED`) and hands them to
 * `unansweredOf`.
 */
type Unanswered =
  | Problem<401>
  | Problem<403>
  | Problem<429>
  | Problem<500>
  | null

export const unansweredOf = (answer: Unanswered): Unread =>
  match(answer)
    .returnType<Unread>()
    .with({ status: 429 }, () => TOO_MANY_REQUESTS)
    .with(
      P.union(null, { status: 401 }, { status: 403 }, { status: 500 }),
      () => FAILED,
    )
    .exhaustive()

/** The values a refusal names, each with the rule it broke. */
export const refusedValuesOf = ({
  errors,
}: Pick<ModelsProblemDetails, 'errors'>): RefusedValue[] =>
  (errors ?? []).map(({ field, rule }) => ({ field, rule }))
