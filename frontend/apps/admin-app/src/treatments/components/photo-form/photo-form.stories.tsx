import { ButtonLink } from '@beauty-salon-frontend/ui'
import { adminTreatmentMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { PhotoForm } from './photo-form'

const { errors } = adminTreatmentMessages.photos

const meta: Meta<typeof PhotoForm> = {
  title: 'Admin/Treatments/PhotoForm',
  component: PhotoForm,
  args: {
    room: 20,
    onSubmit: fn(),
    actions: (
      <ButtonLink href='/' variant='quiet'>
        やめる
      </ButtonLink>
    ),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** A record without photos: the form opens with one */
export const New: Story = {}

/** A record with room for one more photo: no other row is offered */
export const LastOne: Story = {
  args: { room: 1 },
}

/** What the API refused, under the controls of the photo it belongs to */
export const WithErrors: Story = {
  args: {
    errors: {
      'photos.0.photoUrl': errors.held,
      'photos.0.isPublic': errors.withoutConsent,
    },
  },
}

/** What went wrong with the attempt as a whole */
export const Refused: Story = {
  args: {
    message: errors.noRoom(1, 20),
  },
}

/** The photos are on their way */
export const Sending: Story = {
  args: { pending: true },
}
