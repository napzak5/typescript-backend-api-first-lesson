import { describe, expect, it } from 'vitest'
import { ownStaffProfileLinks, staffProfileLinks } from '../links'

const STAFF_PROFILES = '/api/v1/staff-profiles'
const STAFF_ID = '0193a5b8-7c2e-7d4f-8a1b-3c5d7e9f0f01'

describe('staffProfileLinks', () => {
  it('links a profile to itself and to the list of profiles', () => {
    expect(staffProfileLinks(STAFF_PROFILES, STAFF_ID)).toEqual({
      self: `${STAFF_PROFILES}/${STAFF_ID}`,
      list: STAFF_PROFILES,
    })
  })

  it('keeps the collection path as the request wrote it and appends the ID it is given', () => {
    const collection = '/API/v1/Staff-Profiles'

    expect(staffProfileLinks(collection, STAFF_ID)).toEqual({
      self: `${collection}/${STAFF_ID}`,
      list: collection,
    })
  })

  it('appends the ID as it is given, without changing its case', () => {
    const inUpperCase = STAFF_ID.toUpperCase()

    expect(staffProfileLinks(STAFF_PROFILES, inUpperCase).self).toBe(
      `${STAFF_PROFILES}/${inUpperCase}`,
    )
  })
})

describe('ownStaffProfileLinks', () => {
  it('links the own profile to itself, which names no ID, and to the profile customers read', () => {
    expect(ownStaffProfileLinks(STAFF_PROFILES, STAFF_ID)).toEqual({
      self: `${STAFF_PROFILES}/me`,
      profile: `${STAFF_PROFILES}/${STAFF_ID}`,
    })
  })

  it('keeps the collection path as the request wrote it and appends the ID it is given', () => {
    const collection = '/API/v1/Staff-Profiles'
    const inUpperCase = STAFF_ID.toUpperCase()

    expect(ownStaffProfileLinks(collection, inUpperCase)).toEqual({
      self: `${collection}/me`,
      profile: `${collection}/${inUpperCase}`,
    })
  })
})
