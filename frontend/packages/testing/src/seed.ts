/*
 * The names of the seed data (`pnpm db:seed`) that the tests name: the
 * salons, the accounts by what they may do, and the customers of the
 * ledger. A test that calls the API starts on a database with them.
 */

/** The salons, by their name. Both keep the time of Tokyo. */
export const TOKYO = 'Beauty Studio Tokyo'
export const OSAKA = 'Hair & Spa Osaka'

/** The accounts of the salon in Tokyo, by their address of mail */
export const OWNER = 'owner@beautysalon.jp'
export const MANAGER = 'manager@beautysalon.jp'
export const STYLIST = 'stylist1@beautysalon.jp'

/** A member of the staff of the salon in Osaka */
export const THERAPIST = 'therapist@beautysalon.jp'

/** The operator of the platform: a member of no salon */
export const OPERATOR = 'admin@beautysalon.jp'

/**
 * The customers that have an account, by their address of mail and by the
 * name the ledger shows.
 */
export const YUKI = { email: 'customer1@example.com', name: 'Tanaka Yuki' }
export const KENJI = { email: 'customer2@example.com', name: 'Yamamoto Kenji' }
export const SAKURA = { email: 'customer3@example.com', name: 'Sato Sakura' }
export const VIP = {
  email: 'vip.customer@example.com',
  name: 'Nakamura Hiroshi',
}

/** The customer who signs in, where it does not matter which one */
export const CUSTOMER = YUKI.email
