import type { ModelsStaffResponse } from '@beauty-salon-frontend/api-client'
import { salon } from '../../bookings/components/examples'

/*
 * Members of the staff ledger for the stories: those of the booking
 * examples, as the owner of the salon keeps them.
 */

/** The account of the owner of the examples, linked to a member of their own */
const OWNER_ACCOUNT = '2f7c4d1a-8b3e-4a6f-9c2d-1e5b7a9c3d40'

/** A member of the staff who takes bookings, with everything the ledger keeps of one. */
export const aStaffMember = (
  changes: Partial<ModelsStaffResponse> = {},
): ModelsStaffResponse => ({
  id: '7c4a9e2b-1f3d-4b8a-9e6c-5d2f8a1b3c70',
  salonId: salon.id,
  userId: '4a2e6c8b-1d3f-4e5a-8b7c-9d0e1f2a3b51',
  firstName: '美咲',
  lastName: '田中',
  firstNameKana: 'ミサキ',
  lastNameKana: 'タナカ',
  displayName: '田中 美咲',
  email: 'misaki.tanaka@example.com',
  phoneNumber: '090-1234-5678',
  alternativePhone: null,
  staffCode: 'STF010',
  level: 'senior',
  position: 'トップスタイリスト',
  specialties: ['カット', 'カラー'],
  bio: 'ショートカットと、透明感のあるカラーが得意です。\nお気軽にご相談ください。',
  imageUrl: 'https://photos.example.com/staff/misaki.jpg',
  yearsOfExperience: 8,
  certifications: ['美容師免許', '管理美容師'],
  hireDate: '2018-04-01',
  employmentType: '正社員',
  baseSalary: 280000,
  commissionRate: 12.5,
  canReceiveBookings: true,
  maxConcurrentBookings: 2,
  bufferTimeBefore: 0,
  bufferTimeAfter: 15,
  isActive: true,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
  ...changes,
})

/** A member who was just registered: nothing was said of them that may be left out, and no account is linked yet. */
export const aNewMember = (): ModelsStaffResponse =>
  aStaffMember({
    id: '8d5b0f3c-2a4e-4c9b-8f7d-6e3a9b2c4d81',
    userId: null,
    firstName: '健',
    lastName: '佐藤',
    firstNameKana: null,
    lastNameKana: null,
    displayName: '佐藤 健',
    email: 'ken.sato@example.com',
    phoneNumber: '080-2345-6789',
    staffCode: null,
    level: 'junior',
    position: null,
    specialties: [],
    bio: null,
    imageUrl: null,
    yearsOfExperience: null,
    certifications: [],
    hireDate: null,
    employmentType: null,
    baseSalary: null,
    commissionRate: null,
    canReceiveBookings: false,
    maxConcurrentBookings: 1,
    bufferTimeAfter: 0,
    isActive: false,
  })

/** The member the account of the owner of the examples is linked to. */
export const theOwner = (): ModelsStaffResponse =>
  aStaffMember({
    id: '9e6c1a4d-3b5f-4dac-9a8e-7f4b0c3d5e92',
    userId: OWNER_ACCOUNT,
    firstName: '明子',
    lastName: '森',
    firstNameKana: 'アキコ',
    lastNameKana: 'モリ',
    displayName: '森 明子',
    email: 'akiko.mori@example.com',
    staffCode: 'STF001',
    level: 'director',
    position: 'オーナー',
    canReceiveBookings: false,
  })
