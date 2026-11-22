import { describe, expect, it } from 'vitest'
import { webAddressOf } from './web-addresses'

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
