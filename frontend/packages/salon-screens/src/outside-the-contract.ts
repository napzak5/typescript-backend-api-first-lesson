/**
 * What a function that calls the API makes of an answer whose status the
 * contract does not name for the operation: the handler of its
 * `.exhaustive()`.
 *
 * The types say there is no such answer, so the match stays exhaustive and a
 * status that is added to the contract is a type error. A gateway in front
 * of the API answers 502, 503 or 504 all the same when the API does not, and
 * the fetch function resolves with every status. Without a handler the match
 * would throw then: the function would reject, and the screen would go on
 * waiting for an outcome that never comes. Such an answer is nothing to act
 * on, like no answer at all.
 */
export const outsideTheContract = (): { type: 'failed' } => ({
  type: 'failed',
})
