import type { ModelsStaffProfileResponse } from '@beauty-salon-frontend/api-client'

/** The profile of a stylist who has introduced herself with everything, changed as a story needs */
export const aProfile = (
  changes: Partial<ModelsStaffProfileResponse> = {},
): ModelsStaffProfileResponse => ({
  id: '7c1d9e2a-4b6f-4c8d-9a1e-3f5b7d9c2e41',
  salonId: '0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c01',
  displayName: 'Misaki',
  level: 'senior',
  position: '店長',
  specialties: ['カット', 'カラー'],
  bio: 'ショートカットと、透明感のあるカラーが得意です。\nお気軽にご相談ください。',
  imageUrl: 'https://photos.example.com/staff/misaki.jpg',
  yearsOfExperience: 8,
  certifications: ['美容師免許'],
  canReceiveBookings: true,
  ...changes,
})

/** The address of the page of the salon the customers read, in the stories */
export const CUSTOMER_VIEW =
  'https://portal.salon.example/salons/0193a5b2-8a10-7c2e-b1d4-5e6f7a8b9c01'
