import type {
  ModelsServiceCategoryResponse,
  ModelsServiceResponse,
} from '@beauty-salon-frontend/api-client'
import { salon } from '../../bookings/components/examples'

/*
 * A menu for the stories: three categories of the salon of the booking
 * examples, one of them below another, and services of them and of none.
 */

const MADE = '2026-04-01T00:00:00.000Z'

/** A category of the top of the menu, with everything a category keeps. */
export const aCategory = (
  changes: Partial<ModelsServiceCategoryResponse> = {},
): ModelsServiceCategoryResponse => ({
  id: '3b8e1f4a-6c2d-4e9f-8a7b-1c5d9e3f2a10',
  salonId: salon.id,
  name: 'カット',
  description: 'シャンプーとブローが付きます。',
  parentId: null,
  category: 'cut',
  displayOrder: 1,
  iconUrl: 'https://icons.example.com/cut.svg',
  color: '#C8A2C8',
  isActive: true,
  createdAt: MADE,
  updatedAt: MADE,
  ...changes,
})

/** The colouring, a category of the top */
export const colouring = (): ModelsServiceCategoryResponse =>
  aCategory({
    id: '4c9f2a5b-7d3e-4f0a-9b8c-2d6e0f4a3b21',
    name: 'カラー',
    description: null,
    category: 'color',
    displayOrder: 2,
    iconUrl: null,
    color: null,
  })

/** The highlights, below the colouring and switched off */
export const highlights = (): ModelsServiceCategoryResponse =>
  aCategory({
    id: '5d0a3b6c-8e4f-4a1b-8c9d-3e7f1a5b4c32',
    name: 'ハイライト',
    description: null,
    parentId: colouring().id,
    category: 'color',
    displayOrder: 3,
    iconUrl: null,
    color: '#FFD93D',
    isActive: false,
  })

/** The categories of the menu, in its order */
export const CATEGORIES_OF_THE_MENU: ModelsServiceCategoryResponse[] = [
  aCategory(),
  colouring(),
  highlights(),
]

/** A service of the cut, with an option and everything else a service keeps. */
export const aService = (
  changes: Partial<ModelsServiceResponse> = {},
): ModelsServiceResponse => ({
  id: '6e1b4c7d-9f5a-4b2c-9d0e-4f8a2b6c5d43',
  salonId: salon.id,
  categoryId: aCategory().id,
  name: 'カット',
  description:
    'シャンプー、カット、ブローまで。\n仕上げのスタイリング剤はお選びいただけます。',
  shortDescription: '似合わせのカット',
  duration: 60,
  price: 5500,
  discountPrice: null,
  taxIncluded: true,
  pricingStrategy: 'fixed',
  imageUrl: 'https://photos.example.com/menu/cut.jpg',
  imageUrls: [],
  requiredStaffLevel: null,
  maxBookingsPerDay: null,
  requiresConsultation: false,
  allowOnlineBooking: true,
  bookingRequirements: [],
  isPackage: false,
  packageServiceIds: [],
  tags: ['人気'],
  sortOrder: 1,
  serviceStatus: 'active',
  availability: 'always',
  isActive: true,
  options: [
    {
      name: '前髪カット',
      description: null,
      optionType: 'addon',
      additionalTime: 10,
      additionalPrice: 1100,
      maxQuantity: 1,
      isRequired: false,
      sortOrder: 1,
      isActive: true,
    },
  ],
  createdAt: MADE,
  updatedAt: MADE,
  ...changes,
})

/** A colour on a discount, whose price depends on the hair, given on weekdays and after a patch test */
export const aDiscountedColour = (): ModelsServiceResponse =>
  aService({
    id: '7f2c5d8e-0a6b-4c3d-8e1f-5a9b3c7d6e54',
    categoryId: colouring().id,
    name: 'フルカラー',
    description: null,
    shortDescription: null,
    duration: 120,
    price: 8000,
    discountPrice: 7200,
    taxIncluded: false,
    pricingStrategy: 'variable',
    imageUrl: null,
    requiredStaffLevel: 'senior',
    maxBookingsPerDay: 4,
    requiresConsultation: true,
    allowOnlineBooking: false,
    bookingRequirements: ['patch_test_required', 'deposit_required'],
    tags: [],
    sortOrder: 2,
    availability: 'weekdays_only',
    options: [],
  })

/** A cut and a colour together, of no category, coming soon */
export const aPackage = (): ModelsServiceResponse =>
  aService({
    id: '8a3d6e9f-1b7c-4d4e-9f2a-6b0c4d8e7f65',
    categoryId: null,
    name: 'カットとカラー',
    description: null,
    shortDescription: null,
    duration: 180,
    price: 12000,
    discountPrice: 11000,
    imageUrl: null,
    isPackage: true,
    packageServiceIds: [aService().id, aDiscountedColour().id],
    tags: [],
    sortOrder: 3,
    serviceStatus: 'coming_soon',
    isActive: false,
    options: [],
  })

/** The services of the menu, in its order */
export const SERVICES_OF_THE_MENU: ModelsServiceResponse[] = [
  aService(),
  aDiscountedColour(),
  aPackage(),
]
