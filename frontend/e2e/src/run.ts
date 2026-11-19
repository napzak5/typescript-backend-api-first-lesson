import * as z from 'zod'

const VARIABLE = 'E2E_RUN'

const runSchema = z.object({
  /** Where the test server listens, and the token its requests carry */
  server: z.object({ origin: z.string(), token: z.string() }),
  /** The API that the applications call */
  api: z.object({
    id: z.string(),
    origin: z.string(),
    seedPassword: z.string(),
  }),
})

/** What the start of a run hands to its tests. */
export type Run = z.infer<typeof runSchema>

/**
 * The tests run in processes of their own, which are started after the
 * global setup and inherit its environment: that is how they learn what it
 * started.
 */
export const handOver = (run: Run): void => {
  process.env[VARIABLE] = JSON.stringify(run)
}

export const readRun = (): Run =>
  runSchema.parse(JSON.parse(process.env[VARIABLE] ?? 'null'))
