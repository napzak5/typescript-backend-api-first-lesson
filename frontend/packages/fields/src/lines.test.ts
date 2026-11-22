import { describe, expect, it } from 'vitest'
import { linesOf } from './lines'

describe('linesOf', () => {
  it('should read an entry from every line', () => {
    expect(linesOf('アッシュブラウン\nベージュ')).toEqual([
      'アッシュブラウン',
      'ベージュ',
    ])
  })

  it('should leave out the spaces around an entry, and the lines that hold nothing', () => {
    expect(linesOf('  ベージュ \n\n   \nピンク\n')).toEqual([
      'ベージュ',
      'ピンク',
    ])
  })

  it('should read the lines of a text whose lines end as a form sends them', () => {
    expect(linesOf('ベージュ\r\nピンク\r\n')).toEqual(['ベージュ', 'ピンク'])
  })

  it('should keep an entry once that is written twice: the API takes none twice', () => {
    expect(linesOf('ベージュ\nピンク\nベージュ ')).toEqual([
      'ベージュ',
      'ピンク',
    ])
  })

  it('should read nothing from an empty text', () => {
    expect(linesOf('')).toEqual([])
  })
})
