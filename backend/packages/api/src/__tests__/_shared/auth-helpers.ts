import { argon2Sync, createHash, randomBytes, randomUUID } from 'node:crypto'
import {
  customers,
  salons,
  sessions,
  staff,
  users,
} from '@beauty-salon-backend/database'
import {
  Argon2PasswordHasher,
  type Database,
} from '@beauty-salon-backend/infrastructure'
import { eq, getTableColumns, type SQLWrapper, sql } from 'drizzle-orm'
import type { Express } from 'express'
import type { Response } from 'supertest'
import { request } from './test-helpers'

export const AUTH = '/api/v1/auth'

/** The password of every user the helpers insert. */
export const PASSWORD = 'correct horse battery staple'

type NewUser = typeof users.$inferInsert
type NewStaff = typeof staff.$inferInsert
type NewSalon = typeof salons.$inferInsert

/** What the server stores of a token: its SHA-256 in hex. */
export const sha256 = (token: string): string =>
  createHash('sha256').update(token, 'utf8').digest('hex')

const unpadded = (bytes: Buffer): string =>
  bytes.toString('base64').replace(/=+$/, '')

/** An Argon2id hash with less memory and fewer passes than the API uses. */
export const weakHash = (password: string): string => {
  const salt = randomBytes(16)
  const tag = argon2Sync('argon2id', {
    message: password,
    nonce: salt,
    memory: 4_096,
    passes: 1,
    parallelism: 1,
    tagLength: 32,
  })
  return `$argon2id$v=19$m=4096,t=1,p=1$${unpadded(salt)}$${unpadded(tag)}`
}

let hashOfPassword: Promise<string> | undefined

/** `PASSWORD` hashed by the API's hasher, once per file: hashing is slow on purpose. */
const passwordHash = (): Promise<string> => {
  hashOfPassword ??= new Argon2PasswordHasher()
    .hash(PASSWORD)
    .then((hashed) => {
      if (hashed.type === 'error') {
        throw new Error('Hashing the test password failed')
      }
      return hashed.data
    })
  return hashOfPassword
}

/** `password` hashed by the API's hasher, as the API would store it. */
export const passwordHashOf = async (password: string): Promise<string> => {
  const hashed = await new Argon2PasswordHasher().hash(password)
  if (hashed.type === 'error') {
    throw new Error('Hashing a test password failed')
  }
  return hashed.data
}

/** An instant relative to now, in ISO 8601. */
export const minutesFromNow = (minutes: number): string =>
  new Date(Date.now() + minutes * 60_000).toISOString()

/** A timestamp column in milliseconds since the epoch; null stays null. */
export const epochMs = (column: SQLWrapper) =>
  sql<number>`(extract(epoch from ${column}) * 1000)::float8`.mapWith(Number)

/** The seconds from one timestamp column to another. */
const secondsBetween = (from: SQLWrapper, to: SQLWrapper) =>
  sql<number>`extract(epoch from ${to} - ${from})::float8`.mapWith(Number)

/** Every stored session, with how long its access token and the session itself last. */
export const storedSessions = (db: Database) =>
  db
    .select({
      ...getTableColumns(sessions),
      accessSeconds: secondsBetween(
        sessions.lastActivityAt,
        sessions.expiresAt,
      ),
      sessionSeconds: secondsBetween(
        sessions.lastActivityAt,
        sessions.refreshExpiresAt,
      ),
    })
    .from(sessions)
    .orderBy(sessions.createdAt)

export const insertSalon = async (
  db: Database,
  overrides: Partial<NewSalon> = {},
): Promise<string> => {
  const [salon] = await db
    .insert(salons)
    .values({
      name: 'Hair Studio Aoyama',
      prefecture: '東京都',
      city: '港区',
      address: '南青山1-2-3',
      phoneNumber: '03-1234-5678',
      email: `salon-${randomUUID()}@example.com`,
      imageUrls: [],
      features: [],
      amenities: [],
      ...overrides,
    })
    .returning({ id: salons.id })
  if (salon === undefined) {
    throw new Error('No salon was inserted')
  }
  return salon.id
}

const insertStaff = async (
  db: Database,
  salonId: string,
  overrides: Partial<NewStaff> = {},
): Promise<string> => {
  const [member] = await db
    .insert(staff)
    .values({
      salonId,
      firstName: 'Hanako',
      lastName: 'Yamada',
      displayName: 'Hanako Yamada',
      email: `staff-${randomUUID()}@example.com`,
      phoneNumber: '090-1234-5678',
      ...overrides,
    })
    .returning({ id: staff.id })
  if (member === undefined) {
    throw new Error('No staff member was inserted')
  }
  return member.id
}

export const insertCustomer = async (db: Database): Promise<string> => {
  const [customer] = await db
    .insert(customers)
    .values({
      firstName: 'Taro',
      lastName: 'Suzuki',
      email: `customer-${randomUUID()}@example.com`,
      phoneNumber: '090-8765-4321',
    })
    .returning({ id: customers.id })
  if (customer === undefined) {
    throw new Error('No customer was inserted')
  }
  return customer.id
}

export type TestUser = { id: string; email: string }

/** An active, verified customer with `PASSWORD`, unless overridden. */
export const insertUser = async (
  db: Database,
  overrides: Partial<NewUser> = {},
): Promise<TestUser> => {
  const [user] = await db
    .insert(users)
    .values({
      email: `user-${randomUUID()}@example.com`,
      passwordHash: await passwordHash(),
      role: 'customer',
      status: 'active',
      emailVerified: true,
      ...overrides,
    })
    .returning({ id: users.id, email: users.email })
  if (user === undefined) {
    throw new Error('No user was inserted')
  }
  return user
}

export const updateUser = async (
  db: Database,
  id: string,
  changes: Partial<NewUser>,
): Promise<void> => {
  await db.update(users).set(changes).where(eq(users.id, id))
}

/** A user with a role at a salon: linked to a new staff member of the salon. */
export const insertMember = async (
  db: Database,
  role: 'owner' | 'manager' | 'staff',
  salonId: string,
  staffOverrides: Partial<NewStaff> = {},
): Promise<TestUser & { staffId: string }> => {
  const staffId = await insertStaff(db, salonId, staffOverrides)
  const user = await insertUser(db, { role, staffId })
  return { ...user, staffId }
}

/** A login request that satisfies every rule. */
export const loginBody = (
  email: string,
  overrides: Record<string, unknown> = {},
) => ({
  email,
  password: PASSWORD,
  rememberMe: false,
  twoFactorCode: null,
  ...overrides,
})

export type Session = {
  accessToken: string
  refreshToken: string
  /** The value of the Authorization header that carries the access token. */
  authorization: string
  /** The user as the login returned it. */
  user: Record<string, unknown>
}

const sessionOf = (response: Response): Session => {
  if (response.status !== 200) {
    throw new Error(
      `Expected 200, got ${response.status}: ${JSON.stringify(response.body)}`,
    )
  }
  const { accessToken, refreshToken, user } = response.body.data
  return {
    accessToken,
    refreshToken,
    authorization: `Bearer ${accessToken}`,
    user,
  }
}

export const signIn = async (
  app: Express,
  email: string,
  overrides: Record<string, unknown> = {},
): Promise<Session> =>
  sessionOf(
    await request(app).post(`${AUTH}/login`).send(loginBody(email, overrides)),
  )

export const refresh = (app: Express, refreshToken: string) =>
  request(app).post(`${AUTH}/refresh`).send({ refreshToken })

/** Inserts a user and signs in as that user. */
export const signedInUser = async (
  app: Express,
  db: Database,
  overrides: Partial<NewUser> = {},
): Promise<TestUser & Session> => {
  const user = await insertUser(db, overrides)
  return { ...user, ...(await signIn(app, user.email)) }
}

/** Signs in as a new admin and returns the Authorization header to send. */
export const signInAsAdmin = async (
  app: Express,
  db: Database,
): Promise<string> =>
  (await signedInUser(app, db, { role: 'admin' })).authorization
