import type { LocalizedText } from '@beauty-salon-shared/i18n'
import { describe, expect, it } from 'vitest'
import {
  LONGEST_WEB_ADDRESS,
  notWebAddress,
  WEB_ADDRESS_DESCRIPTION,
  WEB_ADDRESS_ERROR,
  webAddressError,
  webAddressLinesError,
  webAddressOf,
} from './web-addresses'

/** An address of the web of so many characters, written with a character of its path */
const addressOf = (length: number, character = 'a'): string => {
  const start = 'https://images.example.com/'

  return `${start}${character.repeat(length - start.length)}`
}

/** What is said of an address of any length that is none */
const NO_ADDRESS = {
  en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com).',
  ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を入力してください。',
}

describe('the sentences of an address of the web', () => {
  it('should say all of the rule of an address that stands alone', () => {
    expect(WEB_ADDRESS_ERROR).toEqual({
      en: 'Enter a URL that begins with http:// or https:// and has a domain name (such as example.com), up to 500 characters.',
      ja: 'http:// か https:// で始まる、ドメイン名（example.com など）の URL を、500 文字以内で入力してください。',
    })
    expect(notWebAddress(LONGEST_WEB_ADDRESS)).toEqual(WEB_ADDRESS_ERROR)
  })

  it('should name no length where an address may be of any', () => {
    expect(notWebAddress(null)).toEqual(NO_ADDRESS)
  })

  it('should say in a description what an address begins with and how long it may be', () => {
    expect(WEB_ADDRESS_DESCRIPTION).toEqual({
      en: 'A URL that begins with http:// or https://. Up to 500 characters.',
      ja: 'http:// か https:// で始まる URL。500 文字まで。',
    })
  })
})

/** What is said of a line of a list of addresses that stand alone */
const lineToCheck = (line: number, why: LocalizedText): LocalizedText => ({
  en: `Check line ${line}. ${why.en}`,
  ja: `${line} 行目を確かめてください。${why.ja}`,
})

describe('webAddressError', () => {
  it.each<[string, string | null]>([
    ['an address that was left empty', null],
    ['an address of https', 'https://example.com/styles/bob.jpg'],
    ['an address of http', 'http://example.com/'],
    ['an address written in capitals', 'HTTPS://EXAMPLE.COM/A.JPG'],
    [
      'an address with a port, a query and a fragment',
      'https://example.com:8443/a?b=c#d',
    ],
    ['an address at a domain name of Japanese', 'https://例え.jp/写真.jpg'],
    ['an address of 500 characters', addressOf(500)],
    [
      'an address of 500 characters outside the basic plane, counted as the API counts them',
      addressOf(500, '𠮷'),
    ],
  ])('should find nothing wrong with %s', (_case, address) => {
    expect(webAddressError(address)).toBeUndefined()
  })

  it.each<[string, string]>([
    ['a text that is no address', 'no address'],
    ['a name without a scheme', 'example.com/a.jpg'],
    ['an address of another scheme', 'ftp://example.com/a.jpg'],
    ['an address without a host', 'https://'],
    ['an address at this machine', 'http://localhost:3000/a.jpg'],
    ['an address at a machine by its number', 'http://192.168.1.10/a.jpg'],
    ['an address at a name without a dot', 'https://example/a.jpg'],
    ['an address of 501 characters', addressOf(501)],
    [
      'an address of 501 characters outside the basic plane',
      addressOf(501, '𠮷'),
    ],
  ])('should say the rule of %s', (_case, address) => {
    expect(webAddressError(address)).toEqual(WEB_ADDRESS_ERROR)
  })
})

describe('webAddressLinesError', () => {
  it('should find nothing wrong with addresses of the web, with empty lines, and with no line at all', () => {
    expect(
      webAddressLinesError(
        'https://images.example.com/a.jpg\n\n  http://images.example.com/b.jpg \n',
        LONGEST_WEB_ADDRESS,
      ),
    ).toBeUndefined()
    expect(webAddressLinesError('', LONGEST_WEB_ADDRESS)).toBeUndefined()
    expect(webAddressLinesError('', null)).toBeUndefined()
  })

  it.each<[string, string]>([
    ['a line that is no address', 'no address'],
    ['an address of another kind', 'ftp://images.example.com/a.jpg'],
    ['an address without a host', 'https://'],
    ['an address at a machine by its number', 'http://192.168.1.10/a.jpg'],
    ['an address of 501 characters', addressOf(501)],
  ])('should say which line to look at for %s', (_case, address) => {
    expect(
      webAddressLinesError(
        `https://images.example.com/a.jpg\n${address}`,
        LONGEST_WEB_ADDRESS,
      ),
    ).toEqual(lineToCheck(2, WEB_ADDRESS_ERROR))
  })

  it('should take an address of 500 characters, counted as the API counts them', () => {
    expect(
      webAddressLinesError(addressOf(500, '𠮷'), LONGEST_WEB_ADDRESS),
    ).toBeUndefined()
  })

  it('should take an address of any length in a list that has none', () => {
    expect(
      webAddressLinesError(
        `https://images.example.com/a.jpg\n${addressOf(501)}`,
        null,
      ),
    ).toBeUndefined()
  })

  it('should say of a list without a length which line is no address, and name no length', () => {
    expect(
      webAddressLinesError(
        'https://images.example.com/a.jpg\nno address',
        null,
      ),
    ).toEqual(lineToCheck(2, NO_ADDRESS))
  })

  it('should count the lines as the control shows them, the empty ones too, and name the first that is wrong', () => {
    expect(
      webAddressLinesError(
        'https://images.example.com/a.jpg\n\n  \nno address\nnone either',
        LONGEST_WEB_ADDRESS,
      ),
    ).toEqual(lineToCheck(4, WEB_ADDRESS_ERROR))
  })
})

describe('webAddressOf', () => {
  it.each<[string, string, string | null]>([
    [
      'an address of the web',
      'https://example.com/styles/bob.jpg',
      'https://example.com/styles/bob.jpg',
    ],
    [
      'an address without encryption',
      'http://example.com/',
      'http://example.com/',
    ],
    [
      'an address written in capitals',
      'HTTPS://EXAMPLE.COM/',
      'HTTPS://EXAMPLE.COM/',
    ],
    ['no address for a script', 'javascript:alert(1)', null],
    ['no address for an address of mail', 'mailto:hanako@example.com', null],
    [
      'no address for data that holds a page',
      'data:text/html,<script>alert(1)</script>',
      null,
    ],
    ['no address for another scheme', 'ftp://example.com/', null],
    ['no address for a name without a scheme', 'example.com', null],
    ['no address for one that leaves the scheme out', '//example.com', null],
    ['no address for nothing', '', null],
    ['no address for a note', '雑誌の切り抜きを持っていきます', null],
    [
      'no address for one that does not begin with the scheme',
      ' https://example.com/',
      null,
    ],
  ])('should give %s', (_case, url, address) => {
    expect(webAddressOf(url)).toBe(address)
  })
})
