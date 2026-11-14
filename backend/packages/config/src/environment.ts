import { z } from 'zod'

/** Where the system runs. Each one has an `.env.<environment>` file. */
export const environmentSchema = z.enum([
  'production',
  'staging',
  'development',
  'test',
  'localhost',
])

export type Environment = z.infer<typeof environmentSchema>
