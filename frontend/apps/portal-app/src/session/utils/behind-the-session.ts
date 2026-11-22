import {
  FAILED,
  type Problem,
  TOO_MANY_REQUESTS,
  type Unread,
} from '@beauty-salon-frontend/answers'
import { match, P } from 'ts-pattern'

/*
 * What the functions share that call the API for the screens behind the
 * guard of the session: the screens of a customer who is signed in.
 */

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
