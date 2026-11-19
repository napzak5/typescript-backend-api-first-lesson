import { describe, expect, it } from 'vitest'
import { linesOf, pictureAddressesError } from './lines'

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

describe('pictureAddressesError', () => {
  it('should find nothing wrong with addresses of the web, with empty lines, and with no line at all', () => {
    expect(
      pictureAddressesError(
        'https://images.example.com/a.jpg\n\n  http://images.example.com/b.jpg \n',
      ),
    ).toBeUndefined()
    expect(pictureAddressesError('')).toBeUndefined()
  })

  it.each([
    ['a line that is no address', 'no address'],
    ['an address of another kind', 'ftp://images.example.com/a.jpg'],
    ['an address without a host', 'https://'],
    [
      'an address of 501 characters',
      `https://images.example.com/${'a'.repeat(501 - 'https://images.example.com/'.length)}`,
    ],
  ])('should say which line to look at for %s', (_case, address) => {
    expect(
      pictureAddressesError(`https://images.example.com/a.jpg\n${address}`),
    ).toBe(
      '2 行目を確かめてください。http:// または https:// で始まる URL を、500 文字以内で書いてください。',
    )
  })

  it('should take an address of 500 characters', () => {
    expect(
      pictureAddressesError(
        `https://images.example.com/${'a'.repeat(500 - 'https://images.example.com/'.length)}`,
      ),
    ).toBeUndefined()
  })

  it('should count the lines as the control shows them, the empty ones too, and name the first that is wrong', () => {
    expect(
      pictureAddressesError(
        'https://images.example.com/a.jpg\n\n  \nno address\nnone either',
      ),
    ).toMatch(/^4 行目を確かめてください。/)
  })
})
