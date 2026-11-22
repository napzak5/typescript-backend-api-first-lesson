import type {
  ModelsCustomerProfileCreateRequest,
  ModelsCustomerProfileUpdateRequest,
} from '@beauty-salon-frontend/api-client'
import {
  answering,
  asked,
  OUTSIDE_THE_CONTRACT,
  pageOfAGateway,
  problem,
  record,
  sent,
} from '@beauty-salon-frontend/testing/answers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createOwnProfile,
  readOwnProfile,
  updateOwnProfile,
} from './profile-api'

/*
 * The answers the real API gives are met in `profile.integration.test.tsx`.
 * Here are the ones a test cannot bring about there (too many requests, an
 * error of the server, no answer, a status the contract does not name),
 * that every operation reads its answers alike, and what each operation
 * asks for.
 */

const PROFILE: ModelsCustomerProfileCreateRequest = {
  lastName: '山田',
  firstName: '花子',
  phoneNumber: '090-5550-0199',
  lastNameKana: null,
  firstNameKana: null,
  alternativePhone: null,
  postalCode: null,
  prefecture: null,
  city: null,
  address: null,
  building: null,
  birthDate: null,
  gender: null,
  occupation: null,
  preferences: null,
  allowEmail: true,
  allowSms: false,
  allowMarketing: false,
}

const CHANGES: ModelsCustomerProfileUpdateRequest = {
  building: null,
  preferences: { preferredServices: ['cut', 'spa'], notes: null },
  allowSms: true,
}

/** Every operation of the screens of a profile, called as a screen calls it. */
const OPERATIONS: [string, () => Promise<{ type: string }>][] = [
  ['readOwnProfile', () => readOwnProfile()],
  ['createOwnProfile', () => createOwnProfile(PROFILE)],
  ['updateOwnProfile', () => updateOwnProfile(CHANGES)],
]

const WRITES = OPERATIONS.filter(([name]) => name !== 'readOwnProfile')

describe('the operations of the screens of a profile', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe.each(OPERATIONS)('%s', (_name, call) => {
    it('should say that there were too many requests when the API limits them', async () => {
      answering(() => problem(429))

      expect(await call()).toEqual({ type: 'tooManyRequests' })
    })

    it('should have failed when the API answers with an error of the server', async () => {
      answering(() => problem(500))

      expect(await call()).toEqual({ type: 'failed' })
    })

    it('should have failed, and not reject, when there is no answer', async () => {
      answering(() => Promise.reject(new TypeError('Failed to fetch')))

      expect(await call()).toEqual({ type: 'failed' })
    })

    it.each(OUTSIDE_THE_CONTRACT)(
      'should have failed, and not reject, when the answer is %s: a status the contract does not name',
      async (_case, status) => {
        answering(() => pageOfAGateway(status))

        expect(await call()).toEqual({ type: 'failed' })
      },
    )

    it.each([
      ['knows no session', 401],
      ['does not allow it', 403],
    ])(
      'should have failed when the API %s: the guard of the session says what stands in the way',
      async (_case, status) => {
        answering(() => problem(status))

        expect(await call()).toEqual({ type: 'failed' })
      },
    )
  })

  describe.each(WRITES)('%s', (_name, call) => {
    it.each([
      ['a body that is too large', 413],
      ['a body of a type it does not read', 415],
    ])(
      'should have failed when the API answers with %s',
      async (_case, status) => {
        answering(() => problem(status))

        expect(await call()).toEqual({ type: 'failed' })
      },
    )

    it('should name the values that the API does not take, with the rules they broke', async () => {
      answering(() =>
        problem(400, [
          { field: 'phoneNumber', rule: 'invalid_format' },
          { field: 'lastName', rule: 'too_big' },
        ]),
      )

      expect(await call()).toEqual({
        type: 'invalid',
        values: [
          { field: 'phoneNumber', rule: 'invalid_format' },
          { field: 'lastName', rule: 'too_big' },
        ],
      })
    })

    it('should name no value when the API names none', async () => {
      answering(() => problem(400))

      expect(await call()).toEqual({ type: 'invalid', values: [] })
    })
  })

  describe('readOwnProfile', () => {
    it('should hand over the profile of the answer', async () => {
      const fetched = answering(() => record(200, { id: 'me' }))

      expect(await readOwnProfile()).toEqual({
        type: 'found',
        profile: { id: 'me' },
      })
      expect(asked(fetched)).toEqual(['GET /customers/me'])
    })

    it('should say that the account has no profile when the API finds none', async () => {
      answering(() => problem(404))

      expect(await readOwnProfile()).toEqual({ type: 'none' })
    })
  })

  describe('createOwnProfile', () => {
    it('should send the profile, and hand over the one the API made of it', async () => {
      const fetched = answering(() => record(201, { id: 'me' }))

      expect(await createOwnProfile(PROFILE)).toEqual({
        type: 'created',
        profile: { id: 'me' },
      })
      expect(asked(fetched)).toEqual(['POST /customers/me'])
      expect(sent(fetched)).toMatchObject({ body: JSON.stringify(PROFILE) })
    })

    it('should say that the API refused it when it answers with a conflict', async () => {
      answering(() => problem(409))

      expect(await createOwnProfile(PROFILE)).toEqual({ type: 'refused' })
    })
  })

  describe('updateOwnProfile', () => {
    it('should send the changes and nothing else, and hand over the profile as the API has it now', async () => {
      const fetched = answering(() => record(200, { id: 'me' }))

      expect(await updateOwnProfile(CHANGES)).toEqual({
        type: 'updated',
        profile: { id: 'me' },
      })
      expect(asked(fetched)).toEqual(['PATCH /customers/me'])
      expect(sent(fetched)).toMatchObject({ body: JSON.stringify(CHANGES) })
    })

    it('should say that the profile is gone when the API finds none', async () => {
      answering(() => problem(404))

      expect(await updateOwnProfile(CHANGES)).toEqual({ type: 'none' })
    })
  })
})
