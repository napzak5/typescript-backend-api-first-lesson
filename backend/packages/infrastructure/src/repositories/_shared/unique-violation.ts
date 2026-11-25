/**
 * The error of a write that a unique index refused, as a pattern of
 * ts-pattern: `constraint` is the name of the index, or a pattern of names.
 * drizzle wraps the error of a statement in its own and keeps the error of
 * the driver, which names the index, as its `cause`. No unique constraint
 * of the schema waits for the commit, so a refusal is always the error of
 * a statement.
 */
export const uniqueViolation = <Constraint>(constraint: Constraint) => ({
  cause: { code: '23505', constraint_name: constraint },
})
