import { Result } from '@beauty-salon-backend/utility'

/**
 * `drizzle-kit introspect` emits declarations in catalog order, which depends
 * on how the database was built, and lists the columns of unique constraints
 * alphabetically instead of in their real order. The functions below rewrite
 * the formatted output into a canonical form, so that introspecting an
 * unchanged schema leaves `schema.ts` and `relations.ts` untouched.
 *
 * Both functions expect their input to be formatted by Biome already.
 */

/** Column names of each unique constraint, keyed by `<table>.<constraint>`. */
export type UniqueConstraintColumns = ReadonlyMap<string, readonly string[]>

type Section = {
  before: readonly string[]
  items: readonly (readonly string[])[]
  after: readonly string[]
}

const compareText = (left: string, right: string): number =>
  Number(left > right) - Number(left < right)

const indentOf = (line: string): number => line.length - line.trimStart().length

const splitBlocks = (
  source: string,
): { header: string; blocks: readonly string[] } => {
  const start = source.search(/^export const /m)
  if (start === -1) {
    return { header: source, blocks: [] }
  }
  return {
    header: source.slice(0, start),
    blocks: source
      .slice(start)
      .split(/\n(?=export const )/)
      .map((block) => block.trimEnd()),
  }
}

const joinBlocks = (header: string, blocks: readonly string[]): string =>
  `${header}${blocks.join('\n\n')}\n`

const blockName = (block: string): string =>
  /^export const (\w+)/.exec(block)?.[1] ?? ''

/**
 * Splits the list that follows the first line accepted by `isOpening` into its
 * items. An item starts on a line at the list's indentation and runs until the
 * next such line; the list ends at the first line indented less than its items.
 */
const splitSection = (
  lines: readonly string[],
  isOpening: (line: string) => boolean,
): Section | undefined => {
  const open = lines.findIndex(isOpening)
  const first = lines[open + 1]
  if (open === -1 || first === undefined) {
    return undefined
  }
  const itemIndent = indentOf(first)
  const length = lines
    .slice(open + 1)
    .findIndex((line) => indentOf(line) < itemIndent)
  if (length === -1) {
    return undefined
  }
  const close = open + 1 + length
  const items: string[][] = []
  for (const line of lines.slice(open + 1, close)) {
    const current = items.at(-1)
    const startsItem =
      indentOf(line) === itemIndent && !/^[)\]}]/.test(line.trimStart())
    if (startsItem || current === undefined) {
      items.push([line])
    } else {
      current.push(line)
    }
  }
  return {
    before: lines.slice(0, open + 1),
    items,
    after: lines.slice(close),
  }
}

const sortSection = (
  block: string,
  isOpening: (line: string) => boolean,
  keyOf: (item: readonly string[]) => Result<string, string>,
): Result<string, string> => {
  const section = splitSection(block.split('\n'), isOpening)
  if (section === undefined) {
    return Result.success(block)
  }
  const keyed: { key: string; item: readonly string[] }[] = []
  for (const item of section.items) {
    const key = keyOf(item)
    if (key.type === 'error') {
      return key
    }
    keyed.push({ key: key.data, item })
  }
  const sorted = keyed
    .toSorted((left, right) => compareText(left.key, right.key))
    .flatMap(({ item }) => item)
  return Result.success(
    [...section.before, ...sorted, ...section.after].join('\n'),
  )
}

const constraintKey = (item: readonly string[]): Result<string, string> => {
  const text = item.join('\n')
  const kind = /^\s*(\w+)\(/.exec(text)?.[1]
  const name = (/^\s*\w+\(\s*'([^']+)'/.exec(text) ??
    /\bname: '([^']+)'/.exec(text))?.[1]
  if (kind === undefined || name === undefined) {
    return Result.error(`Cannot identify the constraint declared by:\n${text}`)
  }
  return Result.success(`${kind}:${name}`)
}

const relationKey = (item: readonly string[]): Result<string, string> => {
  const name = /^\s*(\w+):/.exec(item[0] ?? '')?.[1]
  if (name === undefined) {
    return Result.error(
      `Cannot identify the relation declared by:\n${item.join('\n')}`,
    )
  }
  return Result.success(name)
}

/** Maps each database column of a table block to its property name. */
const columnProperties = (block: string): ReadonlyMap<string, string> => {
  const columns = block
    .split('\n')
    .map((line) => ({
      indent: indentOf(line),
      match: /^\s*(\w+): \w+\((?:'([^']+)')?/.exec(line),
    }))
    .flatMap(({ indent, match }) => {
      const property = match?.[1]
      return property === undefined
        ? []
        : [{ indent, property, column: match?.[2] ?? property }]
    })
  const columnIndent = columns[0]?.indent
  return new Map(
    columns
      .filter(({ indent }) => indent === columnIndent)
      .map(({ column, property }) => [column, property]),
  )
}

/** Restores the real column order of every unique constraint in a table. */
const restoreUniqueColumnOrder = (
  block: string,
  uniqueColumns: UniqueConstraintColumns,
): Result<string, string> => {
  const table = /pgTable\(\s*'([^']+)'/.exec(block)?.[1]
  if (table === undefined) {
    return Result.success(block)
  }
  const properties = columnProperties(block)
  const errors: string[] = []
  const restored = block.replace(
    /unique\('([^']+)'\)\.on\(([^)]*)\)/g,
    (declaration, constraint: string, emitted: string) => {
      const expected = uniqueColumns
        .get(`${table}.${constraint}`)
        ?.map((column) => properties.get(column))
        .flatMap((property) =>
          property === undefined ? [] : [`table.${property}`],
        )
      const actual = emitted
        .split(',')
        .map((argument) => argument.trim())
        .filter((argument) => argument !== '')
      const sameColumns =
        expected !== undefined &&
        expected.length === actual.length &&
        expected.toSorted().join() === actual.toSorted().join()
      if (expected === undefined || !sameColumns) {
        errors.push(
          `Unique constraint "${constraint}" on "${table}" does not match the database: introspected (${actual.join(', ')}), database (${(expected ?? []).join(', ')})`,
        )
        return declaration
      }
      return `unique('${constraint}').on(${expected.join(', ')})`
    },
  )
  return errors.length > 0
    ? Result.error(errors.join('\n'))
    : Result.success(restored)
}

const isEnumBlock = (block: string): boolean =>
  /^export const \w+ = pgEnum\(/.test(block)

/**
 * Canonical form of `schema.ts`: enums first, then tables, each group sorted by
 * name; the constraints of a table sorted by kind and name; unique constraints
 * listing their columns in database order.
 */
export const canonicalizeSchema = (
  source: string,
  uniqueColumns: UniqueConstraintColumns,
): Result<string, string> => {
  const { header, blocks } = splitBlocks(source)
  if (blocks.length === 0) {
    return Result.success(source)
  }
  const canonical: string[] = []
  const ordered = blocks.toSorted(
    (left, right) =>
      Number(isEnumBlock(right)) - Number(isEnumBlock(left)) ||
      compareText(blockName(left), blockName(right)),
  )
  for (const block of ordered) {
    const sorted = Result.flatMap(
      sortSection(block, (line) => line === '  (table) => [', constraintKey),
      (text) => restoreUniqueColumnOrder(text, uniqueColumns),
    )
    if (sorted.type === 'error') {
      return sorted
    }
    canonical.push(sorted.data)
  }
  return Result.success(joinBlocks(header, canonical))
}

/**
 * Canonical form of `relations.ts`: relation blocks sorted by name, and the
 * relations inside each block sorted by property name.
 */
export const canonicalizeRelations = (
  source: string,
): Result<string, string> => {
  const { header, blocks } = splitBlocks(source)
  if (blocks.length === 0) {
    return Result.success(source)
  }
  const canonical: string[] = []
  const ordered = blocks.toSorted((left, right) =>
    compareText(blockName(left), blockName(right)),
  )
  for (const block of ordered) {
    const sorted = sortSection(
      block,
      (line) => /=> \(\{$/.test(line),
      relationKey,
    )
    if (sorted.type === 'error') {
      return sorted
    }
    canonical.push(sorted.data)
  }
  return Result.success(joinBlocks(header, canonical))
}
