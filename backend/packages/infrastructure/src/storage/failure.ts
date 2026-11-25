import { match, P } from 'ts-pattern'

/**
 * What a failed call leaves for the log: the verdict of the storage, never
 * a URL, which would carry a signature.
 */
export const describeStorageFailure = (error: unknown) => ({
  name: match(error)
    .with({ name: P.string }, ({ name }) => name)
    .otherwise(() => null),
  message: match(error)
    .with({ message: P.string }, ({ message }) => message)
    .otherwise(() => 'The storage failed'),
  status: match(error)
    .with(
      { $metadata: { httpStatusCode: P.number } },
      ({ $metadata }) => $metadata.httpStatusCode,
    )
    .otherwise(() => null),
})
