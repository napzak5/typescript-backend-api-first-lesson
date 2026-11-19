import type { ModelsCustomerProfileResponse } from '@beauty-salon-frontend/api-client'

/*
 * What the stories of the profile components show: a customer who has come
 * for years and has said everything about themselves, and one who has just
 * said who they are.
 */

/** The day the stories are told on */
export const TODAY = '2026-11-19'

export const profile: ModelsCustomerProfileResponse = {
  id: '3f6a1c58-7b0e-4d92-a5c3-9e8d2b417f60',
  lastName: '山田',
  firstName: '花子',
  lastNameKana: 'ヤマダ',
  firstNameKana: 'ハナコ',
  email: 'hanako.yamada@example.com',
  phoneNumber: '090-5550-0199',
  alternativePhone: '03-5550-0142',
  postalCode: '150-0001',
  prefecture: '東京都',
  city: '渋谷区',
  address: '神宮前 1-2-3',
  building: 'こもれびハイツ 302',
  birthDate: '1990-05-15',
  gender: 'female',
  occupation: 'デザイナー',
  membershipTier: 'gold',
  loyaltyPoints: 2500,
  preferences: {
    preferredServices: ['cut', 'color'],
    notes: 'オーガニックの製品を使ってほしいです。',
  },
  referralCode: 'HANAKO-2026',
  firstVisitDate: '2023-04-08',
  lastVisitDate: '2026-11-09',
  visitCount: 12,
  allowMarketing: false,
  allowSms: true,
  allowEmail: true,
  hairType: 'wavy',
  hairThickness: 'medium',
  scalpCondition: 'dry',
  createdAt: '2023-04-01T02:15:00.000Z',
  updatedAt: '2026-11-09T08:40:00.000Z',
}

/** Somebody who registered for a first booking: a name, a phone number, and nothing else. */
export const newProfile: ModelsCustomerProfileResponse = {
  ...profile,
  id: '8c2e4a60-1d37-4b89-b6f5-0a9c3e7d5b21',
  lastName: '佐藤',
  firstName: '健',
  lastNameKana: null,
  firstNameKana: null,
  email: 'ken.sato@example.com',
  phoneNumber: '080-5550-0117',
  alternativePhone: null,
  postalCode: null,
  prefecture: null,
  city: null,
  address: null,
  building: null,
  birthDate: null,
  gender: null,
  occupation: null,
  membershipTier: 'regular',
  loyaltyPoints: 0,
  preferences: null,
  referralCode: null,
  firstVisitDate: null,
  lastVisitDate: null,
  visitCount: 0,
  allowMarketing: false,
  allowSms: false,
  allowEmail: false,
  hairType: null,
  hairThickness: null,
  scalpCondition: null,
  createdAt: '2026-11-19T01:00:00.000Z',
  updatedAt: '2026-11-19T01:00:00.000Z',
}

/** What somebody wrote who had a lot to say, and an address without a place to break a line. */
export const wordyProfile: ModelsCustomerProfileResponse = {
  ...profile,
  occupation: 'フリーランスのグラフィックデザイナー、イラストレーター',
  building:
    'TheGardenResidenceAtJingumaeNorthWingAnnexBuildingNumberThree-1204',
  preferences: {
    preferredServices: [
      'cut',
      'color',
      'perm',
      'treatment',
      'spa',
      'styling',
      'extension',
      'other',
    ],
    notes:
      '頭皮が敏感なので、刺激の少ない薬剤でお願いします。\n\n香りの強い製品は苦手です。仕上げのスタイリング剤は、つけずに帰りたいです。',
  },
}
