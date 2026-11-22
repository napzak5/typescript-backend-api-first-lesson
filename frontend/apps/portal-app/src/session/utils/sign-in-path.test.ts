import { describe, expect, it } from 'vitest'
import { pathAfterSignIn, signInHrefFrom } from './sign-in-path'

const SALON = '/salons/0b7f5c1e-3a52-4d8e-9c41-6f2e8d1a7b90'

const queryOf = (href: string): URLSearchParams =>
  new URL(href, 'http://portal.test').searchParams

describe('signInHrefFrom', () => {
  it('should be the address of the sign-in screen, naming the page to come back to', () => {
    expect(signInHrefFrom(SALON)).toBe(
      '/sign-in?from=%2Fsalons%2F0b7f5c1e-3a52-4d8e-9c41-6f2e8d1a7b90',
    )
  })
})

describe('pathAfterSignIn', () => {
  it('should be the page the address of the sign-in screen names', () => {
    expect(pathAfterSignIn(queryOf(signInHrefFrom(SALON)))).toBe(SALON)
  })

  it.each([
    '/',
    '/bookings',
    '/mypage/reviews',
    '/bookings/b_1/review',
    '/salons/',
  ])('should follow the path %s of the application', (path) => {
    expect(pathAfterSignIn(new URLSearchParams({ from: path }))).toBe(path)
  })

  it('should be the start when the address names no page', () => {
    expect(pathAfterSignIn(new URLSearchParams())).toBe('/')
  })

  it.each([
    ['another site', 'https://example.com/'],
    ['another site without its scheme', '//example.com'],
    ['another site whose name has no dot', '//localhost'],
    ['another site behind a backslash', '/\\example.com'],
    ['another site behind a character a browser drops', '/\t/example.com'],
    ['another site behind a line break', '/\n/example.com'],
    ['a path with an empty segment', '/salons//mypage'],
    ['a path that is relative', 'salons'],
    ['a script', 'javascript:alert(1)'],
    ['a path with a query', '/?keyword=cut'],
    ['a path with a fragment', '/mypage#top'],
    ['a path that climbs', '/salons/../mypage'],
    ['a path with an encoded slash', '/%2Fexample.com'],
    ['nothing', ''],
  ])('should be the start when the address names %s', (_case, from) => {
    expect(pathAfterSignIn(new URLSearchParams({ from }))).toBe('/')
  })
})
