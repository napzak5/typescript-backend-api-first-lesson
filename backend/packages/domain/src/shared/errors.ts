/** One rule that an input value broke. */
export type ValidationIssue = {
  /** Path of the offending value in dot notation; empty for the input as a whole. */
  field: string
  /** Identifier of the rule that was broken, e.g. `too_big`. */
  rule: string
  message: string
}

/**
 * Every way a use case can fail. `database` covers both a failed query and
 * stored data that does not have the shape the schema promises; its `cause`
 * is for logs and is never sent to a client.
 */
export type DomainError =
  | { type: 'validation'; message: string; issues: ValidationIssue[] }
  | { type: 'notFound'; entity: string; id: string }
  | { type: 'alreadyExists'; entity: string; field: string; value: string }
  | { type: 'database'; message: string; cause: unknown }

export const DomainErrors = {
  validation(message: string, issues: ValidationIssue[]): DomainError {
    return { type: 'validation', message, issues }
  },

  notFound(entity: string, id: string): DomainError {
    return { type: 'notFound', entity, id }
  },

  alreadyExists(entity: string, field: string, value: string): DomainError {
    return { type: 'alreadyExists', entity, field, value }
  },

  database(message: string, cause: unknown): DomainError {
    return { type: 'database', message, cause }
  },
}
