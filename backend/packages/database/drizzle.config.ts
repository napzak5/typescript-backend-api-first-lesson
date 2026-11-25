import type { Config } from 'drizzle-kit'

/**
 * Used by `pnpm db:introspect` only, which passes the connection URL in
 * DATABASE_URL and the folder drizzle-kit writes to in
 * INTROSPECTION_DIRECTORY. The file imports no workspace package, so the
 * tools that load it (drizzle-kit, knip) need no build.
 */
export default {
  schema: './src/schema.ts',
  out: process.env.INTROSPECTION_DIRECTORY ?? './migrations',
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
