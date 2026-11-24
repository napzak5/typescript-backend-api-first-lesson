import { adminTreatmentMessages } from '@beauty-salon-shared/i18n/messages/admin'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { fn } from 'storybook/test'
import { salon } from '../../../bookings/components/examples'
import { aPhoto, aTreatment, photos } from '../examples'
import { TreatmentPhotos } from './treatment-photos'

const { removal } = adminTreatmentMessages.photos

const meta: Meta<typeof TreatmentPhotos> = {
  title: 'Admin/Treatments/TreatmentPhotos',
  component: TreatmentPhotos,
  parameters: {
    // The dialog covers its page: in the documentation each story has a frame of its own
    docs: { story: { inline: false, height: '36rem' } },
  },
  args: {
    photos,
    addHref: `/salons/${salon.id}/treatments/${aTreatment().id}/photos/new`,
    removing: undefined,
    pending: false,
    onOpen: fn(),
    onClose: fn(),
    onRemove: fn(),
  },
}

export default meta

type Story = StoryObj<typeof meta>

/** Photos before and after the treatment, and one the customer did not agree to show */
export const Photos: Story = {}

/** A record without photos */
export const NoPhotos: Story = {
  args: { photos: [] },
}

/** A record with as many photos as it holds: no more are added */
export const Full: Story = {
  args: {
    photos: Array.from({ length: 20 }, (_, index) =>
      aPhoto({
        id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        photoUrl: `https://photos.example.com/treatments/${index}.jpg`,
        sortOrder: index,
      }),
    ),
  },
}

/** The dialog asks before a photo is taken away */
export const Asking: Story = {
  args: { removing: photos[1] },
}

/** The photo is being taken away */
export const Removing: Story = {
  args: { removing: photos[1], pending: true },
}

/** The photo could not be taken away, and may be tried again */
export const RemovalFailed: Story = {
  args: {
    removing: photos[1],
    message: removal.failed,
  },
}

/** Another account took the photo away meanwhile */
export const Gone: Story = {
  args: { refusal: removal.gone },
}
