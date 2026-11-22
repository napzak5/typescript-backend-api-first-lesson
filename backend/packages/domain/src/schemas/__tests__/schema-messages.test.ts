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

/** How often a source names a message that is no such string. */
const messagesInOneLanguageOf = (source: string): number =>
  count(source, NAMED) - count(source, AS_ONE_STRING)

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
      'a message that begins with a small letter',
      "message: 'at most 3 entries'",
      ['at most 3 entries'],
    ],
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

describe('the messages a source names in one language', () => {
  it.each<[string, string, number]>([
    [
      'none where every message is one string of every language',
      'message: asOneString(ruleMessages.notBlank),\nmessage:\n  asOneString(written),',
      0,
    ],
    [
      'none where a message is read to make that string',
      'message: asOneString(issue.message),',
      0,
    ],
    ['none in a comment', '// the message of a rule\n/* message */', 0],
    ['a message that is a value of its own', 'message: written,', 1],
    ['a message named in short', '{ code, message, input }', 1],
    ['a message kept in a constant', 'const message = written', 1],
  ])('should count %s', (_case, source, expected) => {
    // Act
    const counted = messagesInOneLanguageOf(source)

    // Assert
    expect(counted).toBe(expected)
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
      const inOneLanguage = messagesInOneLanguageOf(source)

      // Assert
      expect(inOneLanguage).toBe(0)
    },
  )
})
