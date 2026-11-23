// This module reads files, and the test of a package gives it the folder
// of its sources (`import.meta.dirname`): the types of Node.js come with it,
// also into a package that is checked without them
/// <reference types="node" />
import fs from 'node:fs'
import path from 'node:path'
import { expect, it } from 'vitest'

/**
 * The check that a package writes the texts of its screens as messages.
 *
 * A text a screen says is a message of the language package, written in
 * every language (`text({ en, ja })`), and the component that shows it says
 * it in the language of the page. A text written in the source in Japanese
 * is said in Japanese whatever the language of the page is, and nothing
 * else notices: this check turns it into a failure.
 */

/** A letter of Japanese (a kana, a kanji), or a sign of its writing (「」, 、, （）) */
const JAPANESE = /[\u3000-\u30ff\u4e00-\u9fff\uff00-\uffef]/

export type SourceFile = {
  /** The path of the file, below the directory that was read */
  path: string
  content: string
}

/** Where a character of a source is: in the code, in a comment, or in a text between quotes */
type Place = 'code' | 'line comment' | 'block comment' | "'" | '"' | '`'

type Step = {
  /** Where the next character is */
  place: Place
  /** What is kept of the characters that were read: a comment is kept as spaces, so the lines keep their numbers */
  kept: string
  /** How many characters were read */
  read: number
}

const QUOTES: readonly Place[] = ["'", '"', '`']

const inCode = (content: string, at: number): Step => {
  const two = content.slice(at, at + 2)
  if (two === '//') {
    return { place: 'line comment', kept: '  ', read: 2 }
  }
  if (two === '/*') {
    return { place: 'block comment', kept: '  ', read: 2 }
  }
  const character = content.charAt(at)

  return {
    place: QUOTES.find((quote) => quote === character) ?? 'code',
    kept: character,
    read: 1,
  }
}

const inComment = (place: Place, content: string, at: number): Step => {
  const character = content.charAt(at)
  if (place === 'line comment') {
    return character === '\n'
      ? { place: 'code', kept: character, read: 1 }
      : { place, kept: ' ', read: 1 }
  }
  if (content.slice(at, at + 2) === '*/') {
    return { place: 'code', kept: '  ', read: 2 }
  }

  return { place, kept: character === '\n' ? character : ' ', read: 1 }
}

const inQuotes = (place: Place, content: string, at: number): Step => {
  const character = content.charAt(at)
  if (character === '\\') {
    return { place, kept: content.slice(at, at + 2), read: 2 }
  }
  // A text between single or double quotes ends with its line: an apostrophe
  // in the text of an element (`Don't`) is taken for a quote no further
  const ends = character === place || (character === '\n' && place !== '`')

  return { place: ends ? 'code' : place, kept: character, read: 1 }
}

const stepAt = (place: Place, content: string, at: number): Step => {
  if (place === 'code') {
    return inCode(content, at)
  }

  return place === 'line comment' || place === 'block comment'
    ? inComment(place, content, at)
    : inQuotes(place, content, at)
}

/**
 * A source without its comments, line for line. A comment may be written
 * in Japanese: it says what a screen says (「予約を確定しました。」), and no
 * screen says the comment. What looks like the start of a comment inside a
 * text between quotes (`'image/*'`, `'https://…'`) is part of the text.
 */
const withoutComments = (content: string): string => {
  let place: Place = 'code'
  let kept = ''
  let at = 0
  while (at < content.length) {
    const step = stepAt(place, content, at)
    place = step.place
    kept += step.kept
    at += step.read
  }

  return kept
}

/**
 * The lines of the sources that write Japanese outside a comment, each as
 * `path:line: what the line says`.
 */
export const linesWrittenInJapanese = (
  sources: readonly SourceFile[],
): string[] =>
  sources.flatMap((source) =>
    withoutComments(source.content)
      .split('\n')
      .flatMap((line, index) =>
        JAPANESE.test(line)
          ? [`${source.path}:${index + 1}: ${line.trim()}`]
          : [],
      ),
  )

/** What is no source of a package: what it depends on, what it built, what is generated from the contract, and what the stories share */
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'generated',
  '__stories__',
])

/** A module that a screen is made of: no test, no story, and no file of examples for the stories */
const isSource = (name: string): boolean =>
  /\.tsx?$/.test(name) &&
  !/\.(test|stories)\.tsx?$/.test(name) &&
  !/^examples\.tsx?$/.test(name)

const filesBelow = (directory: string, relative = ''): string[] =>
  fs
    .readdirSync(path.join(directory, relative), { withFileTypes: true })
    .flatMap((entry) => {
      const below = path.join(relative, entry.name)
      if (entry.isDirectory()) {
        return SKIPPED_DIRECTORIES.has(entry.name)
          ? []
          : filesBelow(directory, below)
      }

      return isSource(entry.name) ? [below] : []
    })

/**
 * The modules below `directory` that a screen is made of, with paths
 * relative to it: the TypeScript files but the tests, the stories and the
 * examples of the stories, which are written in the language their
 * subject is shown in.
 */
export const sourcesBelow = (directory: string): SourceFile[] =>
  filesBelow(directory)
    .sort()
    .map((relative) => ({
      path: relative,
      content: fs.readFileSync(path.join(directory, relative), 'utf8'),
    }))

/**
 * Declares the test that the sources below `directory` write no text in
 * Japanese: every text they show is a message, written in every language.
 * A package has this test from when its texts are messages:
 *
 * ```ts
 * describe('the texts of the package', () => {
 *   itShouldWriteItsTextsAsMessages(import.meta.dirname)
 * })
 * ```
 */
export const itShouldWriteItsTextsAsMessages = (directory: string): void => {
  it('should write no text in Japanese in its sources: a text is a message, written in every language', () => {
    // Act
    const lines = linesWrittenInJapanese(sourcesBelow(directory))

    // Assert
    expect(lines).toEqual([])
  })
}
