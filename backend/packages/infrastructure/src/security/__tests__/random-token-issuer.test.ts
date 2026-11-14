import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { RandomTokenIssuer } from '../random-token-issuer'

/** 32 random bytes in base64url without padding. */
const TOKEN = /^[A-Za-z0-9_-]{43}$/
const SHA256_HEX = /^[0-9a-f]{64}$/

const sha256Hex = (value: string): string =>
  createHash('sha256').update(value, 'utf8').digest('hex')

describe('RandomTokenIssuer', () => {
  const issuer = new RandomTokenIssuer()

  it('issues a token of 43 base64url characters', () => {
    const { token } = issuer.issue()

    expect(token).toMatch(TOKEN)
  })

  it('issues a different token every time', () => {
    const tokens = Array.from({ length: 1000 }, () => issuer.issue().token)

    expect(new Set(tokens).size).toBe(1000)
    expect(tokens.every((token) => TOKEN.test(token))).toBe(true)
  })

  it('gives with a token its SHA-256 in lower-case hex', () => {
    const { token, hash } = issuer.issue()

    expect(hash).toMatch(SHA256_HEX)
    expect(hash).toBe(sha256Hex(token))
    expect(hash).not.toContain(token)
  })

  it('hashes a token the same way every time', () => {
    const { token, hash } = issuer.issue()

    expect(issuer.hashOf(token)).toBe(hash)
    expect(new RandomTokenIssuer().hashOf(token)).toBe(hash)
  })

  it('hashes with SHA-256', () => {
    expect(issuer.hashOf('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('gives different tokens different hashes', () => {
    const first = issuer.issue()
    const second = issuer.issue()

    expect(first.hash).not.toBe(second.hash)
    expect(issuer.hashOf(`${first.token}x`)).not.toBe(first.hash)
  })
})
