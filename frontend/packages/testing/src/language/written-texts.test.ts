import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  itShouldWriteItsTextsAsMessages,
  linesWrittenInJapanese,
  partsWithoutSources,
  sourcesBelow,
  sourcesIn,
} from './written-texts'

const linesOf = (content: string): string[] =>
  linesWrittenInJapanese([{ path: 'screen.tsx', content }])

/** The packages of the frontend, from the folder of this test */
const packages = path.join(import.meta.dirname, '../../..')

describe('linesWrittenInJapanese', () => {
  it.each<[string, string]>([
    ['a text between single quotes', "const label = '予約する'"],
    ['a text between double quotes', 'const label = "予約する"'],
    ['a text between backticks', 'const label = `12 件`'],
    ['the text of an element', '<Button>閉じる</Button>'],
    ['a text in katakana', "const label = 'メニュー'"],
    ['a text in hiragana', "const label = 'さらに'"],
    ['a sign of Japanese writing alone', "const counted = '（' + count"],
    ['a full stop of Japanese writing alone', "const end = '。'"],
  ])('should find %s', (_, line) => {
    // Act
    const lines = linesOf(line)

    // Assert
    expect(lines).toEqual([`screen.tsx:1: ${line}`])
  })

  it.each<[string, string]>([
    ['a text in English', "const label = 'Book'"],
    ['a comment of a line', '// 「予約する」と言うボタン'],
    ['a comment after code', 'const label = say(book) // 「予約する」'],
    ['a comment of a block', '/* 「予約する」と言うボタン */'],
    [
      'a comment of several lines',
      '/**\n * What happened: 「予約を確定しました。」\n */',
    ],
    ['a comment in the markup', '<p>{/* 「予約する」 */}</p>'],
  ])('should find nothing in %s', (_, content) => {
    // Act
    const lines = linesOf(content)

    // Assert
    expect(lines).toEqual([])
  })

  it('should say where each line is, by its number in the file, also below a comment of several lines', () => {
    // Arrange
    const content = [
      '/**',
      ' * 「閉じる」と言うボタン',
      ' */',
      'export const CLOSE = "閉じる"',
      '',
      "  const back = '戻る' // 戻るボタン",
    ].join('\n')

    // Act
    const lines = linesOf(content)

    // Assert
    expect(lines).toEqual([
      'screen.tsx:4: export const CLOSE = "閉じる"',
      "screen.tsx:6: const back = '戻る'",
    ])
  })

  it.each<[string, string, string[]]>([
    [
      'the start of a block comment inside a text',
      "const accept = 'image/*'\nconst label = '写真'\n/* the end */",
      ["screen.tsx:2: const label = '写真'"],
    ],
    [
      'the start of a line comment inside a text',
      "const link = 'https://example.com/予約'",
      ["screen.tsx:1: const link = 'https://example.com/予約'"],
    ],
    [
      'the start of a comment inside a text between backticks',
      'const link = `https://example.com/予約`',
      ['screen.tsx:1: const link = `https://example.com/予約`'],
    ],
    [
      'a quote that is escaped inside a text',
      "const said = 'it\\'s // 予約'",
      ["screen.tsx:1: const said = 'it\\'s // 予約'"],
    ],
    [
      'a backslash at the end of a text',
      "const mark = '\\\\' // 円記号\nconst label = '円'",
      ["screen.tsx:2: const label = '円'"],
    ],
  ])('should not take %s for a comment', (_, content, found) => {
    // Act
    const lines = linesOf(content)

    // Assert
    expect(lines).toEqual(found)
  })

  it('should end a text between quotes with its line, so an apostrophe in the text of an element hides no comment below it', () => {
    // Arrange
    const content = "<p>Don't</p>\n// 「予約する」\nconst label = '予約'"

    // Act
    const lines = linesOf(content)

    // Assert
    expect(lines).toEqual(["screen.tsx:3: const label = '予約'"])
  })

  it('should read a text between backticks over its lines', () => {
    // Arrange
    const content = 'const text = `Book\n// 予約\n`\n// 予約'

    // Act
    const lines = linesOf(content)

    // Assert
    expect(lines).toEqual(['screen.tsx:2: // 予約'])
  })

  it('should name the file of each line, in the order of the sources', () => {
    // Act
    const lines = linesWrittenInJapanese([
      { path: 'b.tsx', content: "const b = '戻る'" },
      { path: 'a.tsx', content: "const a = 'Back'\nconst c = '閉じる'" },
    ])

    // Assert
    expect(lines).toEqual([
      "b.tsx:1: const b = '戻る'",
      "a.tsx:2: const c = '閉じる'",
    ])
  })
})

describe('sourcesBelow', () => {
  it('should read the modules of a package, with paths below the directory, in the order of their paths', () => {
    // Act
    const sources = sourcesBelow(path.join(import.meta.dirname, '..'))
    const paths = sources.map((source) => source.path)

    // Assert
    expect(paths).toEqual(
      expect.arrayContaining([
        'index.ts',
        'language/written-texts.ts',
        'screens/screens.tsx',
      ]),
    )
    expect(paths).toEqual([...paths].sort())
    expect(
      sources.find((source) => source.path === 'language/written-texts.ts')
        ?.content,
    ).toContain('export const sourcesBelow')
  })

  it.each<[string, string, RegExp]>([
    ['the tests', 'ui/src', /\.test\.tsx?$/],
    ['the stories', 'ui/src', /\.stories\.tsx$/],
    ['what the stories share', 'ui/src', /__stories__/],
    ['what the tests share', '../apps/portal-app/src', /__tests__/],
    ['the examples of the stories', 'session/src', /examples\.ts$/],
    ['what is generated from the contract', 'api-client/src', /generated/],
    ['the stylesheets', 'ui/src', /\.css$/],
  ])('should leave out %s', (_, directory, left) => {
    // Act
    const paths = sourcesBelow(path.join(packages, directory)).map(
      (source) => source.path,
    )

    // Assert
    expect(paths.length).toBeGreaterThan(0)
    expect(paths.filter((file) => left.test(file))).toEqual([])
  })

  it('should read a file of the same name as what it leaves out when it is a module', () => {
    // Act
    const paths = sourcesBelow(path.join(packages, 'ui/src')).map(
      (source) => source.path,
    )

    // Assert
    expect(paths).toEqual(
      expect.arrayContaining([
        'components/button/button.tsx',
        'components/form/form-values.ts',
        'hooks/language.ts',
        'index.ts',
      ]),
    )
  })
})

describe('sourcesIn', () => {
  it('should read the modules of the folders and the files it names right below the directory, and no other', () => {
    // Act
    const paths = sourcesIn(path.join(packages, 'ui/src'), [
      'hooks',
      'index.ts',
    ]).map((source) => source.path)

    // Assert
    expect(paths).toEqual(
      expect.arrayContaining(['hooks/language.ts', 'index.ts']),
    )
    expect(
      paths.filter((file) => file !== 'index.ts' && !file.startsWith('hooks/')),
    ).toEqual([])
  })

  it('should read nothing of a part that is not there', () => {
    // Act
    const sources = sourcesIn(path.join(packages, 'ui/src'), ['no-such-area'])

    // Assert
    expect(sources).toEqual([])
  })
})

describe('partsWithoutSources', () => {
  it('should name the parts that have no source, and none of those that have', () => {
    // Act
    const missing = partsWithoutSources(path.join(packages, 'ui/src'), [
      'hooks',
      'no-such-area',
      'index.ts',
      'no-such-file.ts',
    ])

    // Assert
    expect(missing).toEqual(['no-such-area', 'no-such-file.ts'])
  })
})

describe('itShouldWriteItsTextsAsMessages', () => {
  // The check itself writes no text in Japanese: its letters are written by their numbers
  itShouldWriteItsTextsAsMessages(import.meta.dirname)

  describe('of the parts it names', () => {
    // The parts of this package that write no Japanese, among those that do (`api`)
    itShouldWriteItsTextsAsMessages(path.join(import.meta.dirname, '..'), [
      'language',
      'index.ts',
    ])
  })

  it('should have something to find below a directory whose sources write Japanese: the labels the sign-in of a test types into', () => {
    // Act
    const lines = linesWrittenInJapanese(
      sourcesBelow(path.join(import.meta.dirname, '../api')),
    )

    // Assert
    expect(lines.length).toBeGreaterThan(0)
  })
})
