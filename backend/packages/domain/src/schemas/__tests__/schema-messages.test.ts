import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/*
 * What a schema says of a value that breaks a rule is a message of the
 * language package, so that a request is told in the language it asks for.
 * Zod takes any string for a message, so the compiler cannot tell a
 * sentence in English alone from a message in every language: this test
 * reads the sources of the schemas instead.
 */

const SCHEMAS = join(import.meta.dirname, '..')

/** A source without its comments: a comment may say what it likes. */
const withoutComments = (source: string): string =>
  source.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/(^|\s)\/\/.*$/gm, '')

/** The texts a source writes, in quotes of any kind. */
const literalsOf = (source: string): string[] =>
  [
    ...withoutComments(source).matchAll(
      /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g,
    ),
  ].map(([, single, double, template]) => single ?? double ?? template ?? '')

/**
 * The texts of a source that are sentences: more than one word, or one that
 * begins as a sentence does. A name of a property, a value of an enum and a
 * path of an import are neither.
 */
const sentencesOf = (source: string): string[] =>
  literalsOf(source).filter(
    (literal) => /\S\s+\S/.test(literal) || /^[A-Z][a-z]/.test(literal),
  )

const count = (source: string, pattern: RegExp): number =>
  [...withoutComments(source).matchAll(pattern)].length

/**
 * Where a source names a message; one that it reads (`issue.message`) is
 * none it names.
 */
const NAMED = /(?<!\.)\bmessage\b/g

/** Where a source gives Zod a message as one string of every language. */
const AS_ONE_STRING = /(?<!\.)\bmessage:\s*asOneString\(/g

/** The sources of the schemas, by the names of their files. */
const SOURCES: [string, string][] = readdirSync(SCHEMAS)
  .filter((file) => file.endsWith('.ts'))
  .toSorted()
  .map((file) => [file, readFileSync(join(SCHEMAS, file), 'utf8')])

describe('the sentences of a source', () => {
  it.each<[string, string, string[]]>([
    [
      'a message in single quotes',
      ".regex(/^\\d+$/, 'Must be a whole number')",
      ['Must be a whole number'],
    ],
    [
      'a message in double quotes',
      'message: "Must not be the customer\'s own"',
      ["Must not be the customer's own"],
    ],
    [
      'a message made from a value',
      'message: `Must be within $' + '{HOURS} hours`',
      ['Must be within $' + '{HOURS} hours'],
    ],
    ['a message of one word', "message: 'Required'", ['Required']],
    [
      'no name of a property, value of an enum or path of an import',
      "import { z } from 'zod'\npath: ['endDate'], code: 'custom', form: 'NFC'",
      [],
    ],
    [
      'no sentence of a comment',
      "// A day off has no hours\n/** The customer's 'own' text. */\nconst a = 1 // Not 'a sentence'",
      [],
    ],
  ])('should find %s', (_case, source, sentences) => {
    // Act
    const found = sentencesOf(source)

    // Assert
    expect(found).toEqual(sentences)
  })
})

describe('the messages of the schemas', () => {
  it('should read the source of every schema', () => {
    // Assert
    expect(SOURCES.map(([file]) => file)).toEqual(
      expect.arrayContaining(['rules.ts', 'salon.schema.ts']),
    )
  })

  it.each<[string, string]>(SOURCES)(
    'should write no sentence of its own in %s',
    (_file, source) => {
      // Act
      const sentences = sentencesOf(source)

      // Assert
      expect(sentences).toEqual([])
    },
  )

  it.each<[string, string]>(SOURCES)(
    'should name a message only to give Zod one string of every language in %s',
    (_file, source) => {
      // Act
      const named = count(source, NAMED)
      const inEveryLanguage = count(source, AS_ONE_STRING)

      // Assert
      expect(inEveryLanguage).toBe(named)
    },
  )
})
