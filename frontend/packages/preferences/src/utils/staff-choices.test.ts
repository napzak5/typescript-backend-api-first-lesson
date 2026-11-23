import type { ModelsStaffProfileResponse } from '@beauty-salon-frontend/api-client'
import { describe, expect, it } from 'vitest'
import { kenta, misaki, yui } from '../components/examples'
import {
  staffChoicesOf,
  staffIdsOf,
  staffLabelOf,
  staffNamed,
} from './staff-choices'

const TOKYO = {
  id: '5d0c3f6a-2b9e-4c71-8a54-e1f7b3d9c026',
  name: 'みなと美容室',
}
const OSAKA = {
  id: '9b7e1d42-6f3a-4e08-b5c9-2a4d8f0e6713',
  name: 'あおぞらヘア',
}

const member = (
  id: string,
  displayName: string,
  salonId: string,
): ModelsStaffProfileResponse => ({
  id,
  salonId,
  displayName,
  level: 'stylist',
  position: null,
  specialties: [],
  bio: null,
  imageUrl: null,
  yearsOfExperience: null,
  certifications: [],
  canReceiveBookings: true,
})

const MISAKI = member(
  'a41f7c3e-58d2-4b96-9e0a-7c2b5d1f8e34',
  '田中 美咲',
  TOKYO.id,
)
const KENTA = member(
  'c7d2e9b4-1a6f-4c83-b05e-3f8a6d2c9b17',
  '佐藤 健太',
  TOKYO.id,
)
const YUI = member(
  'e3b8a5d1-9c4f-4d27-a6e0-1b7c4f9d2a58',
  '鈴木 結衣',
  OSAKA.id,
)

describe('staffIdsOf', () => {
  it('should name the member who is wished for first, then those to avoid', () => {
    expect(
      staffIdsOf({
        preferredStaffId: MISAKI.id,
        avoidStaffIds: [YUI.id, KENTA.id],
      }),
    ).toEqual([MISAKI.id, YUI.id, KENTA.id])
  })

  it('should name nobody for preferences that name nobody', () => {
    expect(staffIdsOf({ preferredStaffId: null, avoidStaffIds: [] })).toEqual(
      [],
    )
  })

  it('should name those to avoid alone when nobody is wished for', () => {
    expect(
      staffIdsOf({ preferredStaffId: null, avoidStaffIds: [KENTA.id] }),
    ).toEqual([KENTA.id])
  })

  it('should name a member once who is stored twice', () => {
    expect(
      staffIdsOf({
        preferredStaffId: MISAKI.id,
        avoidStaffIds: [KENTA.id, MISAKI.id, KENTA.id],
      }),
    ).toEqual([MISAKI.id, KENTA.id])
  })
})

describe('staffChoicesOf', () => {
  it('should name every member with their salon', () => {
    expect(staffChoicesOf([MISAKI], [TOKYO])).toEqual([
      {
        id: MISAKI.id,
        displayName: '田中 美咲',
        salonId: TOKYO.id,
        salonName: 'みなと美容室',
      },
    ])
  })

  it('should let the salons follow each other by name, and keep the staff of a salon in the order they came in', () => {
    const choices = staffChoicesOf([MISAKI, YUI, KENTA], [TOKYO, OSAKA])

    expect(choices.map(({ displayName }) => displayName)).toEqual([
      '鈴木 結衣',
      '田中 美咲',
      '佐藤 健太',
    ])
  })

  it('should name a member once who is given twice', () => {
    const choices = staffChoicesOf([MISAKI, KENTA, MISAKI], [TOKYO])

    expect(choices.map(({ id }) => id)).toEqual([MISAKI.id, KENTA.id])
  })

  it('should leave out a member whose salon is not known', () => {
    const choices = staffChoicesOf([MISAKI, YUI], [TOKYO])

    expect(choices.map(({ id }) => id)).toEqual([MISAKI.id])
  })

  it('should keep the staff of two salons of one name apart', () => {
    const twin = {
      id: 'f0000000-0000-4000-8000-000000000001',
      name: TOKYO.name,
    }
    const other = member(
      '11111111-1111-4111-8111-111111111111',
      '高橋 翼',
      twin.id,
    )

    const choices = staffChoicesOf([other, MISAKI, KENTA], [twin, TOKYO])

    expect(choices.map(({ salonId }) => salonId)).toEqual([
      TOKYO.id,
      TOKYO.id,
      twin.id,
    ])
  })

  it('should offer nobody when there is no staff', () => {
    expect(staffChoicesOf([], [TOKYO])).toEqual([])
  })
})

describe('staffLabelOf', () => {
  it('should name a member with the salon they work at', () => {
    expect(
      staffLabelOf({
        id: MISAKI.id,
        displayName: '田中 美咲',
        salonId: TOKYO.id,
        salonName: 'みなと美容室',
      }),
    ).toEqual({
      en: '田中 美咲 (みなと美容室)',
      ja: '田中 美咲（みなと美容室）',
    })
  })
})

describe('staffNamed', () => {
  it('should name the members in the order of their IDs, each with their salon', () => {
    expect(staffNamed([yui.id, misaki.id], [misaki, kenta, yui])).toEqual([
      {
        en: '鈴木 結衣 (Hair Studio Osaka)',
        ja: '鈴木 結衣（Hair Studio Osaka）',
      },
      {
        en: '田中 美咲 (Beauty Salon Tokyo)',
        ja: '田中 美咲（Beauty Salon Tokyo）',
      },
    ])
  })

  it('should leave out a member who is not among the staff that can be named', () => {
    expect(
      staffNamed(
        ['0f6d3b8a-7e21-4c95-b4a0-6d9e2c5f1a73', kenta.id],
        [misaki, kenta],
      ),
    ).toEqual([
      {
        en: '佐藤 健太 (Beauty Salon Tokyo)',
        ja: '佐藤 健太（Beauty Salon Tokyo）',
      },
    ])
  })

  it('should name nobody for no ID', () => {
    expect(staffNamed([], [misaki])).toEqual([])
  })
})
