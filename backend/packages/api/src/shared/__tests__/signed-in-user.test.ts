import { IncomingMessage } from 'node:http'
import { Socket } from 'node:net'
import { describe, expect, it } from 'vitest'
import { noteSignedInUser, signedInUserOf } from '../signed-in-user'

const USER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c01'
const OTHER_USER_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0c11'

const newRequest = (): IncomingMessage => new IncomingMessage(new Socket())

describe('signedInUserOf', () => {
  it('knows no user for a request nobody was signed in for', () => {
    const req = newRequest()

    expect(signedInUserOf(req)).toBeUndefined()
  })

  it('returns the user noted for the request', () => {
    const req = newRequest()

    noteSignedInUser(req, USER_ID)

    expect(signedInUserOf(req)).toBe(USER_ID)
  })

  it('keeps the users of different requests apart', () => {
    const first = newRequest()
    const second = newRequest()
    const third = newRequest()

    noteSignedInUser(first, USER_ID)
    noteSignedInUser(second, OTHER_USER_ID)

    expect(signedInUserOf(first)).toBe(USER_ID)
    expect(signedInUserOf(second)).toBe(OTHER_USER_ID)
    expect(signedInUserOf(third)).toBeUndefined()
  })
})
