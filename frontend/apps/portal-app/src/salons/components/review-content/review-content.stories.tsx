import type { Meta, StoryObj } from '@storybook/react-vite'
import { fullReview } from '../examples'
import { ReviewContent } from './review-content'

const meta: Meta<typeof ReviewContent> = {
  title: 'Portal/Salons/ReviewContent',
  component: ReviewContent,
  args: { review: fullReview, timezone: 'Asia/Tokyo' },
}

export default meta

type Story = StoryObj<typeof meta>

/** Everything a review can hold but pictures: ratings in detail, an answer of the salon */
export const Complete: Story = {}

/** The rating alone: no title, no text, no detail, nobody found it helpful, no answer */
export const RatingAlone: Story = {
  args: {
    review: {
      ...fullReview,
      serviceRating: null,
      staffRating: null,
      atmosphereRating: null,
      cleanlinessRating: null,
      valueRating: null,
      title: null,
      comment: null,
      isVerified: false,
      helpfulCount: 0,
      ownerResponse: null,
      ownerRespondedAt: null,
    },
  },
}

/** The addresses of pictures, one of them longer than a line */
export const WithPictures: Story = {
  args: {
    review: {
      ...fullReview,
      imageUrls: [
        'https://images.example.com/reviews/after.jpg',
        'https://images.example.com/reviews/a_long_name_for_the_picture_of_the_colour_three_weeks_after_the_visit_in_daylight.jpg',
      ],
    },
  },
}

/** A text of several paragraphs, and a word no line is broken in */
export const LongText: Story = {
  args: {
    review: {
      ...fullReview,
      title:
        'Thisisatitlethatsomebodywrotewithoutasinglespaceandthatislongerthananylineofaphone',
      comment:
        '写真を見せて相談しました。\n\n髪の状態に合わせた染め方を提案してくれて、色もちもよいです。\nまたお願いします。',
    },
  },
}
