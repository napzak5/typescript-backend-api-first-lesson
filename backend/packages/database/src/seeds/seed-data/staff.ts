import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../schema'
import type { SalonKey, SeededSalons } from './salons'
import type { SeededUsers } from './users'

/** The codes of the staff who take bookings, at the salon each works at. */
export interface StaffCodes {
  readonly tokyo: 'STF001' | 'STF002' | 'STF004'
  readonly osaka: 'STF003'
}

/** The ID of every member of the staff who takes bookings. */
export type SeededStaff = {
  readonly [S in SalonKey]: { readonly [C in StaffCodes[S]]: string }
}

export async function seedStaff(
  db: PostgresJsDatabase<typeof schema>,
  salons: SeededSalons,
  users: SeededUsers,
): Promise<SeededStaff> {
  const staff: SeededStaff = {
    tokyo: { STF001: randomUUID(), STF002: randomUUID(), STF004: randomUUID() },
    osaka: { STF003: randomUUID() },
  }
  const management = { owner: randomUUID(), manager: randomUUID() }

  await db.insert(schema.staff).values([
    {
      id: staff.tokyo.STF001,
      salonId: salons.tokyo.id,
      userId: users.stylist1,
      firstName: 'Hiroshi',
      lastName: 'Tanaka',
      firstNameKana: 'ヒロシ',
      lastNameKana: 'タナカ',
      displayName: 'Hiroshi Tanaka',
      email: 'stylist1@beautysalon.jp',
      phoneNumber: '+81-90-3333-4444',
      staffCode: 'STF001',
      level: 'senior',
      position: 'Senior Stylist',
      specialties: ['cut', 'color', 'perm'],
      certifications: ['美容師免許', '管理美容師'],
      bio: 'Over 10 years of experience in hair styling. Specializes in modern cuts and color techniques.',
      yearsOfExperience: 10,
      hireDate: '2014-04-01',
      employmentType: 'full-time',
      baseSalary: 350000,
      commissionRate: '15.00',
      canReceiveBookings: true,
      maxConcurrentBookings: 2,
      bufferTimeBefore: 10,
      bufferTimeAfter: 10,
      isActive: true,
    },
    {
      id: staff.tokyo.STF002,
      salonId: salons.tokyo.id,
      userId: users.stylist2,
      firstName: 'Mika',
      lastName: 'Suzuki',
      firstNameKana: 'ミカ',
      lastNameKana: 'スズキ',
      displayName: 'Mika Suzuki',
      email: 'stylist2@beautysalon.jp',
      phoneNumber: '+81-90-5555-6666',
      staffCode: 'STF002',
      level: 'expert',
      position: 'Color Specialist',
      specialties: ['color', 'treatment', 'balayage'],
      certifications: ['美容師免許', 'ヘアカラリスト検定 1級'],
      bio: 'Expert in color correction and balayage techniques. Certified color specialist.',
      yearsOfExperience: 8,
      hireDate: '2016-06-01',
      employmentType: 'full-time',
      baseSalary: 320000,
      commissionRate: '12.00',
      canReceiveBookings: true,
      maxConcurrentBookings: 1,
      bufferTimeBefore: 15,
      bufferTimeAfter: 15,
      isActive: true,
    },
    {
      id: staff.osaka.STF003,
      salonId: salons.osaka.id,
      userId: users.therapist,
      firstName: 'Takeshi',
      lastName: 'Ito',
      firstNameKana: 'タケシ',
      lastNameKana: 'イトウ',
      displayName: 'Takeshi Ito',
      email: 'therapist@beautysalon.jp',
      phoneNumber: '+81-80-7777-8888',
      staffCode: 'STF003',
      level: 'senior',
      position: 'Spa Therapist',
      specialties: ['spa', 'treatment', 'massage'],
      certifications: ['美容師免許', 'アロマテラピー検定 1級'],
      bio: 'Certified spa therapist with aromatherapy expertise. Focuses on relaxation and scalp treatments.',
      yearsOfExperience: 6,
      hireDate: '2018-03-01',
      employmentType: 'full-time',
      baseSalary: 280000,
      commissionRate: '10.00',
      canReceiveBookings: true,
      maxConcurrentBookings: 1,
      bufferTimeBefore: 10,
      bufferTimeAfter: 20,
      isActive: true,
    },
    {
      id: staff.tokyo.STF004,
      salonId: salons.tokyo.id,
      firstName: 'Yui',
      lastName: 'Watanabe',
      firstNameKana: 'ユイ',
      lastNameKana: 'ワタナベ',
      displayName: 'Yui Watanabe',
      email: 'yui.watanabe@beautysalon.jp',
      phoneNumber: '+81-90-1111-2222',
      staffCode: 'STF004',
      level: 'junior',
      position: 'Junior Stylist',
      specialties: ['cut', 'styling'],
      certifications: ['美容師免許'],
      bio: 'Passionate junior stylist with fresh ideas and modern techniques.',
      yearsOfExperience: 2,
      hireDate: '2022-04-01',
      employmentType: 'full-time',
      baseSalary: 220000,
      commissionRate: '8.00',
      canReceiveBookings: true,
      maxConcurrentBookings: 1,
      bufferTimeBefore: 10,
      bufferTimeAfter: 10,
      isActive: true,
    },
  ])

  // Each account of the staff is that of its member
  const link = async (userId: string, staffId: string): Promise<void> => {
    await db
      .update(schema.users)
      .set({ staffId })
      .where(eq(schema.users.id, userId))
  }
  await link(users.stylist1, staff.tokyo.STF001)
  await link(users.stylist2, staff.tokyo.STF002)
  await link(users.therapist, staff.osaka.STF003)

  // The owner and the manager of the first salon. They belong to the salon
  // through a staff member, like everybody who works there, but take no
  // bookings and are left out of the staff the other seeds draw from.
  await db.insert(schema.staff).values([
    {
      id: management.owner,
      salonId: salons.tokyo.id,
      userId: users.owner,
      firstName: 'Akiko',
      lastName: 'Mori',
      firstNameKana: 'アキコ',
      lastNameKana: 'モリ',
      displayName: 'Akiko Mori',
      email: 'owner@beautysalon.jp',
      phoneNumber: '+81-90-3333-4444',
      staffCode: 'STF900',
      level: 'director',
      position: 'Owner',
      specialties: [],
      certifications: ['美容師免許', '管理美容師'],
      canReceiveBookings: false,
      isActive: true,
    },
    {
      id: management.manager,
      salonId: salons.tokyo.id,
      userId: users.manager,
      firstName: 'Kenji',
      lastName: 'Sato',
      firstNameKana: 'ケンジ',
      lastNameKana: 'サトウ',
      displayName: 'Kenji Sato',
      email: 'manager@beautysalon.jp',
      phoneNumber: '+81-90-5555-6666',
      staffCode: 'STF901',
      level: 'director',
      position: 'Salon Manager',
      specialties: [],
      certifications: [],
      canReceiveBookings: false,
      isActive: true,
    },
  ])
  await link(users.owner, management.owner)
  await link(users.manager, management.manager)

  // Add staff schedules (recurring weekly schedules)
  const schedules: (typeof schema.staffSchedules.$inferInsert)[] = []
  const daysOfWeek: (typeof schema.dayOfWeek.enumValues)[number][] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ]

  // The staff members with an account work every day but Sunday
  for (const staffId of [
    staff.tokyo.STF001,
    staff.tokyo.STF002,
    staff.osaka.STF003,
  ]) {
    for (const dayOfWeek of daysOfWeek) {
      schedules.push({
        staffId,
        dayOfWeek,
        startTime: dayOfWeek === 'saturday' ? '10:00:00' : '09:00:00',
        endTime: dayOfWeek === 'saturday' ? '18:00:00' : '20:00:00',
        breakStartTime: '13:00:00',
        breakEndTime: '14:00:00',
        isRecurring: true,
        isAvailable: true,
      })
    }
  }

  await db.insert(schema.staffSchedules).values(schedules)

  return staff
}
