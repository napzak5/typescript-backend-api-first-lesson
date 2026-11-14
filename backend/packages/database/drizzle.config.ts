import type { Config } from 'drizzle-kit'

/**
 * Used by `pnpm db:introspect` only, which passes the connection URL in
 * DATABASE_URL. The file imports no workspace package, so the tools that load
 * it (drizzle-kit, knip) need no build.
 */
export default {
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  verbose: true,
  strict: true,
  introspect: {
    casing: 'camel',
  },
} satisfies Config
