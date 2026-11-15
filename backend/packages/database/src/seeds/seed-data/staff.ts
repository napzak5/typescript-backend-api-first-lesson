import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../schema'

export async function seedStaff(
  db: PostgresJsDatabase<typeof schema>,
  salonIds: string[],
  userIds?: {
    staffUserIds: string[]
    ownerUserId: string
    managerUserId: string
  },
): Promise<void> {
  const salonId1 = salonIds[0]
  const salonId2 = salonIds[1]

  if (!(salonId1 && salonId2)) {
    throw new Error('At least 2 salon IDs required for staff seeding')
  }

  const staff = await db
    .insert(schema.staff)
    .values([
      {
        salonId: salonId1,
        userId: userIds?.staffUserIds[0],
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
        salonId: salonId1,
        userId: userIds?.staffUserIds[1],
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
        salonId: salonId2,
        userId: userIds?.staffUserIds[2],
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
        salonId: salonId1,
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
    .returning({ id: schema.staff.id })

  // Link users to staff
  if (userIds?.staffUserIds && staff.length > 0) {
    for (
      let i = 0;
      i < Math.min(userIds.staffUserIds.length, staff.length);
      i++
    ) {
      const userId = userIds.staffUserIds[i]
      const staffId = staff[i]?.id
      if (userId && staffId) {
        await db
          .update(schema.users)
          .set({ staffId })
          .where(eq(schema.users.id, userId))
      }
    }
  }

  // The owner and the manager of the first salon. They belong to the salon
  // through a staff member, like everybody who works there, but take no
  // bookings and are left out of the IDs the other seeds draw from.
  if (userIds) {
    const management = await db
      .insert(schema.staff)
      .values([
        {
          salonId: salonId1,
          userId: userIds.ownerUserId,
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
          salonId: salonId1,
          userId: userIds.managerUserId,
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
      .returning({ id: schema.staff.id, userId: schema.staff.userId })

    for (const { id: staffId, userId } of management) {
      if (userId) {
        await db
          .update(schema.users)
          .set({ staffId })
          .where(eq(schema.users.id, userId))
      }
    }
  }

  // Add staff schedules (recurring weekly schedules)
  const schedules = []
  const daysOfWeek = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ] as const

  for (const staffMember of staff.slice(0, 3)) {
    // First 3 staff members
    for (const dayOfWeek of daysOfWeek) {
      schedules.push({
        staffId: staffMember.id,
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
}
