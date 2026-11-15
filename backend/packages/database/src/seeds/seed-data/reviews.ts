import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '../../schema'
import type { CompletedBooking } from './bookings'

/**
 * Reviews of the first visits that took place, each by the customer of the
 * visit, for its salon and the staff member who was in charge of it.
 */
export async function seedReviews(
  db: PostgresJsDatabase<typeof schema>,
  completedBookings: CompletedBooking[],
): Promise<string[]> {
  const reviewTexts = [
    {
      title: 'Excellent service!',
      comment:
        'The staff was very professional and friendly. My hair looks amazing!',
      helpfulCount: 12,
      ratings: {
        overall: 5,
        service: 5,
        staff: 5,
        atmosphere: 5,
        cleanliness: 5,
        value: 5,
      },
    },
    {
      title: 'Great experience',
      comment:
        'Really enjoyed my visit. The stylist understood exactly what I wanted.',
      helpfulCount: 7,
      ratings: {
        overall: 5,
        service: 5,
        staff: 5,
        atmosphere: 4,
        cleanliness: 5,
        value: 4,
      },
    },
    {
      title: 'Good but could be better',
      comment: 'Service was good but had to wait despite having a reservation.',
      helpfulCount: 0,
      ratings: {
        overall: 3,
        service: 4,
        staff: 4,
        atmosphere: 3,
        cleanliness: 4,
        value: 3,
      },
    },
    {
      title: 'Satisfied with the result',
      comment:
        'The color turned out exactly as I hoped. Will definitely come back!',
      helpfulCount: 3,
      ratings: {
        overall: 4,
        service: 4,
        staff: 4,
        atmosphere: 4,
        cleanliness: 5,
        value: 4,
      },
    },
    {
      title: 'Amazing head spa',
      comment:
        "The most relaxing head spa experience I've ever had. Highly recommend!",
      helpfulCount: 18,
      ratings: {
        overall: 5,
        service: 5,
        staff: 5,
        atmosphere: 5,
        cleanliness: 5,
        value: 5,
      },
    },
  ]

  const reviews = reviewTexts.flatMap((reviewData, position) => {
    const booking = completedBookings[position]
    if (booking === undefined) {
      return []
    }

    return [
      {
        salonId: booking.salonId,
        customerId: booking.customerId,
        bookingId: booking.id,
        staffId: booking.staffId,
        overallRating: reviewData.ratings.overall,
        serviceRating: reviewData.ratings.service,
        staffRating: reviewData.ratings.staff,
        atmosphereRating: reviewData.ratings.atmosphere,
        cleanlinessRating: reviewData.ratings.cleanliness,
        valueRating: reviewData.ratings.value,
        title: reviewData.title,
        comment: reviewData.comment,
        isVerified: true,
        helpfulCount: reviewData.helpfulCount,
        reportCount: 0,
        ownerResponse:
          position === 0
            ? 'Thank you for your wonderful review! We look forward to seeing you again.'
            : null,
        ownerRespondedAt: position === 0 ? new Date().toISOString() : null,
      },
    ]
  })

  if (reviews.length === 0) {
    console.log('No completed bookings to create reviews for')
    return []
  }

  const insertedReviews = await db
    .insert(schema.reviews)
    .values(reviews)
    .returning({ id: schema.reviews.id })

  return insertedReviews.map((r) => r.id)
}
