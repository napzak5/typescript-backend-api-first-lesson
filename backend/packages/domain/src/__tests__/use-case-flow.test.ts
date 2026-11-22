import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * The flow of a use case, read from the sources: authorize, validate, write
 * mapper, repository, read mapper. A request that was checked goes to the
 * write mapper of its domain and nowhere else, and what the API answers
 * with comes from a read mapper, a page of a list too: one the use case
 * calls, or a shared source of its domain that it imports. The mappers
 * stand side by side: a file of one side has a file of the same name on
 * the other.
 */

const SOURCES = join(import.meta.dirname, '..')
const LOGIC = join(SOURCES, 'business-logic')

/**
 * The domains whose use cases do not follow the flow yet. A domain is taken
 * off this list by the change that makes it follow: one that follows and is
 * still listed fails below.
 */
const NOT_YET = [
  'auth',
  'available-slot',
  'booking',
  'customer-booking',
  'inventory',
  'inventory-alert',
  'payment',
  'point',
  'product',
  'purchase-order',
  'review',
  'review-report',
  'sale',
  'sales-report',
]

/** The read mappers that have no write mapper of their name yet. */
const WITHOUT_WRITE_MAPPER = [
  'available-slot',
  'booking',
  'customer-booking',
  'inventory-alert',
  'inventory-report',
  'payment',
  'point',
  'review',
  'review-report',
  'sale',
  'session',
  'user',
]

/** The folders of `business-logic` that hold the use cases of a domain. */
const DOMAINS = readdirSync(LOGIC, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .map((entry) => entry.name)
  .toSorted()

/** The sources of a domain, its shared ones among them: their paths below the domain, and their text. */
const sourcesOf = (domain: string): [string, string][] =>
  readdirSync(join(LOGIC, domain), { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.ts'))
    .toSorted()
    .map((file) => [file, readFileSync(join(LOGIC, domain, file), 'utf8')])

const count = (text: string, pattern: RegExp): number =>
  [...text.matchAll(pattern)].length

/** What `execute` of a use case answers with, as its source writes the type. */
const answerOf = (source: string): string =>
  /async execute\([\s\S]*?\):\s*Promise<\s*Result<([\s\S]*?),\s*DomainError\s*>\s*>\s*\{/.exec(
    source,
  )?.[1] ?? ''

const callsAReadMapper = (source: string): boolean =>
  /\b\w+ReadMapper\.to\w+/.test(source)

/**
 * The shared sources of its domain (`./_shared/…`) that a source imports:
 * a use case may leave its answer to one of them.
 */
const sharedSourcesOf = (
  source: string,
  sources: [string, string][],
): string[] =>
  [...source.matchAll(/from '\.\/_shared\/([\w-]+)'/g)].flatMap(([, name]) =>
    sources.flatMap(([file, shared]) =>
      file === `_shared/${name}.ts` ? [shared] : [],
    ),
  )

/** Where a source leaves the flow; nothing when it follows it. */
const departuresOf = (
  file: string,
  source: string,
  shared: string[],
): string[] => [
  ...(count(source, /parseWith\(\s*\w+RequestSchema\b/g) >
  count(source, /const request = parseWith\(\s*\w+RequestSchema\b/g)
    ? [`${file}: a request that was checked is not named \`request\``]
    : []),
  ...(count(source, /\brequest\.data\b/g) >
  count(source, /\b\w+WriteMapper\.from\w*Request\(\s*request\.data\b/g)
    ? [`${file}: a request that was checked goes past its write mapper`]
    : []),
  ...(/\bprevCursor\b|\bDEFAULT_LIMIT\b/.test(source)
    ? [`${file}: a page of a list is made outside the mappers`]
    : []),
  ...(file.endsWith('.usecase.ts') &&
  /\bApi[A-Z]/.test(answerOf(source)) &&
  ![source, ...shared].some(callsAReadMapper)
    ? [`${file}: an answer of the API is made without a read mapper`]
    : []),
]

const departuresIn = (domain: string): string[] => {
  const sources = sourcesOf(domain)

  return sources.flatMap(([file, source]) =>
    departuresOf(file, source, sharedSourcesOf(source, sources)),
  )
}

/** The names of the mappers of one side: `salon` for `salon.mapper.ts`. */
const mappersOf = (side: 'read' | 'write'): string[] =>
  readdirSync(join(SOURCES, 'mappers', side))
    .filter((file) => file.endsWith('.mapper.ts'))
    .map((file) => file.slice(0, -'.mapper.ts'.length))
    .toSorted()

describe('the flow of a use case', () => {
  it.each(DOMAINS.filter((domain) => !NOT_YET.includes(domain)))(
    '%s: a checked request goes to a write mapper alone, and an answer comes from a read mapper',
    (domain) => {
      expect(departuresIn(domain)).toEqual([])
    },
  )

  it.each(NOT_YET)(
    '%s is listed because it does not follow the flow yet',
    (domain) => {
      expect(departuresIn(domain)).not.toEqual([])
    },
  )

  it('lists no domain that is not there', () => {
    expect(NOT_YET.filter((domain) => !DOMAINS.includes(domain))).toEqual([])
  })
})

describe('the two sides of the mappers', () => {
  it('has a read mapper for every write mapper', () => {
    const read = mappersOf('read')

    expect(mappersOf('write').filter((name) => !read.includes(name))).toEqual(
      [],
    )
  })

  it('has a write mapper for every read mapper, but for those that are listed', () => {
    const write = mappersOf('write')

    expect(mappersOf('read').filter((name) => !write.includes(name))).toEqual(
      WITHOUT_WRITE_MAPPER,
    )
  })
})
