import { afterEach, describe, expect, it, vi } from 'vitest'
import { answering, json, problem, UNREAD } from '../__tests__/api-answers'
import { aProfile } from './components/examples'
import { readOwnProfile, saveOwnProfile } from './profile-api'

/*
 * What the API answers to the profile of the account is met with the real
 * API (`own-profile.integration.test.tsx`). Here are the answers a test
 * cannot bring about there.
 */

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readOwnProfile', () => {
  it.each(UNREAD)('should read no profile after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const read = await readOwnProfile()

    // Assert
    expect(read).toEqual({ type })
  })

  it('should take a member gone between the session and the read as no profile', async () => {
    // Arrange
    answering(() => problem(404))

    // Act
    const read = await readOwnProfile()

    // Assert
    expect(read).toEqual({ type: 'unavailable' })
  })
})

describe('saveOwnProfile', () => {
  it('should send only what it is given, and give the profile the API saved', async () => {
    // Arrange
    const sent: unknown[] = []
    answering(async (asked) => {
      sent.push(await asked.json())
      return json(200, { data: aProfile(), meta: null, links: { self: '/' } })
    })

    // Act
    const saved = await saveOwnProfile({ bio: null })

    // Assert
    expect(saved).toEqual({ type: 'saved', profile: aProfile() })
    expect(sent).toEqual([{ bio: null }])
  })

  it.each<[string, () => Response | Promise<Response>, string]>([
    ['a body that is too large', () => problem(413), 'failed'],
    ['a body of another type', () => problem(415), 'failed'],
    [
      'a member gone between the session and the change',
      () => problem(404),
      'unavailable',
    ],
    ...UNREAD,
  ])('should save nothing after %s', async (_, given, type) => {
    // Arrange
    answering(given)

    // Act
    const saved = await saveOwnProfile({ bio: 'Hello' })

    // Assert
    expect(saved).toEqual({ type })
  })

  it('should name the values the API refused, with their rules', async () => {
    // Arrange
    answering(() => problem(400, [{ field: 'specialties.1', rule: 'too_big' }]))

    // Act
    const saved = await saveOwnProfile({ specialties: ['カット', 'x'] })

    // Assert
    expect(saved).toEqual({
      type: 'invalid',
      values: [{ field: 'specialties.1', rule: 'too_big' }],
    })
  })
})
