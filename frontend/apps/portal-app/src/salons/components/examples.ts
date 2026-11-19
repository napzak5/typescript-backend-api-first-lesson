import type {
  ModelsDayOfWeekType,
  ModelsReviewResponse,
  ModelsReviewSummaryResponse,
  ModelsSalonResponse,
  ModelsServiceCategoryResponse,
  ModelsServiceResponse,
  ModelsStaffProfileResponse,
} from '@beauty-salon-frontend/api-client'

/**
 * What the stories of the salon components show: a salon as the API
 * describes it, with its menu, its people and its reviews. None of it
 * exists.
 */

const SALON_ID = '0b7f5c1e-3a52-4d8e-9c41-6f2e8d1a7b90'
const CUT_ID = '5d2c8a4f-1e63-4b7a-8f90-2c4e6a8b0d13'
const COLOR_ID = '9e1b3d5f-7a24-4c68-b0d2-4f6a8c0e2b35'
const CREATED_AT = '2026-04-01T01:00:00.000Z'

const EVERY_DAY_BUT_TUESDAY: ModelsDayOfWeekType[] = [
  'monday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

export const salon: ModelsSalonResponse = {
  id: SALON_ID,
  name: 'ヘアサロン こもれび 表参道',
  nameKana: 'ヘアサロン コモレビ オモテサンドウ',
  description:
    '表参道駅から歩いて 3 分。髪と頭皮にやさしい薬剤だけを使う、席数 6 の小さなサロンです。',
  postalCode: '150-0001',
  prefecture: '東京都',
  city: '渋谷区',
  address: '神宮前 4-1-1',
  building: 'こもれびビル 2 階',
  latitude: null,
  longitude: null,
  phoneNumber: '03-5550-0101',
  alternativePhone: null,
  email: 'omotesando@komorebi.example',
  websiteUrl: 'https://komorebi.example/omotesando',
  logoUrl: null,
  imageUrls: [],
  features: ['個室あり', 'キッズスペース', '駐車場'],
  amenities: ['Wi-Fi', 'ドリンクサービス'],
  businessHours: [
    ...EVERY_DAY_BUT_TUESDAY.map((dayOfWeek) => ({
      dayOfWeek,
      operatingSlots: [{ startTime: '10:00', endTime: '20:00' }],
      breakSlots: null,
      isClosed: false,
      effectivePeriod: null,
    })),
    {
      dayOfWeek: 'tuesday',
      operatingSlots: [],
      breakSlots: null,
      isClosed: true,
      effectivePeriod: null,
    },
  ],
  rating: 4.5,
  reviewCount: 128,
  timezone: 'Asia/Tokyo',
  currency: 'JPY',
  taxRate: 10,
  isActive: true,
  openingHours: [
    {
      dayOfWeek: 'monday',
      date: '2026-11-23',
      openTime: '10:00:00',
      closeTime: '18:00:00',
      isHoliday: false,
      holidayName: '勤労感謝の日',
      notes: '祝日は 18 時までの営業です',
    },
    {
      dayOfWeek: 'wednesday',
      date: '2026-11-25',
      openTime: null,
      closeTime: null,
      isHoliday: true,
      holidayName: null,
      notes: '研修のため',
    },
  ],
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
}

/** A salon nobody rated, that wrote little about itself */
export const plainSalon: ModelsSalonResponse = {
  ...salon,
  id: '4c8e0a2d-6b13-4f57-a9d1-8e0c2a4b6d57',
  name: '理容 みなと',
  nameKana: null,
  description: null,
  postalCode: null,
  prefecture: '大阪府',
  city: '大阪市浪速区',
  address: '難波中 2-3-4',
  building: null,
  phoneNumber: '06-5550-0102',
  email: 'minato@riyo.example',
  websiteUrl: null,
  features: [],
  amenities: [],
  businessHours: null,
  rating: null,
  reviewCount: 0,
  openingHours: [],
}

const category = (
  id: string,
  name: string,
  description: string | null,
  displayOrder: number,
): ModelsServiceCategoryResponse => ({
  id,
  salonId: SALON_ID,
  name,
  description,
  parentId: null,
  category: 'cut',
  displayOrder,
  iconUrl: null,
  color: null,
  isActive: true,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
})

export const categories: ModelsServiceCategoryResponse[] = [
  category(CUT_ID, 'カット', 'シャンプーとブローを含みます。', 1),
  { ...category(COLOR_ID, 'カラー', null, 2), category: 'color' },
]

const ladiesCut: ModelsServiceResponse = {
  id: '1a3c5e7f-9b20-4d46-8e68-0a2c4e6f8b79',
  salonId: SALON_ID,
  categoryId: CUT_ID,
  name: 'レディースカット',
  description: '骨格と髪質に合わせて切ります。シャンプーとブローを含みます。',
  shortDescription: 'シャンプー、ブロー込み',
  duration: 60,
  price: 5500,
  discountPrice: null,
  taxIncluded: true,
  pricingStrategy: 'fixed',
  imageUrl: null,
  imageUrls: [],
  requiredStaffLevel: null,
  maxBookingsPerDay: null,
  requiresConsultation: false,
  allowOnlineBooking: true,
  bookingRequirements: [],
  isPackage: false,
  packageServiceIds: [],
  tags: [],
  sortOrder: 1,
  serviceStatus: 'active',
  availability: 'always',
  isActive: true,
  options: [],
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
}

export const services: ModelsServiceResponse[] = [
  ladiesCut,
  {
    ...ladiesCut,
    id: '2b4d6f80-ac31-4e57-9f79-1b3d5f708c8a',
    name: 'キッズカット（小学生まで）',
    description: null,
    shortDescription: null,
    duration: 30,
    price: 2500,
    sortOrder: 2,
  },
  {
    ...ladiesCut,
    id: '3c5e7091-bd42-4f68-a08a-2c4e60819d9b',
    categoryId: COLOR_ID,
    name: 'フルカラー',
    description: '根元から毛先まで染めます。',
    shortDescription: null,
    duration: 90,
    price: 8000,
    discountPrice: 7200,
    sortOrder: 1,
  },
  {
    ...ladiesCut,
    id: '4d6f81a2-ce53-4079-b19b-3d5f7192aeac',
    categoryId: COLOR_ID,
    name: 'ハイライト',
    description: null,
    shortDescription: '髪の長さと本数で、料金が変わります',
    duration: 120,
    price: 12000,
    taxIncluded: false,
    pricingStrategy: 'variable',
    requiresConsultation: true,
    sortOrder: 2,
  },
  {
    ...ladiesCut,
    id: '5e7092b3-df64-418a-82ac-4e60829bbfbd',
    categoryId: null,
    name: 'ブライダルヘアセット',
    description: '打ち合わせのうえ、内容と料金を決めます。',
    shortDescription: null,
    duration: 150,
    price: 0,
    pricingStrategy: 'consultation_based',
    allowOnlineBooking: false,
    sortOrder: 3,
  },
]

export const staff: ModelsStaffProfileResponse[] = [
  {
    id: '6f81a3c4-e075-429b-93bd-5f7193acc0ce',
    salonId: SALON_ID,
    displayName: '田中 ひろし',
    level: 'senior',
    position: '店長',
    specialties: ['カット', 'パーマ'],
    bio: '髪質を見きわめたカットで、朝の手入れが楽になる髪型をつくります。',
    imageUrl: null,
    yearsOfExperience: 12,
    certifications: ['美容師免許', '管理美容師'],
    canReceiveBookings: true,
  },
  {
    id: '7092b4d5-f186-43ac-a4ce-60829bbdd1df',
    salonId: SALON_ID,
    displayName: '鈴木 みか',
    level: 'expert',
    position: null,
    specialties: ['カラー', 'ハイライト', 'トリートメント'],
    bio: null,
    imageUrl: null,
    yearsOfExperience: null,
    certifications: [],
    canReceiveBookings: true,
  },
  {
    id: '81a3c5e6-0297-44bd-b5df-7193acce02e0',
    salonId: SALON_ID,
    displayName: '伊藤 たけし',
    level: 'junior',
    position: 'アシスタント',
    specialties: [],
    bio: 'シャンプーとヘッドスパを担当しています。',
    imageUrl: null,
    yearsOfExperience: 1,
    certifications: [],
    canReceiveBookings: false,
  },
]

export const reviewSummary: ModelsReviewSummaryResponse = {
  averageRating: 4.4,
  totalReviews: 128,
  ratingDistribution: { '1': 2, '2': 4, '3': 10, '4': 36, '5': 76 },
}

/** Nobody wrote a review yet */
export const emptyReviewSummary: ModelsReviewSummaryResponse = {
  averageRating: null,
  totalReviews: 0,
  ratingDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
}

/**
 * How the people were rated: the first by many, the second by nobody yet.
 * Of the third nothing is known
 */
export const staffRatings: Record<string, ModelsReviewSummaryResponse> = {
  '6f81a3c4-e075-429b-93bd-5f7193acc0ce': {
    averageRating: 4.6,
    totalReviews: 23,
    ratingDistribution: { '1': 0, '2': 0, '3': 2, '4': 5, '5': 16 },
  },
  '7092b4d5-f186-43ac-a4ce-60829bbdd1df': emptyReviewSummary,
}

/** A review that holds everything a review can hold */
export const fullReview: ModelsReviewResponse = {
  id: '92b4d6f7-13a8-45ce-86e0-82a4bddf03f1',
  salonId: SALON_ID,
  customerId: 'a3c5e708-24b9-46df-97f1-93b5cee01402',
  bookingId: 'b4d6f819-35ca-47e0-a802-a4c6dff12513',
  staffId: null,
  overallRating: 5,
  serviceRating: 5,
  staffRating: 5,
  atmosphereRating: 4,
  cleanlinessRating: 5,
  valueRating: 4,
  title: '思ったとおりの色になりました',
  comment:
    '写真を見せて相談したら、髪の状態に合わせた染め方を提案してくれました。色もちもよいです。',
  imageUrls: [],
  isVerified: true,
  helpfulCount: 12,
  reportCount: 0,
  ownerResponse:
    'ご来店ありがとうございました。またのお越しをお待ちしています。',
  ownerRespondedAt: '2026-11-12T03:00:00.000Z',
  createdAt: '2026-11-10T05:30:00.000Z',
  updatedAt: '2026-11-12T03:00:00.000Z',
}

export const reviews: ModelsReviewResponse[] = [
  fullReview,
  {
    ...fullReview,
    id: 'c5e7092a-46db-48f1-b913-b5d7e0023624',
    overallRating: 3,
    serviceRating: null,
    staffRating: null,
    atmosphereRating: null,
    cleanlinessRating: null,
    valueRating: null,
    title: null,
    comment: '仕上がりには満足ですが、予約の時間から 20 分待ちました。',
    isVerified: false,
    helpfulCount: 0,
    ownerResponse: null,
    ownerRespondedAt: null,
    createdAt: '2026-10-28T09:15:00.000Z',
    updatedAt: '2026-10-28T09:15:00.000Z',
  },
  {
    ...fullReview,
    id: 'd6f81a3b-57ec-4902-8a24-c6e8f1134735',
    overallRating: 4,
    serviceRating: null,
    staffRating: null,
    atmosphereRating: null,
    cleanlinessRating: null,
    valueRating: null,
    title: 'また行きます',
    comment: null,
    helpfulCount: 1,
    ownerResponse: null,
    ownerRespondedAt: null,
    createdAt: '2026-10-02T02:00:00.000Z',
    updatedAt: '2026-10-02T02:00:00.000Z',
  },
]
