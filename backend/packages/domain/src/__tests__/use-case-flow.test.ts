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

/**
 * Whether a source lets a read mapper make an answer of the API: such a
 * function is named `toApi…`. One that reads a stored value for a rule
 * (`toBusinessHours`) makes no answer.
 */
const letsAReadMapperAnswer = (source: string): boolean =>
  /\b\w+ReadMapper\.toApi\w+/.test(source)

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
  ![source, ...shared].some(letsAReadMapperAnswer)
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
  it.each(DOMAINS)(
    '%s: a checked request goes to a write mapper alone, and an answer comes from a read mapper',
    (domain) => {
      expect(departuresIn(domain)).toEqual([])
    },
  )
})

/** A use case that follows the flow, as the sources write one. */
const FOLLOWING = `
  async execute(
    actor: Actor,
    input: unknown,
  ): Promise<Result<ApiSalonResponse, DomainError>> {
    const request = parseWith(salonCreateRequestSchema, input, 'Invalid salon')
    const { salon } = SalonWriteMapper.fromCreateRequest(request.data)
    return SalonReadMapper.toApiSalon(salon)
  }
`
const ANSWER = 'return SalonReadMapper.toApiSalon(salon)'

describe('what is read as leaving the flow', () => {
  it('finds nothing in a use case that follows the flow', () => {
    expect(departuresOf('create-salon.usecase.ts', FOLLOWING, [])).toEqual([])
  })

  it.each<[string, string, string, string]>([
    [
      'a checked request under another name',
      'const request = parseWith(',
      'const parsed = parseWith(',
      'a request that was checked is not named `request`',
    ],
    [
      'a checked request that is read beside its write mapper',
      ANSWER,
      `log(request.data.name)\n    ${ANSWER}`,
      'a request that was checked goes past its write mapper',
    ],
    [
      'a checked request that is given to something else than a write mapper',
      'SalonWriteMapper.fromCreateRequest(request.data)',
      'planSalon(request.data)',
      'a request that was checked goes past its write mapper',
    ],
    [
      'a page that the use case makes',
      ANSWER,
      'return Result.map(SalonReadMapper.toApiSalons(salons), (data) => ({ data, meta: { prevCursor: null } }))',
      'a page of a list is made outside the mappers',
    ],
    [
      'a number of items that the use case decides',
      'const { salon }',
      'const limit = request.limit ?? DEFAULT_LIMIT\n    const { salon }',
      'a page of a list is made outside the mappers',
    ],
    [
      'an answer that no read mapper makes',
      ANSWER,
      'return Result.success(salon)',
      'an answer of the API is made without a read mapper',
    ],
    [
      'an answer for which a read mapper only reads a stored value',
      ANSWER,
      'return Result.success(SalonReadMapper.toBusinessHours(salon))',
      'an answer of the API is made without a read mapper',
    ],
  ])('finds %s', (_departure, followed, left, message) => {
    expect(
      departuresOf(
        'create-salon.usecase.ts',
        FOLLOWING.replace(followed, left),
        [],
      ),
    ).toEqual([`create-salon.usecase.ts: ${message}`])
  })

  it('reads the shared sources of its domain that a source imports, and no other source', () => {
    expect(
      sharedSourcesOf(
        [
          "import { SalonReadMapper } from '../../mappers/read/salon.mapper'",
          "import { answerWith } from './_shared/answer'",
          "import { planOf } from './_shared/opening-plan'",
          "import { ListSalonsUseCase } from './list-salons.usecase'",
        ].join('\n'),
        [
          ['_shared/answer.ts', 'the source of the answer'],
          ['_shared/authorization.ts', 'the source of the permissions'],
          ['_shared/opening-plan.ts', 'the source of the plan'],
          ['create-salon.usecase.ts', 'the source itself'],
          ['list-salons.usecase.ts', 'the source of another use case'],
        ],
      ),
    ).toEqual(['the source of the answer', 'the source of the plan'])
  })

  it('lets a shared source of the domain make the answer', () => {
    expect(
      departuresOf(
        'create-salon.usecase.ts',
        FOLLOWING.replace(ANSWER, 'return answerWith(salon)'),
        [
          'export const answerWith = (salon) => SalonReadMapper.toApiSalon(salon)',
        ],
      ),
    ).toEqual([])
  })

  it('asks no read mapper of a use case that answers with no model of the API, nor of a source that is no use case', () => {
    expect(
      departuresOf(
        'delete-salon.usecase.ts',
        FOLLOWING.replace('ApiSalonResponse', 'null').replace(
          ANSWER,
          'return Result.success(null)',
        ),
        [],
      ),
    ).toEqual([])
    expect(
      departuresOf(
        '_shared/plan.ts',
        FOLLOWING.replace(ANSWER, 'return Result.success(salon)'),
        [],
      ),
    ).toEqual([])
  })
})

describe('the two sides of the mappers', () => {
  it('has a read mapper for every write mapper', () => {
    const read = mappersOf('read')

    expect(mappersOf('write').filter((name) => !read.includes(name))).toEqual(
      [],
    )
  })

  it('has a write mapper for every read mapper', () => {
    const write = mappersOf('write')

    expect(mappersOf('read').filter((name) => !write.includes(name))).toEqual(
      [],
    )
  })
})
